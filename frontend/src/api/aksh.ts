import { apiClient, API_BASE_URL } from './client';
import type {
  AkshAnswerEdit,
  AkshApprovalDto,
  AkshAuditDto,
  AkshConfig,
  AkshDecisionResult,
  AkshSessionDto,
  AutonomyLevel,
} from '../types/aksh';

export interface AkshSseEvent {
  type: 'session' | 'plan' | 'status' | 'message' | 'approval-request' | 'ledger' | 'error' | 'done' | string;
  data: unknown;
}

export const akshApi = {
  getConfig: () =>
    apiClient.get<AkshConfig>('/aksh/config').then((res) => res.data),

  startSession: (goal: string, jobUrl?: string, autonomyLevel?: AutonomyLevel) =>
    apiClient
      .post<AkshSessionDto>('/aksh/sessions', { goal, jobUrl, autonomyLevel })
      .then((res) => res.data),

  getSessions: (activeOnly = true) =>
    apiClient
      .get<AkshSessionDto[]>('/aksh/sessions', { params: { activeOnly } })
      .then((res) => res.data),

  decideApproval: (id: string, approve: boolean, editedAnswers?: AkshAnswerEdit[]) =>
    apiClient
      .post<AkshDecisionResult>(`/aksh/approvals/${id}/decision`, { approve, editedAnswers })
      .then((res) => res.data),

  getAudit: (sessionId: string) =>
    apiClient.get<AkshAuditDto>(`/aksh/sessions/${sessionId}/audit`).then((res) => res.data),

  getApproval: async (sessionId: string): Promise<AkshApprovalDto | null> => {
    const audit = await akshApi.getAudit(sessionId);
    const pending = audit.approvals.filter((a) => a.status === 'Pending');
    return pending.length > 0 ? pending[pending.length - 1] : null;
  },
};

/** Streams one chat turn as SSE events. Throws on non-2xx before streaming. */
export async function* streamAkshTurn(
  sessionId: string,
  message: string,
  signal?: AbortSignal,
): AsyncGenerator<AkshSseEvent> {
  const token =
    localStorage.getItem('vedha_token') || localStorage.getItem('resumate_token');

  const res = await fetch(`${API_BASE_URL}/aksh/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message }),
    signal,
  });

  if (!res.ok || !res.body) {
    let detail = `Request failed (${res.status})`;
    try {
      const text = await res.text();
      if (text) detail = text.slice(0, 300);
    } catch {
      /* response unreadable; keep status detail */
    }
    throw new Error(detail);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventType = 'message';

  // Reader is always released (abort/error/completion) so a stopped turn
  // never leaves a locked reader behind.
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const dataLines: string[] = [];
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) eventType = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
        }
        // Multi-line data: lines join with \n per SSE (not concatenation),
        // so JSON payloads containing newlines survive intact.
        const data = dataLines.join('\n');
        if (data) {
          try {
            yield { type: eventType, data: JSON.parse(data) as unknown };
          } catch {
            /* heartbeat/keep-alive; ignore */
          }
        }
        eventType = 'message';
        boundary = buffer.indexOf('\n\n');
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* already closed; ignore */
    }
    reader.releaseLock();
  }
}

/** 3.8 Flash introductory pricing estimate: $0.75/M in + $3.75/M out (through Dec 2026). */
export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * 0.75 + outputTokens * 3.75) / 1_000_000;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}
