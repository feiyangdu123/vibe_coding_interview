import { randomBytes } from "node:crypto";
import {
  prisma,
  Prisma,
  type Candidate,
  type Problem,
  type ProblemDifficulty as PrismaProblemDifficulty,
  type ProblemType as PrismaProblemType,
  type SessionRuntimeMode as PrismaSessionRuntimeMode,
} from "@vibe-interview/db";
import { problemDifficulties } from "@vibe-interview/shared-types";
import type {
  AdminInterviewListItem,
  CandidateListItem,
  CandidateSummary,
  CreateCandidateRequest,
  CreateInterviewRequest,
  CreateInterviewResponse,
  CreateProblemRequest,
  EndSessionRequest,
  InterviewEntryView,
  ProblemDifficulty,
  ProblemDetail,
  ProblemListItem,
  ProblemSummary,
  ProblemType,
  SessionDetailView,
  SessionRuntimeMode,
  SessionStatus,
  StartSessionRequest,
  UpdateCandidateRequest,
  UpdateProblemRequest,
} from "@vibe-interview/shared-types";
import type { WorkspaceProvider } from "@vibe-interview/workspace-core";

type CandidateRecord = Candidate;
type ProblemRecord = Problem;
type InterviewWithAdminRelations = Prisma.InterviewGetPayload<{
  include: {
    candidate: true;
    problem: true;
    token: true;
    session: true;
  };
}>;
type SessionWithRelations = Prisma.SessionGetPayload<{
  include: {
    interview: {
      include: {
        candidate: true;
        problem: true;
        token: true;
      };
    };
  };
}>;
type SessionProxyResult =
  | {
      kind: "ready";
      target: string;
      username: string;
      password: string;
      status: SessionStatus;
    }
  | {
      kind: "blocked";
      status: SessionStatus;
      reason: string;
    };

interface HttpError extends Error {
  statusCode: number;
}

export class SessionService {
  public constructor(
    private readonly workspaceProvider: WorkspaceProvider,
    private readonly defaultTemplatePath: string | null,
    private readonly portalOrigin: string,
  ) {}

  public async listProblems(): Promise<ProblemListItem[]> {
    const problems = await prisma.problem.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return problems.map((problem) => this.toProblemListItem(problem));
  }

  public async createProblem(payload: CreateProblemRequest): Promise<ProblemListItem> {
    const data = this.normalizeProblemPayload(payload);
    const created = await prisma.problem.create({
      data,
    });

    return this.toProblemListItem(created);
  }

  public async updateProblem(problemId: string, payload: UpdateProblemRequest): Promise<ProblemListItem> {
    await this.ensureProblemExists(problemId);

    const updated = await prisma.problem.update({
      where: {
        id: problemId,
      },
      data: this.normalizeProblemPayload(payload),
    });

    return this.toProblemListItem(updated);
  }

  public async deleteProblem(problemId: string): Promise<ProblemListItem> {
    const problem = await this.ensureProblemExists(problemId);
    const deletedAt = new Date();

    const updated = await prisma.problem.update({
      where: {
        id: problemId,
      },
      data: {
        deletedAt,
      },
    });

    await this.writeAuditLogsForProblem(problem.id, deletedAt);
    return this.toProblemListItem(updated);
  }

  public async listCandidates(): Promise<CandidateListItem[]> {
    const candidates = await prisma.candidate.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return candidates.map((candidate) => this.toCandidateListItem(candidate));
  }

  public async createCandidate(payload: CreateCandidateRequest): Promise<CandidateListItem> {
    const data = this.normalizeCandidatePayload(payload);
    const created = await prisma.candidate.create({
      data,
    });

    return this.toCandidateListItem(created);
  }

  public async updateCandidate(
    candidateId: string,
    payload: UpdateCandidateRequest,
  ): Promise<CandidateListItem> {
    await this.ensureCandidateExists(candidateId);

    const updated = await prisma.candidate.update({
      where: {
        id: candidateId,
      },
      data: this.normalizeCandidatePayload(payload),
    });

    return this.toCandidateListItem(updated);
  }

  public async deleteCandidate(candidateId: string): Promise<CandidateListItem> {
    const candidate = await this.ensureCandidateExists(candidateId);
    const deletedAt = new Date();

    const updated = await prisma.candidate.update({
      where: {
        id: candidateId,
      },
      data: {
        deletedAt,
      },
    });

    await this.writeAuditLogsForCandidate(candidate.id, deletedAt);
    return this.toCandidateListItem(updated);
  }

  public async listInterviews(): Promise<AdminInterviewListItem[]> {
    const interviews = await prisma.interview.findMany({
      include: {
        candidate: true,
        problem: true,
        token: true,
        session: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return interviews.map((interview) => this.toAdminInterviewListItem(interview));
  }

  public async createInterview(payload: CreateInterviewRequest): Promise<CreateInterviewResponse> {
    const candidateId = this.requireString(payload.candidateId, "候选人不能为空。");
    const problemId = this.requireString(payload.problemId, "题目不能为空。");

    const created = await prisma.$transaction(async (tx) => {
      const candidate = await tx.candidate.findFirst({
        where: {
          id: candidateId,
          deletedAt: null,
        },
      });
      const problem = await tx.problem.findFirst({
        where: {
          id: problemId,
          deletedAt: null,
        },
      });

      if (!candidate) {
        throw this.createHttpError(404, "候选人不存在。");
      }

      if (!problem) {
        throw this.createHttpError(404, "题目不存在。");
      }

      const interview = await tx.interview.create({
        data: {
          candidateId: candidate.id,
          problemId: problem.id,
          token: {
            create: {
              token: this.generateToken(),
            },
          },
          session: {
            create: {
              status: "CREATED",
            },
          },
        },
        include: {
          candidate: true,
          problem: true,
          token: true,
          session: true,
        },
      });

      if (interview.session) {
        await tx.sessionAuditLog.create({
          data: {
            sessionId: interview.session.id,
            action: "interview_created",
            detail: {
              candidateId: candidate.id,
              problemId: problem.id,
              token: interview.token?.token ?? null,
            },
          },
        });
      }

      return interview;
    });

    const interviewUrl = `${this.portalOrigin.replace(/\/$/, "")}/interview/${created.token?.token ?? ""}`;

    return {
      ...this.toAdminInterviewListItem(created),
      interviewUrl,
    };
  }

  public async getInterviewByToken(token: string): Promise<InterviewEntryView> {
    const interviewToken = await prisma.interviewToken.findUnique({
      where: {
        token,
      },
      include: {
        interview: {
          include: {
            candidate: true,
            problem: true,
            session: true,
          },
        },
      },
    });

    if (!interviewToken?.interview.session) {
      throw this.createHttpError(404, "面试链接不存在。");
    }

    if (interviewToken.expiresAt && interviewToken.expiresAt <= new Date()) {
      throw this.createHttpError(410, "面试链接已过期。");
    }

    const session = await this.refreshExpiredSession(
      await this.loadSessionOrThrow(interviewToken.interview.session.id),
    );

    return {
      interviewId: interviewToken.interview.id,
      token: interviewToken.token,
      candidate: this.toCandidateSummary(interviewToken.interview.candidate),
      problem: this.toProblemDetail(interviewToken.interview.problem),
      sessionId: session.id,
      status: session.status,
      runtimeMode: this.toRuntimeMode(session.runtimeMode),
    };
  }

  public async getSession(sessionId: string): Promise<SessionDetailView> {
    const session = await this.refreshExpiredSession(await this.loadSessionOrThrow(sessionId));
    return this.toSessionDetailView(session);
  }

  public async startSession(
    sessionId: string,
    payload: StartSessionRequest = {},
  ): Promise<SessionDetailView> {
    const initialSession = await this.refreshExpiredSession(await this.loadSessionOrThrow(sessionId));
    const shouldRecoverRuntime =
      this.hasRuntimeConfig(initialSession) && !this.isRuntimeActive(initialSession);

    if (this.hasRuntimeConfig(initialSession) && !shouldRecoverRuntime) {
      return this.toSessionDetailView(initialSession);
    }

    if (this.isTerminalStatus(initialSession.status)) {
      return this.toSessionDetailView(initialSession);
    }

    const templatePath =
      payload.templatePath ??
      initialSession.interview.problem.templatePath ??
      this.defaultTemplatePath;
    const workspacePath = await this.workspaceProvider.prepareSessionWorkspace({
      sessionId,
      templatePath,
      existingWorkspacePath: shouldRecoverRuntime ? initialSession.workspacePath : null,
      preferredPort: shouldRecoverRuntime ? this.parseRuntimePort(initialSession.opencodeUrl) : null,
      username: shouldRecoverRuntime ? initialSession.opencodeUsername : null,
      password: shouldRecoverRuntime ? initialSession.opencodePassword : null,
    });
    const handle = await this.workspaceProvider.startOpenCodeWebProcess({ sessionId });
    const now = new Date();
    const expiresAt = shouldRecoverRuntime && initialSession.expiresAt
      ? initialSession.expiresAt
      : new Date(now.getTime() + initialSession.interview.problem.durationMin * 60_000);

    await prisma.$transaction(async (tx) => {
      await tx.session.update({
        where: {
          id: sessionId,
        },
        data: {
          status: "RUNNING",
          workspacePath,
          opencodeUrl: handle.endpoint,
          opencodeUsername: handle.username,
          opencodePassword: handle.password,
          runtimeMode: handle.mode,
          startedAt: initialSession.startedAt ?? now,
          expiresAt,
          endedAt: null,
        },
      });

      await tx.interviewToken.updateMany({
        where: {
          interviewId: initialSession.interviewId,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      });

      await tx.sessionAuditLog.create({
        data: {
          sessionId,
          action: shouldRecoverRuntime ? "session_runtime_recovered" : "session_started",
          detail: {
            runtimeMode: handle.mode,
            workspacePath,
            expiresAt: expiresAt.toISOString(),
            recovered: shouldRecoverRuntime,
          },
        },
      });
    });

    return this.getSession(sessionId);
  }

  public async endSession(
    sessionId: string,
    payload: EndSessionRequest = {},
  ): Promise<SessionDetailView> {
    const session = await this.loadSessionOrThrow(sessionId);

    if (!this.isTerminalStatus(session.status)) {
      await this.workspaceProvider.cleanupSessionWorkspace(sessionId);
    }

    const nextStatus = this.resolveEndStatus(payload.reason);
    const endedAt = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.session.update({
        where: {
          id: sessionId,
        },
        data: {
          status: nextStatus,
          endedAt,
        },
      });

      await tx.sessionAuditLog.create({
        data: {
          sessionId,
          action: "session_ended",
          detail: {
            reason: payload.reason ?? "submitted",
            endedAt: endedAt.toISOString(),
          },
        },
      });
    });

    return this.getSession(sessionId);
  }

  public async getProxyConfig(sessionId: string): Promise<SessionProxyResult> {
    let session = await this.refreshExpiredSession(await this.loadSessionOrThrow(sessionId));

    if (this.hasRuntimeConfig(session) && !this.isRuntimeActive(session)) {
      const recoveredSession = await this.tryRecoverRuntime(sessionId);

      if (recoveredSession) {
        session = recoveredSession;
      }
    }

    if (session.status !== "RUNNING") {
      return {
        kind: "blocked",
        status: session.status,
        reason: "当前面试未处于进行中状态。",
      };
    }

    if (!this.hasRuntimeConfig(session)) {
      return {
        kind: "blocked",
        status: session.status,
        reason: "编程环境尚未准备完成。",
      };
    }

    if (!this.isRuntimeActive(session)) {
      return {
        kind: "blocked",
        status: session.status,
        reason: "编程环境未连接。请返回面试状态页后重新点击“打开编程环境”。",
      };
    }

    return {
      kind: "ready",
      target: session.opencodeUrl!,
      username: session.opencodeUsername!,
      password: session.opencodePassword!,
      status: session.status,
    };
  }

  private async tryRecoverRuntime(sessionId: string): Promise<SessionWithRelations | null> {
    try {
      await this.startSession(sessionId);
      return this.refreshExpiredSession(await this.loadSessionOrThrow(sessionId));
    } catch {
      return null;
    }
  }

  private async loadSessionOrThrow(sessionId: string): Promise<SessionWithRelations> {
    const session = await prisma.session.findUnique({
      where: {
        id: sessionId,
      },
      include: {
        interview: {
          include: {
            candidate: true,
            problem: true,
            token: true,
          },
        },
      },
    });

    if (!session) {
      throw this.createHttpError(404, "场次不存在。");
    }

    return session;
  }

  private async refreshExpiredSession(session: SessionWithRelations): Promise<SessionWithRelations> {
    if (
      session.status === "RUNNING" &&
      session.expiresAt &&
      session.expiresAt.getTime() <= Date.now()
    ) {
      await this.endSession(session.id, { reason: "expired" });
      return this.loadSessionOrThrow(session.id);
    }

    return session;
  }

  private hasRuntimeConfig(session: SessionWithRelations): boolean {
    return (
      session.status === "RUNNING" &&
      Boolean(session.opencodeUrl) &&
      Boolean(session.opencodeUsername) &&
      Boolean(session.opencodePassword)
    );
  }

  private isRuntimeActive(session: SessionWithRelations): boolean {
    if (!this.hasRuntimeConfig(session)) {
      return false;
    }

    return this.workspaceProvider.getSessionEndpoint(session.id) === session.opencodeUrl;
  }

  private parseRuntimePort(runtimeUrl: string | null): number | null {
    if (!runtimeUrl) {
      return null;
    }

    try {
      const parsed = Number.parseInt(new URL(runtimeUrl).port, 10);
      return Number.isNaN(parsed) ? null : parsed;
    } catch {
      return null;
    }
  }

  private async ensureCandidateExists(candidateId: string): Promise<CandidateRecord> {
    const candidate = await prisma.candidate.findFirst({
      where: {
        id: candidateId,
        deletedAt: null,
      },
    });

    if (!candidate) {
      throw this.createHttpError(404, "候选人不存在。");
    }

    return candidate;
  }

  private async ensureProblemExists(problemId: string): Promise<ProblemRecord> {
    const problem = await prisma.problem.findFirst({
      where: {
        id: problemId,
        deletedAt: null,
      },
    });

    if (!problem) {
      throw this.createHttpError(404, "题目不存在。");
    }

    return problem;
  }

  private async writeAuditLogsForCandidate(candidateId: string, deletedAt: Date): Promise<void> {
    const sessions = await prisma.session.findMany({
      where: {
        interview: {
          candidateId,
        },
      },
      select: {
        id: true,
      },
    });

    if (sessions.length === 0) {
      return;
    }

    await prisma.sessionAuditLog.createMany({
      data: sessions.map((session) => ({
        sessionId: session.id,
        action: "candidate_deleted",
        detail: {
          candidateId,
          deletedAt: deletedAt.toISOString(),
        },
      })),
    });
  }

  private async writeAuditLogsForProblem(problemId: string, deletedAt: Date): Promise<void> {
    const sessions = await prisma.session.findMany({
      where: {
        interview: {
          problemId,
        },
      },
      select: {
        id: true,
      },
    });

    if (sessions.length === 0) {
      return;
    }

    await prisma.sessionAuditLog.createMany({
      data: sessions.map((session) => ({
        sessionId: session.id,
        action: "problem_deleted",
        detail: {
          problemId,
          deletedAt: deletedAt.toISOString(),
        },
      })),
    });
  }

  private normalizeCandidatePayload(
    payload: CreateCandidateRequest | UpdateCandidateRequest,
  ): Prisma.CandidateUncheckedCreateInput {
    return {
      name: this.requireString(payload.name, "姓名不能为空。"),
      email: this.requireString(payload.email, "邮箱不能为空。"),
      phone: this.toOptionalString(payload.phone),
      targetRole: this.toOptionalString(payload.targetRole),
    };
  }

  private normalizeProblemPayload(
    payload: CreateProblemRequest | UpdateProblemRequest,
  ): Prisma.ProblemUncheckedCreateInput {
    const durationValue =
      typeof payload.durationMinutes === "number"
        ? payload.durationMinutes
        : Number.parseInt(String(payload.durationMinutes), 10);
    const difficulty = this.parseProblemDifficulty(payload.difficulty);

    if (!Number.isFinite(durationValue) || durationValue <= 0) {
      throw this.createHttpError(400, "面试时长必须是正整数。");
    }

    return {
      title: this.requireString(payload.title, "题目标题不能为空。"),
      description: this.requireString(payload.description, "题目说明不能为空。"),
      type: "PRACTICAL",
      difficulty,
      durationMin: Math.round(durationValue),
      templatePath: this.toOptionalString(payload.templatePath),
    };
  }

  private resolveEndStatus(reason: EndSessionRequest["reason"]): SessionStatus {
    if (reason === "expired") {
      return "EXPIRED";
    }

    if (reason === "archived") {
      return "ARCHIVED";
    }

    return "SUBMITTED";
  }

  private isTerminalStatus(status: SessionStatus): boolean {
    return status === "SUBMITTED" || status === "EXPIRED" || status === "ARCHIVED";
  }

  private toCandidateSummary(candidate: CandidateRecord): CandidateSummary {
    return {
      id: candidate.id,
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone,
      targetRole: candidate.targetRole,
    };
  }

  private toCandidateListItem(candidate: CandidateRecord): CandidateListItem {
    return {
      ...this.toCandidateSummary(candidate),
      createdAt: candidate.createdAt.toISOString(),
      updatedAt: candidate.updatedAt.toISOString(),
    };
  }

  private toProblemSummary(problem: ProblemRecord): ProblemSummary {
    return {
      id: problem.id,
      title: problem.title,
      type: this.toProblemType(problem.type),
      difficulty: this.toProblemDifficulty(problem.difficulty),
      durationMinutes: problem.durationMin,
      templatePath: problem.templatePath,
    };
  }

  private toProblemDetail(problem: ProblemRecord): ProblemDetail {
    return {
      ...this.toProblemSummary(problem),
      description: problem.description,
    };
  }

  private toProblemListItem(problem: ProblemRecord): ProblemListItem {
    return {
      ...this.toProblemDetail(problem),
      createdAt: problem.createdAt.toISOString(),
      updatedAt: problem.updatedAt.toISOString(),
    };
  }

  private toAdminInterviewListItem(interview: InterviewWithAdminRelations): AdminInterviewListItem {
    if (!interview.token || !interview.session) {
      throw this.createHttpError(500, "面试记录缺少 token 或 session。");
    }

    return {
      interviewId: interview.id,
      sessionId: interview.session.id,
      token: interview.token.token,
      status: interview.session.status,
      runtimeMode: this.toRuntimeMode(interview.session.runtimeMode),
      createdAt: interview.createdAt.toISOString(),
      startedAt: interview.session.startedAt?.toISOString() ?? null,
      expiresAt: interview.session.expiresAt?.toISOString() ?? null,
      endedAt: interview.session.endedAt?.toISOString() ?? null,
      candidate: this.toCandidateSummary(interview.candidate),
      problem: this.toProblemSummary(interview.problem),
    };
  }

  private toSessionDetailView(session: SessionWithRelations): SessionDetailView {
    const now = new Date();
    const remainingMs =
      session.status === "RUNNING" && session.expiresAt
        ? Math.max(0, session.expiresAt.getTime() - now.getTime())
        : 0;

    return {
      sessionId: session.id,
      interviewId: session.interviewId,
      status: session.status,
      runtimeMode: this.toRuntimeMode(session.runtimeMode),
      startedAt: session.startedAt?.toISOString() ?? null,
      expiresAt: session.expiresAt?.toISOString() ?? null,
      endedAt: session.endedAt?.toISOString() ?? null,
      serverNow: now.toISOString(),
      remainingMs,
      candidate: this.toCandidateSummary(session.interview.candidate),
      problem: this.toProblemSummary(session.interview.problem),
      workspacePath: session.workspacePath,
    };
  }

  private toRuntimeMode(value: PrismaSessionRuntimeMode | null): SessionRuntimeMode | null {
    if (!value) {
      return null;
    }

    return value;
  }

  private parseProblemDifficulty(value: string): PrismaProblemDifficulty {
    if (problemDifficulties.includes(value as ProblemDifficulty)) {
      return value as PrismaProblemDifficulty;
    }

    throw this.createHttpError(400, "题目难度不合法。");
  }

  private toProblemType(value: PrismaProblemType): ProblemType {
    return value;
  }

  private toProblemDifficulty(value: PrismaProblemDifficulty): ProblemDifficulty {
    return value;
  }

  private createHttpError(statusCode: number, message: string): HttpError {
    const error = new Error(message) as HttpError;
    error.statusCode = statusCode;
    return error;
  }

  private generateToken(): string {
    return randomBytes(18).toString("base64url");
  }

  private requireString(value: string | undefined | null, message: string): string {
    const normalized = value?.trim();

    if (!normalized) {
      throw this.createHttpError(400, message);
    }

    return normalized;
  }

  private toOptionalString(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }
}
