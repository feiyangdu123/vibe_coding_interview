import { randomBytes } from "node:crypto";
import { ChildProcess, spawn } from "node:child_process";
import { access, cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { createServer, Server } from "node:http";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";

export interface PrepareWorkspaceInput {
  sessionId: string;
  templatePath?: string | null;
}

export interface StartProcessInput {
  sessionId: string;
}

export interface WorkspaceProcessHandle {
  sessionId: string;
  workspacePath: string;
  port: number;
  endpoint: string;
  username: string;
  password: string;
  mode: "opencode" | "mock";
}

export interface WorkspaceProvider {
  prepareSessionWorkspace(input: PrepareWorkspaceInput): Promise<string>;
  startOpenCodeWebProcess(input: StartProcessInput): Promise<WorkspaceProcessHandle>;
  getSessionEndpoint(sessionId: string): string | null;
  cleanupSessionWorkspace(sessionId: string): Promise<void>;
}

interface WorkspaceRecord {
  workspaceRootPath: string;
  workspacePath: string;
  port: number;
  username: string;
  password: string;
  mode: "opencode" | "mock" | null;
  process: ChildProcess | null;
  mockServer: Server | null;
}

export interface LocalWorkspaceProviderOptions {
  rootDir: string;
  hostname?: string;
  basePort?: number;
  maxSessions?: number;
  opencodeBinary?: string;
  opencodeUsername?: string;
}

export class LocalWorkspaceProvider implements WorkspaceProvider {
  private readonly hostname: string;
  private readonly basePort: number;
  private readonly maxSessions: number;
  private readonly opencodeBinary: string;
  private readonly opencodeUsername: string;
  private readonly sessions = new Map<string, WorkspaceRecord>();

  public constructor(private readonly options: LocalWorkspaceProviderOptions) {
    this.hostname = options.hostname ?? "127.0.0.1";
    this.basePort = options.basePort ?? 4100;
    this.maxSessions = options.maxSessions ?? 5;
    this.opencodeBinary = options.opencodeBinary ?? "opencode";
    this.opencodeUsername = options.opencodeUsername ?? "opencode";
  }

  public async prepareSessionWorkspace(input: PrepareWorkspaceInput): Promise<string> {
    const existing = this.sessions.get(input.sessionId);

    if (existing) {
      return existing.workspacePath;
    }

    if (this.sessions.size >= this.maxSessions) {
      throw new Error(`Max active sessions reached (${this.maxSessions}).`);
    }

    await mkdir(this.options.rootDir, { recursive: true });

    const workspaceRootPath = await mkdtemp(path.join(this.options.rootDir, `${input.sessionId}-`));
    let workspacePath = workspaceRootPath;

    if (input.templatePath) {
      await access(input.templatePath, constants.R_OK);
      workspacePath = path.join(workspaceRootPath, path.basename(input.templatePath));
      await cp(input.templatePath, workspacePath, { recursive: true });
    }

    this.sessions.set(input.sessionId, {
      workspaceRootPath,
      workspacePath,
      port: this.allocatePort(),
      username: this.opencodeUsername,
      password: randomBytes(18).toString("base64url"),
      mode: null,
      process: null,
      mockServer: null,
    });

    return workspacePath;
  }

  public async startOpenCodeWebProcess(input: StartProcessInput): Promise<WorkspaceProcessHandle> {
    const record = this.sessions.get(input.sessionId);

    if (!record) {
      throw new Error(`Workspace for session "${input.sessionId}" was not prepared.`);
    }

    if (!record.process && !record.mockServer) {
      if (this.opencodeBinary === "mock") {
        record.mockServer = await this.startMockWorkspaceServer(input.sessionId, record);
        record.mode = "mock";
      } else {
        try {
          record.process = await this.spawnOpencodeProcess(input.sessionId, record);
          record.mode = "opencode";
        } catch (error) {
          const spawnError = error as NodeJS.ErrnoException;

          if (spawnError.code !== "ENOENT") {
            throw error;
          }

          record.mockServer = await this.startMockWorkspaceServer(input.sessionId, record);
          record.mode = "mock";
        }
      }
    }

    if (record.mode === "opencode") {
      await this.waitForOpenCodeReady(record);
    }

    return {
      sessionId: input.sessionId,
      workspacePath: record.workspacePath,
      port: record.port,
      endpoint: this.buildEndpoint(record.port),
      username: record.username,
      password: record.password,
      mode: record.mode ?? "mock",
    };
  }

  public getSessionEndpoint(sessionId: string): string | null {
    const record = this.sessions.get(sessionId);
    return record ? this.buildEndpoint(record.port) : null;
  }

  public async cleanupSessionWorkspace(sessionId: string): Promise<void> {
    const record = this.sessions.get(sessionId);

    if (!record) {
      return;
    }

    if (record.process && !record.process.killed) {
      record.process.kill("SIGTERM");
    }

    if (record.mockServer) {
      await new Promise<void>((resolve, reject) => {
        record.mockServer?.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }

    await rm(record.workspaceRootPath, { recursive: true, force: true });
    this.sessions.delete(sessionId);
  }

  private spawnOpencodeProcess(
    sessionId: string,
    record: WorkspaceRecord,
  ): Promise<ChildProcess> {
    return new Promise<ChildProcess>((resolve, reject) => {
      const child = spawn(
        this.opencodeBinary,
        [
          // Use the headless server mode so starting a session does not auto-open
          // the local runtime URL in the user's browser.
          "serve",
          "--hostname",
          this.hostname,
          "--port",
          String(record.port),
        ],
        {
          cwd: record.workspacePath,
          env: {
            ...process.env,
            OPENCODE_SERVER_PASSWORD: record.password,
            OPENCODE_SERVER_USERNAME: record.username,
          },
          stdio: "ignore",
        },
      );

      const handleError = (error: Error) => {
        child.removeListener("spawn", handleSpawn);
        reject(error);
      };

      const handleSpawn = () => {
        child.removeListener("error", handleError);

        child.on("exit", () => {
          const current = this.sessions.get(sessionId);

          if (current) {
            current.process = null;
            current.mode = null;
          }
        });

        resolve(child);
      };

      child.once("error", handleError);
      child.once("spawn", handleSpawn);
    });
  }

  private startMockWorkspaceServer(
    sessionId: string,
    record: WorkspaceRecord,
  ): Promise<Server> {
    return new Promise<Server>((resolve, reject) => {
      const server = createServer((request, response) => {
        const body = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>编程环境占位页</title>
    <style>
      body {
        margin: 0;
        padding: 32px;
        font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
        background: linear-gradient(180deg, #f7f1e6 0%, #f4ede2 100%);
        color: #1f2937;
      }
      .panel {
        max-width: 860px;
        margin: 0 auto;
        background: rgba(255, 255, 255, 0.88);
        border: 1px solid rgba(31, 41, 55, 0.12);
        border-radius: 18px;
        padding: 24px;
        box-shadow: 0 18px 40px rgba(31, 41, 55, 0.08);
      }
      code {
        background: rgba(31, 41, 55, 0.08);
        padding: 2px 6px;
        border-radius: 6px;
      }
    </style>
  </head>
  <body>
    <div class="panel">
      <p style="margin-top:0; letter-spacing:0.08em; text-transform:uppercase;">编程环境占位页</p>
      <h1 style="margin-top:0;">场次 ${sessionId}</h1>
      <p>
        当前机器没有安装 <code>opencode</code>，所以 control plane 启动了一个占位页面，
        用来替代真实的 OpenCode Web 编程环境。
      </p>
      <p><strong>工作目录：</strong> <code>${record.workspacePath}</code></p>
      <p><strong>当前请求：</strong> <code>${request.method ?? "GET"} ${request.url ?? "/"}</code></p>
      <p>
        安装好 <code>opencode</code> 之后，同样的面试流程会自动切换到真实的浏览器编程环境，
        不需要改动 portal 页面。
      </p>
    </div>
  </body>
</html>`;

        response.statusCode = 200;
        response.setHeader("content-type", "text/html; charset=utf-8");
        response.end(body);
      });

      server.once("error", reject);
      server.listen(record.port, this.hostname, () => {
        server.removeListener("error", reject);
        resolve(server);
      });
    });
  }

  private allocatePort(): number {
    const usedPorts = new Set(Array.from(this.sessions.values(), (record) => record.port));
    let candidate = this.basePort;

    while (usedPorts.has(candidate)) {
      candidate += 1;
    }

    return candidate;
  }

  private buildEndpoint(port: number): string {
    return `http://${this.hostname}:${port}`;
  }

  private async waitForOpenCodeReady(record: WorkspaceRecord): Promise<void> {
    const healthUrl = `${this.buildEndpoint(record.port)}/global/health`;
    const authorization = `Basic ${Buffer.from(`${record.username}:${record.password}`).toString("base64")}`;

    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const response = await fetch(healthUrl, {
          headers: {
            authorization,
          },
          signal: AbortSignal.timeout(1_000),
        });

        if (response.ok) {
          return;
        }
      } catch {
        // Retry until the runtime becomes available or times out.
      }

      if (!record.process) {
        throw new Error("OpenCode process exited before becoming ready.");
      }

      await sleep(500);
    }

    throw new Error("Timed out waiting for OpenCode Web to become ready.");
  }
}
