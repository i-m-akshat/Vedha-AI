import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDashed,
  Copy,
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

interface AgentStatus {
  stage: string;
  detail: string;
}

const getStageDisplay = (status: AgentStatus | null) => {
  const stage = status?.stage;
  switch (stage) {
    case 'ScrapingJob':
      return { title: 'Scraping Target Job', badge: 'Scraping' };
    case 'Scraped':
      return { title: 'Job Profile Extracted', badge: 'Analyzed' };
    case 'ParsingResume':
      return { title: 'Analyzing Master Resume', badge: 'Parsing' };
    case 'TailoringResume':
      return { title: 'Synthesizing Tailored Content', badge: 'Tailoring' };
    case 'PackagePrepared':
      return { title: 'Application Package Ready', badge: 'Prepared' };
    case 'Reasoning':
      return { title: 'Reasoning & Planning', badge: 'Reasoning' };
    case 'Responding':
      return { title: 'Formulating Response', badge: 'Responding' };
    default:
      return { title: 'Aksh is reasoning...', badge: 'Active' };
  }
};

const STATUS_STYLE: Record<AkshSessionStatus, string> = {
  Planning: 'bg-zinc-800 text-zinc-300 border-white/[0.08]',
  Executing: 'bg-zinc-800 text-zinc-200 border-white/[0.12]',
  AwaitingApproval: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Paused: 'bg-zinc-800 text-zinc-400 border-white/[0.06]',
  Completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Failed: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  Cancelled: 'bg-zinc-800 text-zinc-400 border-white/[0.06]',
};

const eyebrow =
  'font-mono text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500';

const card = 'rounded-[24px] bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] shadow-sm text-zinc-900 dark:text-[#ededed] transition-colors duration-200';

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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [liveSpend, setLiveSpend] = useState<{ input: number; output: number } | null>(null);
  const [activeSkill, setActiveSkill] = useState<AkshActiveSkill | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  
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
    useMemo(
      () => sessions?.find((s) => s.id === sessionId) ?? null,
      [sessions, sessionId],
    );

  const spend = useMemo(() => {
    const input = liveSpend ? liveSpend.input : (session?.tokenInputTotal ?? 0);
    const output = liveSpend ? liveSpend.output : (session?.tokenOutputTotal ?? 0);
    return {
      input,
      output,
      usd: estimateCostUsd(input, output),
      live: !!liveSpend,
    };
  }, [session, liveSpend]);

  const loadApprovalContext = async (approval: AkshApprovalDto) => {
    setPendingApproval(approval);
    if (approval.queueItemId) {
      try {
        const item = await orchestratorApi.getQueueItem(approval.queueItemId);
        setQueueItem(item);
        const map: Record<number, string> = {};
        item.prefilledAnswers?.forEach((a, i) => {
          map[i] = a.answerText;
        });
        setAnswerEdits(map);
      } catch {
        setQueueItem(null);
      }
    } else {
      setQueueItem(null);
    }
  };

  useEffect(() => {
    if (!sessionId) {
      setPendingApproval(null);
      setQueueItem(null);
      return;
    }
    const seq = ++approvalReqSeq.current;
    akshApi.getApproval(sessionId).then((approval) => {
      if (seq !== approvalReqSeq.current || sessionId !== sessionIdRef.current) return;
      if (approval) {
        void loadApprovalContext(approval);
      } else {
        setPendingApproval(null);
        setQueueItem(null);
      }
    }).catch(() => {
      if (seq !== approvalReqSeq.current) return;
      setPendingApproval(null);
      setQueueItem(null);
    });
  }, [sessionId]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread, streaming]);

  useEffect(() => {
    if (!streaming && audit?.messages && sessionId && audit.session?.id === sessionId) {
      const bubbles: ChatBubble[] = audit.messages
        .filter((m) => m.role === 'user' || m.role === 'assistant' || (m.role === 'tool' && m.summaryText))
        .map((m) => ({
          id: m.id,
          role: (m.role === 'user' ? 'user' : m.role === 'assistant' ? 'assistant' : 'system') as 'user' | 'assistant' | 'system',
          text: m.role === 'tool' ? `⚙️ **[${m.toolName || 'Tool'}]** ${m.summaryText}` : m.summaryText,
        }));
      setThread(bubbles);
    }
  }, [audit, sessionId, streaming]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const sendMessage = async (e?: React.FormEvent, directMessage?: string) => {
    if (e) e.preventDefault();
    const text = (directMessage ?? composer).trim();
    if (!text || streaming) return;

    setComposer('');
    setNotice(null);

    const userBubble: ChatBubble = { id: nextBubbleId(), role: 'user', text };
    const assistantBubble: ChatBubble = { id: nextBubbleId(), role: 'assistant', text: '' };
    setThread((prev) => [...prev, userBubble, assistantBubble]);

    setStreaming(true);
    setAgentStatus({ stage: 'Reasoning', detail: 'Analyzing request and selecting domain skill...' });
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      let sid = sessionId;
      if (!sid) {
        const newSess = await akshApi.startSession(text, undefined, autonomy);
        sid = newSess.id;
        setSessionId(newSess.id);
      }

      const stream = streamAkshTurn(sid, text, abort.signal);

      let accumulated = '';
      for await (const ev of stream) {
        switch (ev.type) {
          case 'session': {
            const sData = ev.data as { sessionId: string };
            if (sData?.sessionId && sData.sessionId !== sid) {
              setSessionId(sData.sessionId);
            }
            break;
          }
          case 'skill': {
            const sk = ev.data as AkshActiveSkill;
            if (sk && sk.name) {
              setActiveSkill(sk);
            }
            break;
          }
          case 'status': {
            const st = ev.data as { stage: string; detail: string };
            if (st?.stage) {
              setAgentStatus({
                stage: st.stage,
                detail: st.detail || '',
              });
            }
            break;
          }
          case 'message': {
            const delta = (ev.data as { delta: string })?.delta ?? '';
            accumulated += delta;
            setThread((prev) => {
              const next = [...prev];
              const idx = next.findIndex((b) => b.id === assistantBubble.id);
              if (idx >= 0) next[idx] = { ...next[idx], text: accumulated };
              return next;
            });
            setAgentStatus((prev) =>
              prev?.stage === 'Responding' ? prev : { stage: 'Responding', detail: 'Formulating strategic guidance...' }
            );
            break;
          }
          case 'approval_required':
          case 'approval-request': {
            const app = ev.data as AkshApprovalDto;
            await loadApprovalContext(app);
            setNotice({
              kind: 'info',
              text: `Review needed: Aksh prepared "${app.toolName}". Review prefilled answers and approve below.`,
            });
            break;
          }
          case 'ledger': {
            const leg = ev.data as { inputTokens: number; outputTokens: number };
            setLiveSpend({ input: leg.inputTokens, output: leg.outputTokens });
            break;
          }
          case 'error': {
            const err = ev.data as { reasonCode: string; message: string };
            setNotice({ kind: 'error', text: err.message });
            break;
          }
          case 'done': {
            await queryClient.invalidateQueries({ queryKey: ['akshSessions'] });
            if (sid) {
              await queryClient.invalidateQueries({ queryKey: ['akshAudit', sid] });
            }
            break;
          }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setNotice({ kind: 'info', text: 'Turn interrupted.' });
      } else {
        setNotice({ kind: 'error', text: err?.message || 'Streaming failed.' });
      }
    } finally {
      setStreaming(false);
      setAgentStatus(null);
      abortRef.current = null;
    }
  };

  const handleDecide = async (approved: boolean) => {
    if (!pendingApproval) return;
    setDeciding(true);
    try {
      const edited = queueItem && Object.keys(answerEdits).length > 0
        ? queueItem.prefilledAnswers.map((a, idx) => ({
            question: a.questionText,
            answer: answerEdits[idx] ?? a.answerText,
          }))
        : undefined;
      await akshApi.decideApproval(pendingApproval.id, approved, edited);
      setNotice({
        kind: 'success',
        text: approved
          ? 'Approved. Aksh will continue execution on your next turn.'
          : 'Rejected. Step was skipped safely.',
      });
      setPendingApproval(null);
      setQueueItem(null);
      await queryClient.invalidateQueries({ queryKey: ['akshSessions'] });
    } catch (err: any) {
      setNotice({ kind: 'error', text: err?.message || 'Decision failed.' });
    } finally {
      setDeciding(false);
    }
  };

  const switchSession = async (id: string | null) => {
    if (abortRef.current) abortRef.current.abort();
    setSessionId(id);
    setThread([]);
    setPendingApproval(null);
    setQueueItem(null);
    setNotice(null);
    setLiveSpend(null);
    setActiveSkill(null);
    setAgentStatus(null);
    if (id) {
      const seq = approvalReqSeq.current;
      void akshApi.getApproval(id).then((approval) => {
        if (seq !== approvalReqSeq.current || id !== sessionIdRef.current) return;
        if (approval) void loadApprovalContext(approval);
      });
      try {
        const auditData = await akshApi.getAudit(id);
        if (id === sessionIdRef.current && auditData?.messages) {
          const bubbles: ChatBubble[] = auditData.messages
            .filter((m) => m.role === 'user' || m.role === 'assistant' || (m.role === 'tool' && m.summaryText))
            .map((m) => ({
              id: m.id,
              role: (m.role === 'user' ? 'user' : m.role === 'assistant' ? 'assistant' : 'system') as 'user' | 'assistant' | 'system',
              text: m.role === 'tool' ? `⚙️ **[${m.toolName || 'Tool'}]** ${m.summaryText}` : m.summaryText,
            }));
          setThread(bubbles);
        }
      } catch (err) {
        console.error('Failed to load session history:', err);
      }
    }
  };

  return (
    <div className="flex flex-col gap-6 font-sans text-zinc-900 dark:text-[#ededed] max-w-6xl mx-auto">
      {/* Studio Header */}
      <div className={`${card} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <AkshMark size={38} />
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">Ask Aksh</h1>
                <span className="rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.04] dark:bg-zinc-800 px-2.5 py-0.5 text-[10px] font-mono text-zinc-700 dark:text-zinc-300 uppercase tracking-wider font-semibold">
                  Copilot
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Precision resume tailoring, behavioral interview drills & automated application workflows.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            {/* Autonomy Selector */}
            <div className="flex items-center gap-1.5 rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.03] dark:bg-zinc-800/60 px-3.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300">
              <span className="text-zinc-400 dark:text-zinc-500 font-mono text-[10px] uppercase tracking-wider">Gate:</span>
              <select
                value={autonomy}
                onChange={(e) => setAutonomy(e.target.value as AutonomyLevel)}
                className="bg-transparent text-xs text-zinc-900 dark:text-zinc-200 font-semibold outline-none cursor-pointer"
                title="Supervised requires your review and approval before any submission action."
              >
                <option value="Supervised" className="bg-white dark:bg-[#121215]">Supervised</option>
                <option value="SupervisedAuto" className="bg-white dark:bg-[#121215]">SupervisedAuto</option>
              </select>
            </div>

            {/* New Chat Button */}
            <button
              onClick={() => switchSession(null)}
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 px-4 py-1.5 text-xs font-semibold transition-all shadow-sm cursor-pointer active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5" />
              New Run
            </button>
          </div>
        </div>

        {config && !config.enabled && (
          <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-2 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
            <span>
              Aksh is disabled on this deployment (<span className="font-mono">Aksh:Enabled=false</span>).
            </span>
          </div>
        )}
      </div>

      {notice && (
        <div
          className={`rounded-2xl border px-4 py-2.5 text-xs shadow-sm ${
            notice.kind === 'error'
              ? 'border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300'
              : notice.kind === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'
                : 'border-black/[0.06] dark:border-white/[0.1] bg-black/[0.03] dark:bg-zinc-900/60 text-zinc-700 dark:text-zinc-300'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* Chat Thread */}
        <section className={`${card} xl:col-span-2 flex min-h-[520px] flex-col overflow-hidden`}>
          <div className="flex items-center gap-3 border-b border-black/[0.06] dark:border-white/[0.07] px-5 py-3">
            <span className={eyebrow}>Conversation</span>
            {activeSkill && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-mono text-emerald-700 dark:text-emerald-300 tracking-wider uppercase font-semibold"
                title={activeSkill.description}
              >
                <Sparkles className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                <span>{activeSkill.name}</span>
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <select
                value={sessionId ?? ''}
                onChange={(e) => switchSession(e.target.value || null)}
                className="max-w-[200px] rounded-full border border-black/[0.06] dark:border-white/[0.07] bg-black/[0.03] dark:bg-zinc-800/60 px-3 py-1 text-xs text-zinc-700 dark:text-zinc-300 outline-none"
                aria-label="Active session"
              >
                <option value="">Recent sessions…</option>
                {sessions?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.goal.slice(0, 36)} · {s.status}
                  </option>
                ))}
              </select>
              <button
                onClick={() => switchSession(null)}
                className="rounded-full border border-black/[0.06] dark:border-white/[0.07] px-3 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
            {thread.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 py-8 text-center max-w-lg mx-auto">
                <div className="flex flex-col items-center gap-2.5">
                  <AkshMark size={44} className="opacity-90" />
                  <h2 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">How can Aksh accelerate your search today?</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
                    Select a workflow or enter any question to tailor resumes, simulate interviews, or review compensation.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
                  <button
                    type="button"
                    onClick={() => sendMessage(undefined, 'I want my resume to be tailored for a target job')}
                    className="flex flex-col gap-1 rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.025] hover:bg-black/[0.05] dark:bg-zinc-900/40 dark:hover:bg-zinc-800/70 p-3.5 text-xs transition-all cursor-pointer shadow-sm"
                  >
                    <span className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <span>✨</span> Tailor Target Resume
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                      Provide a JD or link for Google XYZ bullets & PDF
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => sendMessage(undefined, 'How do I use the Chrome extension on LinkedIn Easy Apply?')}
                    className="flex flex-col gap-1 rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.025] hover:bg-black/[0.05] dark:bg-zinc-900/40 dark:hover:bg-zinc-800/70 p-3.5 text-xs transition-all cursor-pointer shadow-sm"
                  >
                    <span className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <span>🧭</span> Extension & Autofill
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                      Review gateway and Easy Apply pairing
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => sendMessage(undefined, 'Conduct a mock interview for a senior engineering role using STAR method')}
                    className="flex flex-col gap-1 rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.025] hover:bg-black/[0.05] dark:bg-zinc-900/40 dark:hover:bg-zinc-800/70 p-3.5 text-xs transition-all cursor-pointer shadow-sm"
                  >
                    <span className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <span>🎯</span> Behavioral STAR Mock
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                      Simulate high-bar questions with instant critique
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => sendMessage(undefined, 'How should I negotiate a counter-offer for total compensation and equity?')}
                    className="flex flex-col gap-1 rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.025] hover:bg-black/[0.05] dark:bg-zinc-900/40 dark:hover:bg-zinc-800/70 p-3.5 text-xs transition-all cursor-pointer shadow-sm"
                  >
                    <span className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <span>💰</span> Compensation Advisory
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                      Percentiles & counter-offer script drafting
                    </span>
                  </button>
                </div>
              </div>
            )}

            {thread.map((b) =>
              b.role === 'user' ? (
                <div key={b.id} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 border border-black/[0.08] dark:border-white/[0.08] px-4 py-2.5 text-sm leading-relaxed shadow-sm whitespace-pre-wrap font-medium">
                    {b.text}
                  </div>
                </div>
              ) : b.role === 'system' ? (
                <div
                  key={b.id}
                  className="rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-zinc-900/50 px-3.5 py-2 text-xs text-zinc-500 dark:text-zinc-400"
                >
                  {b.text}
                </div>
              ) : (
                <div key={b.id} className="flex gap-3 group">
                  <AkshMark size={26} className="mt-1 shrink-0" />
                  <div className="relative max-w-[85%] rounded-2xl rounded-tl-sm border border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-zinc-900/50 px-4 py-3 text-sm text-zinc-900 dark:text-[#ededed] leading-relaxed shadow-sm">
                    <Markdown text={b.text} />
                    {streaming && <span className="ml-1 inline-block w-1.5 animate-pulse text-zinc-500 dark:text-zinc-300">▍</span>}
                    {b.text && !streaming && (
                      <button
                        onClick={() => copyToClipboard(b.text, b.id)}
                        className="absolute top-2 right-2 p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white opacity-0 group-hover:opacity-100 transition-opacity rounded cursor-pointer"
                        title="Copy to clipboard"
                      >
                        {copiedId === b.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              ),
            )}

            {streaming && (
              <div className="flex items-center gap-3.5 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white/95 dark:bg-[#16151F]/90 p-3 max-w-md ml-9 mb-2 shadow-lg backdrop-blur-md transition-all">
                <img
                  src="/assets/loading.gif"
                  alt="Aksh is processing"
                  className="w-11 h-11 object-cover rounded-xl border border-black/[0.08] dark:border-white/[0.1] shrink-0 shadow-sm"
                />
                <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5 truncate">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                      <span>{getStageDisplay(agentStatus).title}</span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold shrink-0 uppercase tracking-wider">
                      {getStageDisplay(agentStatus).badge}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                    {agentStatus?.detail || (activeSkill ? `Executing ${activeSkill.name}...` : 'Reasoning across career history and targets...')}
                  </span>
                  <div className="w-full bg-black/[0.05] dark:bg-white/[0.06] h-1 rounded-full overflow-hidden mt-1">
                    <div className="bg-gradient-to-r from-emerald-500 via-indigo-500 to-purple-500 h-full w-full animate-pulse rounded-full" />
                  </div>
                </div>
              </div>
            )}
            <div ref={threadEndRef} />
          </div>

          {activeSkill && (
            <div className="flex items-center justify-between border-t border-black/[0.05] dark:border-white/[0.06] bg-black/[0.02] dark:bg-zinc-900/40 px-5 py-2 text-xs text-zinc-600 dark:text-zinc-300">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                <span className="font-semibold text-zinc-900 dark:text-white truncate">{activeSkill.name}</span>
                <span className="hidden sm:inline text-zinc-500 dark:text-zinc-400 truncate">· {activeSkill.description}</span>
              </div>
              <span className="shrink-0 text-[9px] font-mono uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-semibold">Skill Active</span>
            </div>
          )}

          <form
            onSubmit={(e) => sendMessage(e)}
            className="flex items-center gap-2.5 border-t border-black/[0.06] dark:border-white/[0.07] px-4 py-3 bg-[#FAF8F5] dark:bg-[#100F17]"
          >
            <input
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              disabled={streaming}
              placeholder="Ask Aksh anything (e.g. 'Tailor my resume for this JD', or paste a job URL)…"
              className="flex-1 rounded-full border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-zinc-900/80 px-4 py-2 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none focus:border-zinc-400 dark:focus:border-white/30 transition-colors disabled:opacity-40 shadow-inner"
            />
            {streaming ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] dark:border-white/[0.1] px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={streaming || !composer.trim()}
                className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 px-4 py-2 text-xs font-semibold transition-all shadow-sm disabled:opacity-30 cursor-pointer active:scale-[0.98]"
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
              <span className={eyebrow}>Plan of Action</span>
              <CircleDashed className="w-3.5 h-3.5 text-zinc-500" />
            </div>
            {!session || session.todos.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">No active plan. Start a run to inspect Aksh’s steps.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {session.todos.map((t, i) => (
                  <li key={`${t.step}-${i}`} className="flex items-start gap-2.5 text-xs">
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        t.state === 'done'
                          ? 'bg-emerald-500 dark:bg-emerald-400'
                          : t.state === 'active'
                            ? 'bg-[#D9704F] animate-pulse'
                            : t.state === 'failed'
                              ? 'bg-rose-500 dark:bg-rose-400'
                              : 'bg-zinc-300 dark:bg-zinc-700'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-800 dark:text-zinc-200">{t.step}</p>
                      {t.tool && (
                        <p className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">{t.tool}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Review Gate */}
          <section
            className={`rounded-2xl border p-5 transition-all ${
              pendingApproval 
                ? 'border-amber-400/60 bg-amber-500/5 shadow-sm' 
                : 'border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#16151F] shadow-sm'
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-amber-600 dark:text-amber-400">
                Review Gate
              </span>
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            {!pendingApproval ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Nothing awaiting decision. Aksh will pause here before any submission action.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="text-xs">
                  <p className="font-semibold text-zinc-900 dark:text-white">
                    {pendingApproval.toolName}
                    {queueItem && (
                      <span className="font-normal text-zinc-500 dark:text-zinc-400">
                        {' '}
                        · {queueItem.targetRole} @ {queueItem.targetCompany}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                    single-use · expires {new Date(pendingApproval.expiresAtUtc).toLocaleTimeString()}
                    {new Date(pendingApproval.expiresAtUtc) < new Date() && ' · EXPIRED'}
                  </p>
                </div>
                {queueItem && queueItem.prefilledAnswers.length > 0 && (
                  <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
                    {queueItem.prefilledAnswers.map((a, i) => (
                      <label key={`${a.questionText}-${i}`} className="flex flex-col gap-1 text-xs">
                        <span className="text-zinc-600 dark:text-zinc-400">{a.questionText}</span>
                        <input
                          value={answerEdits[i] ?? a.answerText}
                          onChange={(e) =>
                            setAnswerEdits((prev) => ({ ...prev, [i]: e.target.value }))
                          }
                          className="rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-[#FAF7F2] dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-white outline-none focus:border-[#D9704F]"
                        />
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDecide(true)}
                    disabled={deciding || new Date(pendingApproval.expiresAtUtc) < new Date()}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#D9704F] hover:bg-[#C85F3E] px-3 py-1.5 text-xs font-semibold text-white transition-all disabled:opacity-40 cursor-pointer active:scale-[0.98]"
                  >
                    {deciding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Approve
                  </button>
                  <button
                    onClick={() => handleDecide(false)}
                    disabled={deciding}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-black/[0.08] dark:border-white/[0.08] px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-black/[0.04] dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" /> Skip
                  </button>
                </div>
                <p className="flex items-start gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <Lock className="w-3 h-3 mt-0.5 shrink-0" />
                  Bound strictly to this specific submission.
                </p>
              </div>
            )}
          </section>

          {/* Spend */}
          <section className={`${card} p-5`}>
            <div className="mb-2 flex items-center justify-between">
              <span className={eyebrow}>Cost & Ledger</span>
              <Wallet className="w-3.5 h-3.5 text-zinc-500" />
            </div>
            <p className="font-mono text-xs text-zinc-900 dark:text-white">
              ≈${spend.usd.toFixed(4)}{' '}
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                · {formatTokens(spend.input)} in / {formatTokens(spend.output)} out
                {spend.live ? ' · live' : ''}
              </span>
            </p>
          </section>

          {/* Audit */}
          <section className={`${card} p-5`}>
            <div className="mb-2 flex items-center justify-between">
              <span className={eyebrow}>Audit Trail</span>
              <ReceiptText className="w-3.5 h-3.5 text-zinc-500" />
            </div>
            {!audit || (audit.messages.length === 0 && audit.approvals.length === 0) ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Receipts and step records log here automatically.</p>
            ) : (
              <ol className="flex max-h-56 flex-col gap-2 overflow-y-auto">
                {audit.messages.map((m) => (
                  <li key={m.id} className="border-l border-zinc-200 dark:border-zinc-700 pl-2 text-[11px]">
                    <span className="font-mono uppercase text-zinc-500 text-[10px]">{m.role}</span>
                    <p className="text-zinc-700 dark:text-zinc-300">{m.summaryText.slice(0, 120)}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>

      {/* Footer Hint */}
      <div className="flex items-center gap-2 text-[11px] text-zinc-500">
        <Sparkles className="w-3 h-3 text-emerald-400" />
        <span>
          Vedha Career Operating System: Supervised execution guarantees that applications require human approval before submission.
        </span>
      </div>
    </div>
  );
};

export default AskAkshPage;
