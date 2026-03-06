export type InterviewStatus = 'pending' | 'in_progress' | 'completed' | 'expired';

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

export interface CreateProblemDto {
  title: string;
  description: string;
  requirements: string;
  scoringCriteria: any;
  workDirTemplate: string;
  duration: number;
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
