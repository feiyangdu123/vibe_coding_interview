import type {
  UserRole,
  ProblemVisibility,
  ProblemType,
  InterviewStatus,
  EndReason,
  InterviewEventType,
  InterviewQuotaState,
  InterviewQuotaLedgerAction,
  InterviewQuotaLedgerReason
} from '@vibe/database';

export type {
  UserRole,
  ProblemVisibility,
  ProblemType,
  InterviewStatus,
  EndReason,
  InterviewEventType,
  InterviewQuotaState,
  InterviewQuotaLedgerAction,
  InterviewQuotaLedgerReason
};

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
  organizationName: string;
  organizationSlug?: string;
  username: string;
  password: string;
  email?: string;
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
  organizationId?: string;
  organizationName?: string;
  organizationSlug?: string;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
}

export interface OrganizationMember {
  id: string;
  username: string;
  email?: string;
  role: UserRole;
  createdAt?: string;
}

export interface CreateOrganizationUserDto {
  username: string;
  password: string;
  email?: string;
  role: UserRole;
}

export interface OrganizationApiKeyConfigSummary {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyMasked: string;
  modelId: string;
  isSelected: boolean;
  createdAt: string;
}

export interface CreateOrganizationApiKeyConfigDto {
  name: string;
  baseUrl: string;
  apiKey: string;
  modelId: string;
}

export interface UpdateOrganizationApiKeyConfigDto {
  name: string;
  baseUrl: string;
  apiKey?: string;
  modelId?: string;
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
  difficulty?: string;
  tags?: string[];
  positions?: string[];
  scoringRubric?: string;
}

export interface CreateCandidateDto {
  name: string;
  email: string;
  phone?: string;
}

export interface ProblemTemplateResponse {
  id: string;
  title: string;
  description: string;
  requirements: string;
  duration: number;
  problemType: ProblemType;
  difficulty?: string;
  tags?: string[];
  scoringRubric?: string;
  workDirTemplate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInterviewDto {
  positionName?: string;
  interviewerId?: string;
  problemId: string;
  scheduledStartAt: string;
  duration: number;
  candidateId?: string;
  newCandidate?: {
    name: string;
    email: string;
    phone?: string;
  };
}

export interface SubmitManualReviewDto {
  manualReviewScore?: number;
  manualReviewNotes?: string;
  manualReviewConclusion: string;
}

export interface SubmitReviewDecisionDto {
  decision: 'pass' | 'fail' | 'pending';
  notes?: string;
  score?: number;
}

export interface InterviewResponse {
  id: string;
  token: string;
  status: InterviewStatus;
  startTime?: Date;
  endTime?: Date;
  submittedAt?: Date;
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

export interface InterviewEventResponse {
  id: string;
  interviewId: string;
  eventType: InterviewEventType;
  metadata?: any;
  createdAt: Date;
}

export interface InterviewDraft {
  id: string;
  organizationId: string;
  createdById: string;
  positionName?: string;
  interviewerId?: string;
  problemId?: string;
  scheduledStartAt?: string;
  duration?: number;
  candidateMode?: 'existing' | 'new' | 'bulk';
  candidateId?: string;
  candidateIds?: string[];
  newCandidateName?: string;
  newCandidateEmail?: string;
  newCandidatePhone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BatchCreateInterviewDto {
  positionName?: string;
  interviewerId?: string;
  problemId: string;
  scheduledStartAt: string;
  duration: number;
  candidates: Array<{
    name: string;
    email: string;
    phone?: string;
  }>;
}

export interface InterviewQuotaSummary {
  totalGranted: number;
  reservedCount: number;
  consumedCount: number;
  availableCount: number;
}

export interface InterviewQuotaLedgerEntry {
  id: string;
  action: InterviewQuotaLedgerAction;
  reason: InterviewQuotaLedgerReason;
  deltaTotal: number;
  deltaReserved: number;
  deltaConsumed: number;
  totalAfter: number;
  reservedAfter: number;
  consumedAfter: number;
  availableAfter: number;
  createdAt: string;
  createdBy?: {
    id: string;
    username: string;
  } | null;
  interview?: {
    id: string;
    token: string;
    status: InterviewStatus;
    quotaState?: InterviewQuotaState | null;
    scheduledStartAt?: string | null;
    candidate?: {
      name: string;
      email: string;
    };
    interviewer?: {
      username: string;
    } | null;
  } | null;
}

export interface TriggerEvaluationResponse {
  message: string;
  status?: string;
}

export interface EvaluationDimension {
  name: string;
  maxScore: number;
  description: string;
}

export interface EvaluationCriteriaConfigResponse {
  id: string;
  problemType: ProblemType;
  displayName: string;
  description?: string;
  dimensions: EvaluationDimension[];
  promptTemplate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertEvaluationCriteriaConfigDto {
  displayName: string;
  description?: string;
  dimensions: EvaluationDimension[];
  promptTemplate?: string;
  isActive?: boolean;
}

export interface CreateProblemTemplateDto {
  title: string;
  description: string;
  requirements: string;
  scoringCriteria: any;
  workDirTemplate: string;
  duration: number;
  problemType?: ProblemType;
  difficulty?: string;
  tags?: string[];
  scoringRubric?: string;
}

export interface UpdateProblemTemplateDto {
  title?: string;
  description?: string;
  requirements?: string;
  scoringCriteria?: any;
  workDirTemplate?: string;
  duration?: number;
  problemType?: ProblemType;
  difficulty?: string;
  tags?: string[];
  scoringRubric?: string;
}

export * from './validation';
