import type { FastifyInstance } from "fastify";
import type {
  CreateCandidateRequest,
  CreateInterviewRequest,
  CreateProblemRequest,
  UpdateCandidateRequest,
  UpdateProblemRequest,
} from "@vibe-interview/shared-types";
import { SessionService } from "../services/session-service.js";

export async function registerAdminRoutes(
  app: FastifyInstance,
  sessionService: SessionService,
): Promise<void> {
  app.get("/api/admin/problems", async (_request, reply) => {
    return reply.send(await sessionService.listProblems());
  });

  app.post("/api/admin/problems", async (request, reply) => {
    const body = (request.body ?? {}) as CreateProblemRequest;
    return reply.send(await sessionService.createProblem(body));
  });

  app.patch("/api/admin/problems/:problemId", async (request, reply) => {
    const problemId = (request.params as { problemId: string }).problemId;
    const body = (request.body ?? {}) as UpdateProblemRequest;
    return reply.send(await sessionService.updateProblem(problemId, body));
  });

  app.delete("/api/admin/problems/:problemId", async (request, reply) => {
    const problemId = (request.params as { problemId: string }).problemId;
    return reply.send(await sessionService.deleteProblem(problemId));
  });

  app.get("/api/admin/candidates", async (_request, reply) => {
    return reply.send(await sessionService.listCandidates());
  });

  app.post("/api/admin/candidates", async (request, reply) => {
    const body = (request.body ?? {}) as CreateCandidateRequest;
    return reply.send(await sessionService.createCandidate(body));
  });

  app.patch("/api/admin/candidates/:candidateId", async (request, reply) => {
    const candidateId = (request.params as { candidateId: string }).candidateId;
    const body = (request.body ?? {}) as UpdateCandidateRequest;
    return reply.send(await sessionService.updateCandidate(candidateId, body));
  });

  app.delete("/api/admin/candidates/:candidateId", async (request, reply) => {
    const candidateId = (request.params as { candidateId: string }).candidateId;
    return reply.send(await sessionService.deleteCandidate(candidateId));
  });

  app.get("/api/admin/interviews", async (_request, reply) => {
    return reply.send(await sessionService.listInterviews());
  });

  app.post("/api/admin/interviews", async (request, reply) => {
    const body = (request.body ?? {}) as CreateInterviewRequest;
    return reply.send(await sessionService.createInterview(body));
  });
}
