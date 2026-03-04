import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { loadControlPlaneConfig } from "@vibe-interview/config";
import { LocalWorkspaceProvider } from "@vibe-interview/workspace-core";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerInterviewRoutes } from "./routes/interviews.js";
import { SessionService } from "./services/session-service.js";

export function createServer() {
  const config = loadControlPlaneConfig();
  const app = Fastify({
    logger: true,
  });
  const workspaceProvider = new LocalWorkspaceProvider({
    rootDir: config.workspaceRoot,
    basePort: config.workspaceBasePort,
    maxSessions: config.workspaceMaxSessions,
    opencodeBinary: config.opencodeBinary,
    opencodeUsername: config.opencodeUsername,
  });
  const sessionService = new SessionService(
    workspaceProvider,
    config.defaultTemplatePath,
    config.portalOrigin,
  );

  void app.register(cors, {
    origin: true,
    credentials: true,
  });
  void app.register(cookie);
  void app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    allowList: (request) => shouldBypassRateLimit(request.raw.url ?? request.url),
  });
  app.setErrorHandler((error, _request, reply) => {
    const statusCode = typeof (error as { statusCode?: number }).statusCode === "number"
      ? (error as { statusCode: number }).statusCode
      : 500;
    const message = error instanceof Error ? error.message : "Unknown server error";

    void reply.code(statusCode).send({
      message,
    });
  });
  void app.register(registerHealthRoutes);
  void app.register(async (instance) => {
    await registerAdminRoutes(instance, sessionService);
  });
  void app.register(async (instance) => {
    await registerInterviewRoutes(instance, sessionService);
  });

  return {
    app,
    config,
  };
}

function shouldBypassRateLimit(url: string): boolean {
  const pathname = (url.split("?")[0] ?? "/").trim();

  return pathname.startsWith("/s/") || pathname.startsWith("/global/");
}
