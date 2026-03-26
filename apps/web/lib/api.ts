import type { TriggerEvaluationResponse } from '@vibe/shared-types';

export const API_BASE = typeof window !== 'undefined'
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
    headers,
    cache: 'no-store'
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

/**
 * Connect to evaluation SSE stream.
 * Uses fetch + ReadableStream (not EventSource) because we need credentials.
 * Returns an abort function.
 */
export function connectEvaluationStream(
  interviewId: string,
  onData: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/interviews/${interviewId}/evaluation-stream`, {
        credentials: 'include',
        signal: controller.signal,
        cache: 'no-store'
      });

      if (!res.ok) {
        onError(`Stream request failed: ${res.status}`);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        onError('No response body');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6);
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'text') {
              onData(event.content);
            } else if (event.type === 'done') {
              onDone();
              return;
            } else if (event.type === 'error') {
              onError(event.content);
              return;
            }
          } catch {
            // ignore parse errors
          }
        }
      }

      // Stream ended without explicit done event
      onDone();
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      onError(err.message || 'Stream connection failed');
    }
  })();

  return () => controller.abort();
}
