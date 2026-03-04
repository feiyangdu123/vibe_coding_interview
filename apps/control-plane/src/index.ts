import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function loadWorkspaceEnv(): void {
  const loader = process.loadEnvFile as ((path?: string) => void) | undefined;

  if (typeof loader !== "function") {
    return;
  }

  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../.env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(process.cwd(), "../../../.env"),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env"),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.env"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      loader(candidate);
      return;
    }
  }
}

async function main() {
  loadWorkspaceEnv();
  const { createServer } = await import("./server.js");
  const { app, config } = createServer();

  try {
    await app.listen({
      host: config.host,
      port: config.port,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void main();
