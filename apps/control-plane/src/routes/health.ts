import type { FastifyInstance } from "fastify";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/healthz", async () => ({
    ok: true,
    service: "control-plane",
    timestamp: new Date().toISOString(),
  }));
}
