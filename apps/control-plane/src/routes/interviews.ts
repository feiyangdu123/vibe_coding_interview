import { request as createUpstreamRequest, type IncomingMessage } from "node:http";
import { Readable, type Duplex } from "node:stream";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { EndSessionRequest, StartSessionRequest } from "@vibe-interview/shared-types";
import { SessionService } from "../services/session-service.js";

const SESSION_COOKIE_NAME = "oc_session_id";

export async function registerInterviewRoutes(
  app: FastifyInstance,
  sessionService: SessionService,
): Promise<void> {
  app.get("/api/interviews/:token", async (request, reply) => {
    const token = (request.params as { token: string }).token;
    return reply.send(await sessionService.getInterviewByToken(token));
  });

  app.get("/api/sessions/:sessionId", async (request, reply) => {
    const sessionId = (request.params as { sessionId: string }).sessionId;
    return reply.send(await sessionService.getSession(sessionId));
  });

  app.post("/api/sessions/:sessionId/start", async (request, reply) => {
    const sessionId = (request.params as { sessionId: string }).sessionId;
    const body = (request.body ?? {}) as StartSessionRequest;
    const session = await sessionService.startSession(sessionId, body);
    return reply.send(session);
  });

  app.post("/api/sessions/:sessionId/end", async (request, reply) => {
    const sessionId = (request.params as { sessionId: string }).sessionId;
    const body = (request.body ?? {}) as EndSessionRequest;
    const session = await sessionService.endSession(sessionId, body);
    return reply.send(session);
  });

  app.all("/s/:sessionId", async (request, reply) => {
    const sessionId = (request.params as { sessionId: string }).sessionId;
    setSessionCookie(reply, sessionId);
    return reply.redirect(`/s/${sessionId}/`);
  });

  app.all("/s/:sessionId/*", async (request, reply) => {
    const params = request.params as { sessionId: string; "*": string };
    setSessionCookie(reply, params.sessionId);
    return proxySessionRequest({
      request,
      reply,
      sessionService,
      sessionId: params.sessionId,
      upstreamPath: params["*"] ?? "",
      rewriteHtml: true,
    });
  });

  app.route({
    method: ["DELETE", "GET", "PATCH", "POST", "PUT"],
    url: "/*",
    handler: async (request, reply) => {
      const pathOnly = (request.raw.url ?? "/").split("?")[0] ?? "/";
      const sessionId = request.cookies[SESSION_COOKIE_NAME];

      if (!sessionId || !shouldProxyRootPath(pathOnly)) {
        return reply.code(404).send({
          message: `Route ${request.method}:${pathOnly} not found`,
        });
      }

      const upstreamPath = pathOnly === "/" ? "" : pathOnly.replace(/^\/+/, "");
      return proxySessionRequest({
        request,
        reply,
        sessionService,
        sessionId,
        upstreamPath,
        rewriteHtml: pathOnly === "/",
      });
    },
  });

  app.server.on("upgrade", (request, socket, head) => {
    void proxySessionWebSocketUpgrade({
      app,
      sessionService,
      request,
      socket,
      head,
    });
  });
}

function buildUpstreamUrl(target: string, wildcardPath: string, rawRequestUrl: string): string {
  const upstream = new URL(target);
  const originalUrl = new URL(rawRequestUrl || "/", "http://127.0.0.1");

  upstream.pathname = wildcardPath ? `/${wildcardPath}` : "/";
  upstream.search = originalUrl.search;

  return upstream.toString();
}

function rewriteHtmlForSessionPath(html: string, sessionId: string): string {
  const prefix = `/s/${sessionId}`;

  return html
    .replaceAll('href="/', `href="${prefix}/`)
    .replaceAll('src="/', `src="${prefix}/`)
    .replaceAll('content="/', `content="${prefix}/`);
}

function shouldProxyRootPath(pathname: string): boolean {
  return pathname !== "/healthz" && !pathname.startsWith("/api/") && !pathname.startsWith("/s/");
}

function setSessionCookie(reply: FastifyReply, sessionId: string): void {
  reply.header(
    "set-cookie",
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax`,
  );
}

async function proxySessionWebSocketUpgrade({
  app,
  sessionService,
  request,
  socket,
  head,
}: {
  app: FastifyInstance;
  sessionService: SessionService;
  request: IncomingMessage;
  socket: Duplex;
  head: Buffer;
}): Promise<void> {
  if (!isWebSocketUpgradeRequest(request)) {
    socket.destroy();
    return;
  }

  const pathOnly = (request.url ?? "/").split("?")[0] ?? "/";
  const sessionTarget = resolveWebSocketSessionTarget(request, pathOnly);

  if (!sessionTarget) {
    writeJsonSocketResponse(socket, 404, `Route ${request.method ?? "GET"}:${pathOnly} not found`);
    return;
  }

  const proxyConfig = await sessionService.getProxyConfig(sessionTarget.sessionId);

  if (proxyConfig.kind !== "ready") {
    writeJsonSocketResponse(socket, 409, proxyConfig.reason);
    return;
  }

  const upstreamUrl = buildUpstreamUrl(
    proxyConfig.target,
    sessionTarget.upstreamPath,
    request.url ?? "",
  );
  const headers = buildUpstreamUpgradeHeaders(request, proxyConfig.username, proxyConfig.password);
  const upstreamRequest = createUpstreamRequest(upstreamUrl, {
    method: request.method ?? "GET",
    headers,
  });
  const handleDownstreamError = (error?: Error) => {
    app.log.warn({ err: error }, "Downstream websocket socket closed unexpectedly");
    upstreamRequest.destroy();

    if (!socket.destroyed) {
      socket.destroy();
    }
  };
  const handleDownstreamClose = () => {
    upstreamRequest.destroy();
  };

  socket.on("error", handleDownstreamError);
  socket.once("close", handleDownstreamClose);

  upstreamRequest.on("upgrade", (upstreamResponse, upstreamSocket, upstreamHead) => {
    socket.off("close", handleDownstreamClose);
    pipeUpgradedSockets(app, socket, upstreamSocket, upstreamResponse, head, upstreamHead);
  });

  upstreamRequest.on("response", (upstreamResponse) => {
    socket.off("close", handleDownstreamClose);
    writeStreamSocketResponse(app, socket, upstreamResponse);
  });

  upstreamRequest.on("error", (error) => {
    socket.off("error", handleDownstreamError);
    socket.off("close", handleDownstreamClose);
    app.log.error({ err: error }, "Failed to proxy session runtime websocket request");

    if (!socket.destroyed) {
      writeJsonSocketResponse(socket, 502, "无法连接到当前编程环境。");
    }
  });

  upstreamRequest.end();
}

async function proxySessionRequest({
  request,
  reply,
  sessionService,
  sessionId,
  upstreamPath,
  rewriteHtml,
}: {
  request: FastifyRequest;
  reply: FastifyReply;
  sessionService: SessionService;
  sessionId: string;
  upstreamPath: string;
  rewriteHtml: boolean;
}) {
  const proxyConfig = await sessionService.getProxyConfig(sessionId);

  if (proxyConfig.kind !== "ready") {
    const statusCode = proxyConfig.status === "CREATED" || proxyConfig.status === "READY" ? 409 : 410;
    return reply
      .code(statusCode)
      .type("text/html; charset=utf-8")
      .send(buildRuntimeBlockedHtml(proxyConfig.status, proxyConfig.reason));
  }

  try {
    const upstreamUrl = buildUpstreamUrl(proxyConfig.target, upstreamPath, request.raw.url ?? "");
    const headers = new Headers();

    for (const [key, value] of Object.entries(
      request.headers as Record<string, string | string[] | undefined>,
    )) {
      if (
        value === undefined ||
        key === "host" ||
        key === "authorization" ||
        key === "connection" ||
        key === "content-length" ||
        key === "cookie"
      ) {
        continue;
      }

      if (Array.isArray(value)) {
        headers.set(key, value.join(", "));
      } else if (typeof value === "string") {
        headers.set(key, value);
      }
    }

    headers.set(
      "authorization",
      `Basic ${Buffer.from(`${proxyConfig.username}:${proxyConfig.password}`).toString("base64")}`,
    );

    const upstreamRequest: RequestInit & { duplex?: "half" } = {
      method: request.method,
      headers,
      redirect: "manual",
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
      upstreamRequest.body = Readable.toWeb(request.raw) as RequestInit["body"];
      upstreamRequest.duplex = "half";
    }

    const upstreamResponse = await fetch(upstreamUrl, upstreamRequest);

    reply.code(upstreamResponse.status);

    upstreamResponse.headers.forEach((value, key) => {
      if (
        key === "connection" ||
        key === "content-length" ||
        key === "content-encoding" ||
        key === "transfer-encoding"
      ) {
        return;
      }

      if (key === "location") {
        reply.header(key, rewriteLocationHeader(value, sessionId));
        return;
      }

      reply.header(key, value);
    });

    const contentType = upstreamResponse.headers.get("content-type") ?? "";

    if (rewriteHtml && contentType.includes("text/html")) {
      const html = await upstreamResponse.text();
      return reply.send(rewriteHtmlForSessionPath(html, sessionId));
    }

    if (!upstreamResponse.body) {
      return reply.send();
    }

    return reply.send(Readable.fromWeb(upstreamResponse.body));
  } catch (error) {
    request.log.error({ err: error }, "Failed to proxy session runtime request");
    return reply.code(502).send({
      message: "无法连接到当前编程环境。",
    });
  }
}

function buildRuntimeBlockedHtml(status: string, reason: string): string {
  const title = status === "CREATED" || status === "READY" ? "面试尚未开始" : "面试已结束";

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
        color: #10263f;
        background: #f4ede0;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at top right, rgba(196, 121, 45, 0.18), transparent 32%),
          linear-gradient(180deg, #f4ede0 0%, #f8f4ec 100%);
      }
      .panel {
        width: min(560px, calc(100vw - 32px));
        padding: 32px;
        border-radius: 24px;
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid rgba(16, 38, 63, 0.08);
        box-shadow: 0 24px 48px rgba(16, 38, 63, 0.08);
      }
      h1 {
        margin: 0 0 12px;
        font-size: 28px;
      }
      p {
        margin: 0 0 10px;
        line-height: 1.6;
      }
    </style>
  </head>
  <body>
    <section class="panel">
      <h1>${title}</h1>
      <p>${reason}</p>
      <p>系统会尝试自动关闭当前页面；如果浏览器阻止关闭，请直接关闭此窗口。</p>
    </section>
    <script>
      window.close();
    </script>
  </body>
</html>`;
}

function rewriteLocationHeader(locationHeader: string, sessionId: string): string {
  if (locationHeader.startsWith("http://") || locationHeader.startsWith("https://")) {
    const parsed = new URL(locationHeader);
    return `/s/${sessionId}${parsed.pathname}${parsed.search}`;
  }

  if (locationHeader.startsWith("/")) {
    return `/s/${sessionId}${locationHeader}`;
  }

  return `/s/${sessionId}/${locationHeader}`;
}

function resolveWebSocketSessionTarget(
  request: IncomingMessage,
  pathOnly: string,
): { sessionId: string; upstreamPath: string } | null {
  const prefixedMatch = pathOnly.match(/^\/s\/([^/]+)(?:\/(.*))?$/);

  if (prefixedMatch) {
    return {
      sessionId: decodeURIComponent(prefixedMatch[1] ?? ""),
      upstreamPath: prefixedMatch[2] ?? "",
    };
  }

  if (shouldProxyRootPath(pathOnly)) {
    const sessionIdHeader = request.headers.cookie
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));
    const sessionId = sessionIdHeader?.slice(SESSION_COOKIE_NAME.length + 1);

    if (!sessionId) {
      return null;
    }

    return {
      sessionId: decodeURIComponent(sessionId),
      upstreamPath: pathOnly === "/" ? "" : pathOnly.replace(/^\/+/, ""),
    };
  }

  return null;
}

function isWebSocketUpgradeRequest(request: IncomingMessage): boolean {
  return (request.headers.upgrade ?? "").toLowerCase() === "websocket";
}

function buildUpstreamUpgradeHeaders(
  request: IncomingMessage,
  username: string,
  password: string,
): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const [key, value] of Object.entries(request.headers)) {
    if (
      value === undefined ||
      key === "host" ||
      key === "authorization" ||
      key === "cookie"
    ) {
      continue;
    }

    headers[key] = Array.isArray(value) ? value.join(", ") : value;
  }

  headers.authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  headers.connection = "Upgrade";
  headers.upgrade = "websocket";

  return headers;
}

function pipeUpgradedSockets(
  app: FastifyInstance,
  downstreamSocket: Duplex,
  upstreamSocket: Duplex,
  upstreamResponse: IncomingMessage,
  downstreamHead: Buffer,
  upstreamHead: Buffer,
): void {
  const cleanup = () => {
    downstreamSocket.off("error", handleDownstreamError);
    upstreamSocket.off("error", handleUpstreamError);
    downstreamSocket.off("close", handleDownstreamClose);
    upstreamSocket.off("close", handleUpstreamClose);
  };
  const handleDownstreamError = (error: Error) => {
    app.log.warn({ err: error }, "Downstream upgraded socket error");
    destroyStream(upstreamSocket);
    cleanup();
  };
  const handleUpstreamError = (error: Error) => {
    app.log.warn({ err: error }, "Upstream upgraded socket error");
    destroyStream(downstreamSocket);
    cleanup();
  };
  const handleDownstreamClose = () => {
    destroyStream(upstreamSocket);
    cleanup();
  };
  const handleUpstreamClose = () => {
    destroyStream(downstreamSocket);
    cleanup();
  };
  const statusLine = `HTTP/1.1 ${upstreamResponse.statusCode ?? 101} ${upstreamResponse.statusMessage ?? "Switching Protocols"}\r\n`;
  const headerLines = Object.entries(upstreamResponse.headers)
    .flatMap(([key, value]) => {
      if (value === undefined) {
        return [];
      }

      if (Array.isArray(value)) {
        return value.map((entry) => `${key}: ${entry}\r\n`);
      }

      return [`${key}: ${value}\r\n`];
    })
    .join("");

  downstreamSocket.on("error", handleDownstreamError);
  upstreamSocket.on("error", handleUpstreamError);
  downstreamSocket.once("close", handleDownstreamClose);
  upstreamSocket.once("close", handleUpstreamClose);

  if (downstreamSocket.destroyed || upstreamSocket.destroyed) {
    cleanup();
    destroyStream(downstreamSocket);
    destroyStream(upstreamSocket);
    return;
  }

  downstreamSocket.write(`${statusLine}${headerLines}\r\n`);

  if (downstreamHead.length > 0) {
    upstreamSocket.write(downstreamHead);
  }

  if (upstreamHead.length > 0) {
    downstreamSocket.write(upstreamHead);
  }

  downstreamSocket.pipe(upstreamSocket);
  upstreamSocket.pipe(downstreamSocket);
}

function writeStreamSocketResponse(
  app: FastifyInstance,
  socket: Duplex,
  response: IncomingMessage,
): void {
  const cleanup = () => {
    socket.off("error", handleSocketError);
    response.off("error", handleResponseError);
    response.off("end", cleanup);
    response.off("close", cleanup);
    socket.off("close", cleanup);
  };
  const handleSocketError = (error: Error) => {
    app.log.warn({ err: error }, "Downstream stream socket error");
    response.destroy();
    cleanup();
  };
  const handleResponseError = (error: Error) => {
    app.log.warn({ err: error }, "Upstream stream response error");
    destroyStream(socket);
    cleanup();
  };
  const statusLine = `HTTP/1.1 ${response.statusCode ?? 502} ${response.statusMessage ?? "Bad Gateway"}\r\n`;
  const headerLines = Object.entries(response.headers)
    .flatMap(([key, value]) => {
      if (value === undefined) {
        return [];
      }

      if (Array.isArray(value)) {
        return value.map((entry) => `${key}: ${entry}\r\n`);
      }

      return [`${key}: ${value}\r\n`];
    })
    .join("");

  socket.on("error", handleSocketError);
  response.on("error", handleResponseError);
  response.once("end", cleanup);
  response.once("close", cleanup);
  socket.once("close", cleanup);

  if (socket.destroyed) {
    cleanup();
    response.destroy();
    return;
  }

  socket.write(`${statusLine}${headerLines}\r\n`);
  response.pipe(socket);
}

function writeJsonSocketResponse(socket: Duplex, statusCode: number, message: string): void {
  if (socket.destroyed) {
    return;
  }

  const body = JSON.stringify({ message });
  const handleSocketError = () => {
    destroyStream(socket);
  };

  socket.once("error", handleSocketError);
  socket.end(
    `HTTP/1.1 ${statusCode}\r\ncontent-type: application/json; charset=utf-8\r\ncontent-length: ${Buffer.byteLength(body)}\r\nconnection: close\r\n\r\n${body}`,
    () => {
      socket.off("error", handleSocketError);
    },
  );
}

function destroyStream(stream: Duplex | IncomingMessage): void {
  if (!stream.destroyed) {
    stream.destroy();
  }
}
