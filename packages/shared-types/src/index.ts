export const sessionStatuses = [
  "CREATED",
  "READY",
  "RUNNING",
  "SUBMITTED",
  "EXPIRED",
  "ARCHIVED",
] as const;

export type SessionStatus = (typeof sessionStatuses)[number];

export const sessionRuntimeModes = [
  "opencode",
  "mock",
] as const;

export type SessionRuntimeMode = (typeof sessionRuntimeModes)[number];

export interface CandidateSummary {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  targetRole: string | null;
}

export interface ProblemSummary {
  id: string;
  title: string;
  durationMinutes: number;
  templatePath: string | null;
}

export interface ProblemDetail extends ProblemSummary {
  description: string;
}

export interface InterviewEntryView {
  interviewId: string;
  token: string;
  candidate: CandidateSummary;
  problem: ProblemDetail;
  sessionId: string;
  status: SessionStatus;
  runtimeMode: SessionRuntimeMode | null;
}

export interface SessionDetailView {
  sessionId: string;
  interviewId: string;
  status: SessionStatus;
  runtimeMode: SessionRuntimeMode | null;
  startedAt: string | null;
  expiresAt: string | null;
  endedAt: string | null;
  serverNow: string;
  remainingMs: number;
  candidate: CandidateSummary;
  problem: ProblemSummary;
  workspacePath: string | null;
}

export interface CandidateListItem extends CandidateSummary {
  createdAt: string;
}

export interface ProblemListItem extends ProblemDetail {
  createdAt: string;
}

export interface AdminInterviewListItem {
  interviewId: string;
  sessionId: string;
  token: string;
  status: SessionStatus;
  runtimeMode: SessionRuntimeMode | null;
  createdAt: string;
  startedAt: string | null;
  expiresAt: string | null;
  endedAt: string | null;
  candidate: CandidateSummary;
  problem: ProblemSummary;
}

export interface CreateCandidateRequest {
  name: string;
  email: string;
  phone?: string | null;
  targetRole?: string | null;
}

export interface UpdateCandidateRequest extends CreateCandidateRequest {}

export interface CreateProblemRequest {
  title: string;
  description: string;
  durationMinutes: number;
  templatePath?: string | null;
}

export interface UpdateProblemRequest extends CreateProblemRequest {}

export interface CreateInterviewRequest {
  candidateId: string;
  problemId: string;
}

export interface CreateInterviewResponse extends AdminInterviewListItem {
  interviewUrl: string;
}

export interface StartSessionRequest {
  templatePath?: string | null;
}

export interface EndSessionRequest {
  reason?: "submitted" | "expired" | "archived";
}
