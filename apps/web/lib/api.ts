import type { TriggerEvaluationResponse } from '@vibe/shared-types';

const API_BASE = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:3001`
  : 'http://localhost:3001';

export async function apiFetch(endpoint: string, options?: RequestInit) {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>)
  };

  // Only set Content-Type if there's a body
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include', // 自动携带 cookie
    headers
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return res.json();
}

export async function downloadFile(endpoint: string) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error('Download failed');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const contentDisposition = response.headers.get('Content-Disposition');
  a.download = contentDisposition?.split('filename=')[1]?.replace(/"/g, '') || 'download.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function triggerInterviewEvaluation(
  interviewId: string
): Promise<TriggerEvaluationResponse> {
  return apiFetch(`/api/admin/interviews/${interviewId}/evaluate`, {
    method: 'POST'
  });
}
