import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDashed,
  Loader2,
  Lock,
  Plus,
  ReceiptText,
  Send,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';
import { akshApi, estimateCostUsd, formatTokens, streamAkshTurn } from '../api/aksh';
import { orchestratorApi } from '../api';
import type {
  AkshApprovalDto,
  AkshSessionDto,
  AkshSessionStatus,
  AutonomyLevel,
} from '../types/aksh';
import type { ApplicationQueueItemDto as QueueItemDto } from '../types/orchestrator';
import { AkshMark } from '../components/aksh/AkshMark';
import { Markdown } from '../components/aksh/Markdown';

interface ChatBubble {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
}

interface AkshActiveSkill {
  id: string;
  name: string;
  description: string;
}

const STATUS_STYLE: Record<AkshSessionStatus, string> = {
  Planning: 'bg-sky-500/10 text-sky-300 border-sky-500/25',
  Executing: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25',
  AwaitingApproval: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
  Paused: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/25',
  Completed: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
  Failed: 'bg-rose-500/10 text-rose-300 border-rose-500/25',
  Cancelled: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/25',
};

const eyebrow =
  'font-mono-tech text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6c707d]';

const card = 'rounded-2xl bg-[#111216] border border-[#23252b]';

let bubbleSeq = 0;
const nextBubbleId = () => `b${Date.now()}-${(bubbleSeq += 1)}`;

export const AskAkshPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [autonomy, setAutonomy] = useState<AutonomyLevel>('Supervised');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [thread, setThread] = useState<ChatBubble[]>([]);
  const [composer, setComposer] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'error' | 'info' | 'success'; text: string } | null>(null);
  const [pendingApproval, setPendingApproval] = useState<AkshApprovalDto | null>(null);
  const [queueItem, setQueueItem] = useState<QueueItemDto | null>(null);
  const [answerEdits, setAnswerEdits] = useState<Record<number, string>>({});
  const [deciding, setDeciding] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  // Live ledger totals from the current stream (authoritative mid-turn);
  // falls back to session totals when idle.
  const [liveSpend, setLiveSpend] = useState<{ input: number; output: number } | null>(null);
  const [activeSkill, setActiveSkill] = useState<AkshActiveSkill | null>(null);
  // Generation guard: async approval fetches that resolve after a session
  // switch or a newer fetch must never overwrite the current gate.
  const approvalReqSeq = useRef(0);
  const sessionIdRef = useRef<string | null>(null);
  sessionIdRef.current = sessionId;
  const pendingApprovalRef = useRef<AkshApprovalDto | null>(null);
  pendingApprovalRef.current = pendingApproval;
  const abortRef = useRef<AbortController | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const { data: config } = useQuery({ queryKey: ['akshConfig'], queryFn: akshApi.getConfig });
  const { data: sessions } = useQuery({
    queryKey: ['akshSessions'],
    queryFn: () => akshApi.getSessions(true),
    refetchInterval: 8000,
  });
  const { data: audit } = useQuery({
    queryKey: ['akshAudit', sessionId],
    queryFn: () => akshApi.getAudit(sessionId as string),
    enabled: !!sessionId,
  });

  const session: AkshSessionDto | null =
    sessions?.find((s) => s.id === sessionId) ?? audit?.session ?? null;

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [thread]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const spend = useMemo(() => {
    // Live ledger totals win mid-turn; session rollups when idle.
    const input = liveSpend?.input ?? session?.tokenInputTotal ?? 0;
    const output = liveSpend?.output ?? session?.tokenOutputTotal ?? 0;
    return { input, output, usd: estimateCostUsd(input, output), live: liveSpend !== null };
  }, [session, liveSpend]);

  const loadApprovalContext = async (approval: AkshApprovalDto) => {
    setPendingApproval(approval);
    setAnswerEdits({});
    if (approval.queueItemId) {
      try {
        const item = await orchestratorApi.getQueueItem(approval.queueItemId);
        setQueueItem(item);
      } catch {
        setQueueItem(null);
      }
    } else {
      setQueueItem(null);
    }
  };

  const sendMessage = async (e?: React.FormEvent, directText?: string) => {
    e?.preventDefault();
    const raw = directText ?? composer;
    if (streaming || !raw.trim()) return;
    const text = raw.trim();
    setComposer('');
    setNotice(null);
    setLiveSpend(null);
    setThread((prev) => [...prev, { id: nextBubbleId(), text, role: 'user' }]);
    setStreaming(true);

    let turnSessionId = sessionId;
    if (!turnSessionId) {
      try {
        const created = await akshApi.startSession(text.slice(0, 100), undefined, autonomy);
        queryClient.invalidateQueries({ queryKey: ['akshSessions'] });
        turnSessionId = created.id;
        setSessionId(created.id);
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          (err as Error)?.message ||
          'Could not initialize conversation.';
        setNotice({ kind: 'error', text: message });
        setStreaming(false);
        return;
      }
    }

    const assistantId = nextBubbleId();
    setThread((prev) => [...prev, { id: assistantId, role: 'assistant', text: '' }]);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      for await (const evt of streamAkshTurn(turnSessionId, text, controller.signal)) {
        if (evt.type === 'skill') {
          const data = evt.data as AkshActiveSkill;
          if (data?.id && data?.name) {
            setActiveSkill(data);
          }
        } else if (evt.type === 'message') {
          const delta = (evt.data as { delta?: string })?.delta ?? '';
          if (delta) {
            setThread((prev) =>
              prev.map((b) => (b.id === assistantId ? { ...b, text: b.text + delta } : b)),
            );
          }
        } else if (evt.type === 'approval-request') {
          const data = evt.data as { id?: string; sessionId?: string };
          if (data?.sessionId && data.sessionId === sessionIdRef.current) {
            const seq = ++approvalReqSeq.current;
            const approval = await akshApi.getApproval(data.sessionId);
            if (seq !== approvalReqSeq.current || data.sessionId !== sessionIdRef.current) return;
            if (approval) {
              await loadApprovalContext(approval);
              if (seq !== approvalReqSeq.current || data.sessionId !== sessionIdRef.current) return;
              setThread((prev) => [
                ...prev,
                {
                  id: nextBubbleId(),
                  role: 'system',
                  text: `Review gate opened for ${approval.toolName}. Inspect the package, edit answers if needed, then approve or reject.`,
                },
              ]);
            }
          }
        } else if (evt.type === 'ledger') {
          const data = evt.data as { inputTokens?: number; outputTokens?: number };
          if (typeof data?.inputTokens === 'number' || typeof data?.outputTokens === 'number') {
            setLiveSpend({ input: data.inputTokens ?? 0, output: data.outputTokens ?? 0 });
          }
        } else if (evt.type === 'plan' || evt.type === 'status' || evt.type === 'session') {
          queryClient.invalidateQueries({ queryKey: ['akshSessions'] });
        } else if (evt.type === 'error') {
          const data = evt.data as { reasonCode?: string; message?: string };
          if (data?.reasonCode === 'budget_breach') {
            queryClient.invalidateQueries({ queryKey: ['akshSessions'] });
            if (turnSessionId) queryClient.invalidateQueries({ queryKey: ['akshAudit', turnSessionId] });
          }
          setNotice({ kind: 'error', text: data?.message ?? 'The turn was interrupted.' });
        } else if (evt.type === 'done') {
          queryClient.invalidateQueries({ queryKey: ['akshSessions'] });
          queryClient.invalidateQueries({ queryKey: ['akshAudit', turnSessionId] });
        }
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        // Honest abort state: drop the empty bubble, or mark it interrupted.
        setThread((prev) => {
          const target = prev.find((b) => b.id === assistantId);
          if (!target) return prev;
          if (!target.text) return prev.filter((b) => b.id !== assistantId);
          return prev.map((b) =>
            b.id === assistantId ? { ...b, text: `${b.text}\n\n[Interrupted — partial response kept]` } : b,
          );
        });
      } else {
        setNotice({
          kind: 'error',
          text: (err as Error)?.message ?? 'Streaming failed.',
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const decideMutation = useMutation({
    mutationFn: ({ id, approve, edits }: { id: string; approve: boolean; edits?: { question: string; answer: string }[] }) =>
      akshApi.decideApproval(id, approve, edits),
    onSuccess: (result, variables) => {
      // Ignore late completions after the gate moved on (session switch or
      // a newer decision): they must not rewrite thread/notice/gate state.
      if (variables.id !== pendingApprovalRef.current?.id) return;
      setDeciding(false);
      setDecidingId(null);
      queryClient.invalidateQueries({ queryKey: ['akshSessions'] });
      if (sessionId) queryClient.invalidateQueries({ queryKey: ['akshAudit', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['orchestratorQueue'] });
      if (result.approved && (result.queueStatus === 'Submitted' || result.reasonCode === 'submitted')) {
        setPendingApproval(null);
        setQueueItem(null);
        setThread((prev) => [
          ...prev,
          { id: nextBubbleId(), role: 'system', text: result.message || 'Application submitted.' },
        ]);
        setNotice({ kind: 'success', text: result.message || 'Application submitted.' });
      } else if (!result.approved) {
        // Distinguish rejection vs expiry vs retryable blocks (governor cap,
        // superseded package, retryable execution failure): the message carries
        // the reason, and the gate re-syncs below instead of vanishing.
        setNotice({ kind: result.reasonCode === 'rejected' ? 'info' : 'error', text: result.message });
        if (sessionId) {
          const seq = ++approvalReqSeq.current;
          const forSession = sessionId;
          void akshApi.getApproval(forSession).then((approval) => {
            if (seq !== approvalReqSeq.current || forSession !== sessionIdRef.current) return;
            setPendingApproval(approval);
            if (!approval) setQueueItem(null);
          });
        } else {
          setPendingApproval(null);
        }
      } else {
        setNotice({ kind: 'info', text: result.message });
        if (sessionId) {
          const seq = ++approvalReqSeq.current;
          const forSession = sessionId;
          void akshApi.getApproval(forSession).then((approval) => {
            if (seq !== approvalReqSeq.current || forSession !== sessionIdRef.current) return;
            setPendingApproval(approval);
          });
        }
      }
    },
    onError: (err: unknown) => {
      setDeciding(false);
      setDecidingId(null);
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Could not record the decision.';
      setNotice({ kind: 'error', text: message });
    },
  });

  const handleDecide = (approve: boolean) => {
    if (!pendingApproval || deciding) return;
    const id = pendingApproval.id;
    setDeciding(true);
    setDecidingId(id);
    const edits =
      approve && queueItem
        ? queueItem.prefilledAnswers.map((a, i) => ({
            question: a.questionText,
            answer: answerEdits[i] ?? a.answerText,
          }))
        : undefined;
    decideMutation.mutate({ id, approve, edits });
  };

  const switchSession = (id: string | null) => {
    approvalReqSeq.current++;
    abortRef.current?.abort();
    setStreaming(false);
    setSessionId(id);
    setThread([]);
    setPendingApproval(null);
    setQueueItem(null);
    setNotice(null);
    setLiveSpend(null);
    setActiveSkill(null);
    if (id) {
      const seq = approvalReqSeq.current;
      void akshApi.getApproval(id).then((approval) => {
        if (seq !== approvalReqSeq.current || id !== sessionIdRef.current) return;
        if (approval) void loadApprovalContext(approval);
      });
    }
  };

  return (
    <div className="flex flex-col gap-5 font-sans text-[#e2e4e9] max-w-6xl">
      {/* Sleek App Header */}
      <div className={`${card} p-4 sm:p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AkshMark size={38} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-tight">Ask Aksh</h1>
                <span className="rounded-full bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">
                  Career Copilot
                </span>
              </div>
              <p className="text-xs text-[#8e929b]">
                Resume tailoring, interview coaching, salary negotiation & applications.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            {/* Autonomy Selector */}
            <div className="flex items-center gap-1.5 rounded-xl border border-[#2a2d36] bg-[#16181e] px-2.5 py-1.5 text-xs text-white">
              <span className="text-[#8e929b] text-[11px]">Gate:</span>
              <select
                value={autonomy}
                onChange={(e) => setAutonomy(e.target.value as AutonomyLevel)}
                className="bg-transparent text-xs text-white font-medium outline-none cursor-pointer"
                title="Supervised requires your review and approval before any external application action."
              >
                <option value="Supervised" className="bg-[#16181e]">Supervised</option>
                <option value="SupervisedAuto" className="bg-[#16181e]">SupervisedAuto</option>
              </select>
            </div>

            {/* New Chat Button */}
            <button
              onClick={() => switchSession(null)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              New Chat
            </button>
          </div>
        </div>

        {config && !config.enabled && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3.5 py-2.5 text-xs text-amber-200">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Aksh is disabled on this deployment (<span className="font-mono">Aksh:Enabled=false</span>).
              Turns will be refused until an operator enables it.
            </span>
          </div>
        )}
      </div>

      {notice && (
        <div
          className={`rounded-xl border px-3.5 py-2.5 text-xs ${
            notice.kind === 'error'
              ? 'border-rose-500/30 bg-rose-500/5 text-rose-200'
              : notice.kind === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200'
                : 'border-sky-500/30 bg-sky-500/5 text-sky-200'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Main grid */}
      <div className="grid gap-5 xl:grid-cols-3">
        {/* Chat thread */}
        <section className={`${card} xl:col-span-2 flex min-h-[480px] flex-col overflow-hidden`}>
          <div className="flex items-center gap-2.5 border-b border-[#23252b] px-5 py-3.5">
            <span className={eyebrow}>Thread</span>
            {activeSkill && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-medium text-indigo-300"
                title={activeSkill.description}
              >
                <Sparkles className="w-3 h-3 text-indigo-400" />
                <span>Skill: {activeSkill.name}</span>
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <select
                value={sessionId ?? ''}
                onChange={(e) => switchSession(e.target.value || null)}
                className="max-w-[220px] rounded-lg border border-[#2a2d36] bg-[#16181e] px-2.5 py-1.5 text-xs text-white outline-none"
                aria-label="Active session"
              >
                <option value="">Select a run…</option>
                {sessions?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.goal.slice(0, 42)} · {s.status}
                  </option>
                ))}
              </select>
              <button
                onClick={() => switchSession(null)}
                className="rounded-lg border border-[#2a2d36] px-2.5 py-1.5 text-xs text-[#8e929b] hover:text-white"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
            {thread.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 py-6 text-center max-w-xl mx-auto">
                <div className="flex flex-col items-center gap-2">
                  <AkshMark size={48} className="opacity-90 drop-shadow" />
                  <h2 className="text-base font-bold text-white tracking-tight">How can Aksh help your career today?</h2>
                  <p className="text-xs text-[#8e929b] max-w-sm">
                    Optimize resumes with Google XYZ impact formulas, prepare for interviews, benchmark compensation, or run automated applications.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
                  <button
                    type="button"
                    onClick={() => sendMessage(undefined, 'I want my resume to be tailored for a target job')}
                    className="flex flex-col gap-1 rounded-xl border border-[#2a2d36] bg-[#16181e] p-3 text-xs transition-colors hover:border-indigo-500/50 hover:bg-indigo-950/20"
                  >
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <span>✨</span> Tailor My Resume
                    </span>
                    <span className="text-[#8e929b] text-[11px]">
                      Provide a JD or link to generate tailored bullets & PDF
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => sendMessage(undefined, 'How do I use the Chrome extension on LinkedIn Easy Apply?')}
                    className="flex flex-col gap-1 rounded-xl border border-[#2a2d36] bg-[#16181e] p-3 text-xs transition-colors hover:border-indigo-500/50 hover:bg-indigo-950/20"
                  >
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <span>🧭</span> Platform & Extension Guide
                    </span>
                    <span className="text-[#8e929b] text-[11px]">
                      How Vedha AI autofill, studio & review gateway work
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => sendMessage(undefined, 'Conduct a mock interview for a senior engineering role using STAR method')}
                    className="flex flex-col gap-1 rounded-xl border border-[#2a2d36] bg-[#16181e] p-3 text-xs transition-colors hover:border-indigo-500/50 hover:bg-indigo-950/20"
                  >
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <span>🎯</span> Mock Interview Drill
                    </span>
                    <span className="text-[#8e929b] text-[11px]">
                      Practice behavioral STAR questions & get live critique
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => sendMessage(undefined, 'How should I negotiate a counter-offer for total compensation and equity?')}
                    className="flex flex-col gap-1 rounded-xl border border-[#2a2d36] bg-[#16181e] p-3 text-xs transition-colors hover:border-indigo-500/50 hover:bg-indigo-950/20"
                  >
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <span>💰</span> Salary Negotiation
                    </span>
                    <span className="text-[#8e929b] text-[11px]">
                      Benchmark compensation & draft counter-offer email
                    </span>
                  </button>
                </div>
              </div>
            )}
            {thread.map((b) =>
              b.role === 'user' ? (
                <div key={b.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-indigo-600 px-4 py-2.5 text-sm text-white whitespace-pre-wrap">
                    {b.text}
                  </div>
                </div>
              ) : b.role === 'system' ? (
                <div
                  key={b.id}
                  className="rounded-xl border border-[#2a2d36] bg-[#16181e] px-3.5 py-2.5 text-xs text-[#a0a4b0]"
                >
                  {b.text}
                </div>
              ) : (
                <div key={b.id} className="flex gap-2.5">
                  <AkshMark size={26} className="mt-0.5 shrink-0" />
                  <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-[#2a2d36] bg-[#16181e] px-4 py-2.5 text-sm text-[#e2e4e9]">
                    <Markdown text={b.text} />
                    {streaming && <span className="ml-1 inline-block w-1.5 animate-pulse text-indigo-300">▍</span>}
                  </div>
                </div>
              ),
            )}
            {streaming && (
              <div className="flex items-center gap-3 rounded-2xl border border-indigo-500/20 bg-indigo-950/30 p-2.5 max-w-sm ml-9 mb-2 shadow-lg backdrop-blur-sm">
                <img
                  src="/assets/loading.gif"
                  alt="Aksh is processing"
                  className="w-12 h-12 object-cover rounded-xl shadow-md border border-indigo-500/30 shrink-0"
                />
                <div className="min-w-0 flex flex-col">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                    Aksh is sprinting...
                  </span>
                  <span className="text-[11px] text-indigo-300/80 truncate">
                    Executing {activeSkill?.name || 'Career Operating System'}
                  </span>
                </div>
              </div>
            )}
            <div ref={threadEndRef} />
          </div>

          {activeSkill && (
            <div className="flex items-center justify-between border-t border-[#23252b]/60 bg-indigo-950/20 px-5 py-2 text-xs text-indigo-300">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="font-semibold text-white truncate">{activeSkill.name}</span>
                <span className="hidden sm:inline text-indigo-300/70 truncate">· {activeSkill.description}</span>
              </div>
              <span className="shrink-0 text-[10px] font-mono uppercase tracking-wider text-indigo-400/80 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">Skill Active</span>
            </div>
          )}

          <form
            onSubmit={(e) => sendMessage(e)}
            className="flex items-center gap-2.5 border-t border-[#23252b] px-5 py-3.5"
          >
            <input
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              disabled={streaming}
              placeholder="Ask Aksh anything (e.g. 'Optimize my resume', 'Practice interview', or paste a job URL)…"
              className="flex-1 rounded-xl border border-[#2a2d36] bg-[#0f1114] px-3.5 py-2.5 text-sm text-white placeholder:text-[#5b5f6c] outline-none focus:border-indigo-500/60 disabled:opacity-40"
            />
            {streaming ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#2a2d36] px-3.5 py-2.5 text-xs font-semibold text-[#c9ccd4] hover:text-white"
              >
                <X className="w-3.5 h-3.5" /> Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={streaming || !composer.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-zinc-950 transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" /> Send
              </button>
            )}
          </form>
        </section>

        {/* Rail */}
        <aside className="flex flex-col gap-5">
          {/* Plan */}
          <section className={`${card} p-5`}>
            <div className="mb-3 flex items-center justify-between">
              <span className={eyebrow}>Plan</span>
              <CircleDashed className="w-3.5 h-3.5 text-[#5b5f6c]" />
            </div>
            {!session || session.todos.length === 0 ? (
              <p className="text-xs text-[#6c707d]">No active plan. Start a run to see Aksh’s steps.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {session.todos.map((t, i) => (
                  <li key={`${t.step}-${i}`} className="flex items-start gap-2.5 text-xs">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        t.state === 'done'
                          ? 'bg-emerald-400'
                          : t.state === 'active'
                            ? 'bg-indigo-400 animate-pulse'
                            : t.state === 'failed'
                              ? 'bg-rose-400'
                              : 'bg-[#3a3d47]'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-[#e2e4e9]">{t.step}</p>
                      {t.tool && (
                        <p className="font-mono-tech text-[10px] text-[#6c707d]">{t.tool}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Approval gate — restrained brutalist accent */}
          <section
            className={`rounded-2xl border-2 bg-[#121318] p-5 ${
              pendingApproval ? 'border-amber-400/80 shadow-[5px_5px_0_0_rgba(245,158,11,0.25)]' : 'border-[#2a2d36]'
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono-tech text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300">
                ▚ Review gate
              </span>
              <ShieldCheck className="w-4 h-4 text-amber-300" />
            </div>
            {!pendingApproval ? (
              <p className="text-xs text-[#6c707d]">
                Nothing awaiting decision. Aksh will pause here before any submission.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="text-xs">
                  <p className="font-semibold text-white">
                    {pendingApproval.toolName}
                    {queueItem && (
                      <span className="font-normal text-[#8e929b]">
                        {' '}
                        · {queueItem.targetRole} @ {queueItem.targetCompany}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 font-mono-tech text-[10px] text-[#6c707d]">
                    single-use · expires {new Date(pendingApproval.expiresAtUtc).toLocaleTimeString()}
                    {new Date(pendingApproval.expiresAtUtc) < new Date() && ' · EXPIRED — ask Aksh for a fresh approval'}
                  </p>
                </div>
                {queueItem && queueItem.prefilledAnswers.length > 0 && (
                  <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
                    {queueItem.prefilledAnswers.map((a, i) => (
                      <label key={`${a.questionText}-${i}`} className="flex flex-col gap-1 text-xs">
                        <span className="text-[#8e929b]">{a.questionText}</span>
                        <input
                          value={answerEdits[i] ?? a.answerText}
                          onChange={(e) =>
                            setAnswerEdits((prev) => ({ ...prev, [i]: e.target.value }))
                          }
                          className="rounded-lg border border-[#2a2d36] bg-[#0f1114] px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-400/60"
                        />
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDecide(true)}
                    disabled={deciding || new Date(pendingApproval.expiresAtUtc) < new Date()}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-zinc-950 transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {deciding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Approve & submit
                  </button>
                  <button
                    onClick={() => handleDecide(false)}
                    disabled={deciding}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#3a3d47] px-3 py-2 text-xs font-bold text-[#c9ccd4] hover:border-rose-400/60 hover:text-white disabled:opacity-40"
                  >
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
                <p className="flex items-start gap-1.5 text-[11px] text-[#6c707d]">
                  <Lock className="w-3 h-3 mt-0.5 shrink-0" />
                  Bound to this exact submission. Rejections and expiries never execute.
                </p>
              </div>
            )}
          </section>

          {/* Spend */}
          <section className={`${card} p-5`}>
            <div className="mb-2 flex items-center justify-between">
              <span className={eyebrow}>Spend · est.</span>
              <Wallet className="w-3.5 h-3.5 text-[#5b5f6c]" />
            </div>
            <p className="font-mono-tech text-sm text-white">
              ≈${spend.usd.toFixed(4)}{' '}
              <span className="text-[11px] text-[#8e929b]">
                · {formatTokens(spend.input)} in / {formatTokens(spend.output)} out
                {spend.live ? ' · live' : ''}
              </span>
            </p>
            <p className="mt-1 text-[11px] text-[#6c707d]">
              3.8 Flash introductory pricing estimate. Memories and deterministic checks cost nothing.
            </p>
          </section>

          {/* Audit */}
          <section className={`${card} p-5`}>
            <div className="mb-2 flex items-center justify-between">
              <span className={eyebrow}>Audit trail</span>
              <ReceiptText className="w-3.5 h-3.5 text-[#5b5f6c]" />
            </div>
            {!audit || (audit.messages.length === 0 && audit.approvals.length === 0) ? (
              <p className="text-xs text-[#6c707d]">Every turn, tool receipt, and decision lands here.</p>
            ) : (
              <ol className="flex max-h-64 flex-col gap-2 overflow-y-auto">
                {audit.messages.map((m) => (
                  <li key={m.id} className="border-l-2 border-[#2a2d36] pl-2.5 text-[11px]">
                    <span className="font-mono-tech uppercase text-[#6c707d]">{m.role}</span>
                    <p className="text-[#a0a4b0]">{m.summaryText.slice(0, 140)}</p>
                  </li>
                ))}
                {audit.approvals.map((a) => (
                  <li key={a.id} className="border-l-2 border-amber-400/60 pl-2.5 text-[11px]">
                    <span className="font-mono-tech uppercase text-amber-300">{a.toolName}</span>
                    <p className="text-[#a0a4b0]">decision: {a.status}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>

      {/* Footer hint */}
      <div className="flex items-center gap-2 text-[11px] text-[#6c707d]">
        <Sparkles className="w-3.5 h-3.5" />
        <span>
          Aksh prepares aggressively and submits conservatively. LinkedIn stays supervised — your click is the genuine human gesture.
        </span>
        <ArrowRight className="w-3 h-3" />
      </div>
    </div>
  );
};

export default AskAkshPage;
