import type {
  AdminInterviewListItem,
  CandidateListItem,
  InterviewEntryView,
  ProblemListItem,
  SessionDetailView,
} from "@vibe-interview/shared-types";
import { portalConfig } from "./config";

async function fetchFromControlPlane<T>(pathname: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${portalConfig.controlPlaneOrigin}${pathname}`, {
      cache: "no-store",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown network error";
    throw new Error(
      `无法连接到 control-plane（${portalConfig.controlPlaneOrigin}）。请确认后端服务已启动。原始错误：${reason}`,
    );
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Control plane request failed (${response.status}): ${detail}`);
  }

  return (await response.json()) as T;
}

export function getControlPlaneOrigin(): string {
  return portalConfig.controlPlaneOrigin;
}

export async function fetchInterview(token: string): Promise<InterviewEntryView> {
  return fetchFromControlPlane<InterviewEntryView>(`/api/interviews/${encodeURIComponent(token)}`);
}

export async function fetchSession(sessionId: string): Promise<SessionDetailView> {
  return fetchFromControlPlane<SessionDetailView>(
    `/api/sessions/${encodeURIComponent(sessionId)}`,
  );
}

export async function fetchAdminProblems(): Promise<ProblemListItem[]> {
  return fetchFromControlPlane<ProblemListItem[]>("/api/admin/problems");
}

export async function fetchAdminCandidates(): Promise<CandidateListItem[]> {
  return fetchFromControlPlane<CandidateListItem[]>("/api/admin/candidates");
}

export async function fetchAdminInterviews(): Promise<AdminInterviewListItem[]> {
  return fetchFromControlPlane<AdminInterviewListItem[]>("/api/admin/interviews");
}
