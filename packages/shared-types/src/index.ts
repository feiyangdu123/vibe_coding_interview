import type { UserRole, ProblemVisibility, ProblemType, InterviewStatus, EndReason } from '@vibe/database';

export type { UserRole, ProblemVisibility, ProblemType, InterviewStatus, EndReason };

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface LoginDto {
  username: string;
  password: string;
}

export interface RegisterDto {
  username: string;
  password: string;
  email?: string;
  role: UserRole;
  organizationId: string;
}

export interface AuthResponse {
  user: SessionUser;
  sessionToken: string;
}

export interface SessionUser {
  id: string;
  username: string;
  email?: string;
  role: UserRole;
  organizationId: string;
  organizationName?: string;
}

export interface CreateProblemDto {
  title: string;
  description: string;
  requirements: string;
  scoringCriteria: any;
  workDirTemplate: string;
  duration: number;

  // 新增字段
  visibility?: ProblemVisibility;
  problemType?: ProblemType;
  roleTrack?: string;
  difficulty?: string;
  language?: string;
  tags?: string[];
  evaluationInstructionsText?: string;
  acceptanceCriteria?: any;
}

export interface CreateCandidateDto {
  name: string;
  email: string;
  phone?: string;
}

export interface CreateInterviewDto {
  candidateId: string;
  problemId: string;
  duration: number;
}

export interface SubmitManualReviewDto {
  manualReviewScore?: number;
  manualReviewNotes?: string;
  manualReviewConclusion: string;
}

export interface InterviewResponse {
  id: string;
  token: string;
  status: InterviewStatus;
  startTime?: Date;
  endTime?: Date;
  port?: number;
  candidate: {
    name: string;
    email: string;
  };
  problem: {
    title: string;
    description: string;
    requirements: string;
    scoringCriteria: any;
  };
}

export * from './validation';
