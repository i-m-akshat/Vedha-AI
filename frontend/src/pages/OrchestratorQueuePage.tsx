import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orchestratorApi, masterResumeApi, autonomousApi } from '../api';
import { ApplicationQueueItemDto, PipelineExecutionStatus, ScreeningQuestionAnswerDto, ApplicationAuditDto } from '../types/orchestrator';
import { ActivePage } from '../components/layout/AppLayout';
import { 
  Bot, 
  Send, 
  ExternalLink, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Play, 
  Eye, 
  FileText, 
  Sparkles, 
  ShieldCheck, 
  Terminal, 
  Building2, 
  CheckCircle2,
  RefreshCw,
  Search,
  ArrowRight,
  HelpCircle,
  Edit3,
  Coins,
  AlertTriangle,
  Download,
  Zap,
  Kanban
} from 'lucide-react';
import { Button, Card, Badge, Input, cn } from '../components/ui';

interface OrchestratorQueuePageProps {
  setActivePage?: (page: ActivePage) => void;
}

export const OrchestratorQueuePage: React.FC<OrchestratorQueuePageProps> = ({ setActivePage }) => {
  const queryClient = useQueryClient();
  const [jobUrlInput, setJobUrlInput] = useState('');
  const [selectedQueueItem, setSelectedQueueItem] = useState<ApplicationQueueItemDto | null>(null);
  const [isCopilotMode, setIsCopilotMode] = useState(true);
  const [isHeadedBrowser, setIsHeadedBrowser] = useState(false);
  const [customQuestionInput, setCustomQuestionInput] = useState('');
  const [customQuestions, setCustomQuestions] = useState<string[]>([]);
  const [hitlAnswerInput, setHitlAnswerInput] = useState('');
  const [executionFeedback, setExecutionFeedback] = useState<{
    type: 'success' | 'info' | 'warning' | 'error';
    message: string;
    finalUrl?: string;
  } | null>(null);

  useEffect(() => {
    const jobUrl = new URLSearchParams(window.location.search).get('jobUrl');
    if (!jobUrl) return;

    setJobUrlInput(jobUrl);
    window.history.replaceState({}, document.title, window.location.pathname);
  }, []);

  // Fetch Master Resume
  const { data: masterResume } = useQuery({
    queryKey: ['masterResume'],
    queryFn: masterResumeApi.get,
  });

  // Fetch Application Queue
  const { data: queue, isLoading: isQueueLoading } = useQuery({
    queryKey: ['orchestratorQueue'],
    queryFn: () => orchestratorApi.getQueue(),
    refetchInterval: 5000,
  });

  // Fetch User Credits (BRD Architecture)
  const { data: credits } = useQuery({
    queryKey: ['userCredits'],
    queryFn: autonomousApi.getCredits,
    refetchInterval: 5000,
  });

  // Fetch Autonomous Applications Audit (NATS JetStream State Machine)
  const { data: autonomousApps } = useQuery({
    queryKey: ['autonomousApps'],
    queryFn: () => autonomousApi.getApplications(),
    refetchInterval: 3000,
  });

  // Mutation: Prepare Application Package
  const prepareMutation = useMutation({
    mutationFn: orchestratorApi.preparePackage,
    onSuccess: (newItem) => {
      queryClient.invalidateQueries({ queryKey: ['orchestratorQueue'] });
      setSelectedQueueItem(newItem);
      setJobUrlInput('');
      setCustomQuestions([]);
    }
  });

  // Mutation: Autonomous Ingest (NATS JetStream)
  const ingestMutation = useMutation({
    mutationFn: autonomousApi.ingestJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autonomousApps'] });
      queryClient.invalidateQueries({ queryKey: ['userCredits'] });
      setJobUrlInput('');
    }
  });

  // Mutation: Resolve HitL Question
  const resolveHitlMutation = useMutation({
    mutationFn: ({ applicationId, answer }: { applicationId: string; answer: string }) =>
      autonomousApi.resolveHitl(applicationId, answer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autonomousApps'] });
      setHitlAnswerInput('');
    }
  });

  // Mutation: Execute Pipeline
  const executeMutation = useMutation({
    mutationFn: ({ id, headed, copilot }: { id: string; headed: boolean; copilot: boolean }) =>
      orchestratorApi.execute(id, headed, copilot),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['orchestratorQueue'] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['userCredits'] });
      if (selectedQueueItem) {
        orchestratorApi.getQueueItem(selectedQueueItem.id).then(item => setSelectedQueueItem(item));
      }

      if (result.pausedForUserReview) {
        setExecutionFeedback({
          type: 'warning',
          message: selectedQueueItem?.jobUrl?.includes('linkedin.com')
            ? 'LinkedIn Easy Apply requires your authenticated browser session to submit. Click "Open & 1-Click Apply" to auto-fill the application in your logged-in tab with the Vedha Extension, or click "Mark Submitted" once complete.'
            : (result.message || 'Automation package staged at the review gateway. Please review and authorize final submit.'),
          finalUrl: result.finalPageUrl
        });
      } else if (result.success) {
        setExecutionFeedback({
          type: 'success',
          message: result.message || 'Application submitted successfully! Synced with your Applications tracker.',
          finalUrl: result.finalPageUrl
        });
      } else {
        setExecutionFeedback({
          type: 'error',
          message: result.errorDetails || result.message || 'Execution paused or encountered an error. Check execution logs.',
          finalUrl: result.finalPageUrl
        });
      }
    },
    onError: (err: any) => {
      setExecutionFeedback({
        type: 'error',
        message: err?.response?.data?.error || err?.message || 'Failed to dispatch automation.'
      });
    }
  });

  // Mutation: Update Status
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      orchestratorApi.updateStatus(id, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orchestratorQueue'] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['userCredits'] });
      if (selectedQueueItem) {
        orchestratorApi.getQueueItem(selectedQueueItem.id).then(item => setSelectedQueueItem(item));
      }
      if (variables.status === 'Submitted') {
        setExecutionFeedback({
          type: 'success',
          message: 'Marked as Submitted! Application is now tracked in your Applications board.'
        });
      }
    }
  });

  const handleStartPrepare = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobUrlInput.trim() || !masterResume?.id) return;

    prepareMutation.mutate({
      masterResumeId: masterResume.id,
      jobUrl: jobUrlInput.trim(),
      customQuestions: customQuestions.length > 0 ? customQuestions : undefined
    });
  };

  const handleAutonomousIngest = () => {
    if (!jobUrlInput.trim()) return;
    ingestMutation.mutate({
      jobUrl: jobUrlInput.trim()
    });
  };

  const hitlApp = autonomousApps?.find(a => a.status === 'hitl_required');

  const addCustomQuestion = () => {
    if (!customQuestionInput.trim()) return;
    setCustomQuestions(prev => [...prev, customQuestionInput.trim()]);
    setCustomQuestionInput('');
  };

  const getSourceBadge = (source: string | number) => {
    const s = String(source).toLowerCase();
    if (s.includes('greenhouse')) return <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">Greenhouse ATS</span>;
    if (s.includes('lever')) return <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">Lever ATS</span>;
    if (s.includes('ashby')) return <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">Ashby ATS</span>;
    if (s.includes('linkedin')) return <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">LinkedIn Easy Apply</span>;
    if (s.includes('naukri')) return <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">Naukri Apply</span>;
    if (s.includes('workday')) return <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">Workday Portal</span>;
    return <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">Universal AI Agent</span>;
  };

  const getStatusBadge = (status: PipelineExecutionStatus | string) => {
    switch (status) {
      case PipelineExecutionStatus.Prepared:
        return <span className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" /> Ready for Review</span>;
      case PipelineExecutionStatus.PausedForUserReview:
        return <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full"><ShieldCheck className="w-3 h-3" /> Paused (Review Gateway)</span>;
      case PipelineExecutionStatus.RunningAutomation:
        return <span className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-full"><RefreshCw className="w-3 h-3 animate-spin" /> Running Pipeline</span>;
      case PipelineExecutionStatus.Submitted:
        return <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Submitted</span>;
      case PipelineExecutionStatus.Failed:
        return <span className="flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-full"><AlertCircle className="w-3 h-3" /> Failed</span>;
      default:
        return <span className="text-xs text-slate-500 dark:text-zinc-400">{status}</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Bot className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Job Application Orchestrator & Autonomous SaaS
          </h1>
          <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1">
            Autonomous multi-pipeline event engine (NATS JetStream + AgentQL Playwright + Context pgvector RAG + S3 Storage).
          </p>
        </div>

        {/* User Credits Balance Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-200 dark:border-indigo-800 px-4 py-2 rounded-xl shadow-sm">
            <Coins className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium leading-none">Application Credits</div>
              <div className="text-base font-bold text-indigo-700 dark:text-indigo-300 leading-tight">
                {credits?.creditsBalance ?? 50} <span className="text-xs font-normal text-slate-500">credits</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Human-In-The-Loop (HitL) Escalation Banner */}
      {hitlApp && (
        <Card className="p-5 border-2 border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20 shadow-md space-y-3">
          <div className="flex items-center gap-2.5 text-amber-700 dark:text-amber-400 font-bold text-base">
            <AlertTriangle className="w-5 h-5 animate-pulse text-amber-600 dark:text-amber-400" />
            Human-In-The-Loop Escalation: {hitlApp.companyName} Application Paused
          </div>
          <p className="text-sm text-slate-700 dark:text-zinc-300">
            The autonomous Playwright worker encountered a subjective screening question requiring your direct authentic input:
          </p>
          <div className="p-3 bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-800 rounded-lg text-sm font-medium text-slate-800 dark:text-zinc-200">
            "{hitlApp.hitlQuestion}"
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <Input
              type="text"
              placeholder="Type your authentic response here..."
              value={hitlAnswerInput}
              onChange={e => setHitlAnswerInput(e.target.value)}
              className="flex-1 text-sm h-11"
            />
            <Button
              variant="primary"
              onClick={() => resolveHitlMutation.mutate({ applicationId: hitlApp.id, answer: hitlAnswerInput })}
              disabled={!hitlAnswerInput.trim() || resolveHitlMutation.isPending}
              className="h-11 px-6 shadow-sm"
            >
              {resolveHitlMutation.isPending ? 'Resuming Worker...' : 'Submit & Resume Worker'}
            </Button>
          </div>
        </Card>
      )}

      {/* URL Input & Launch Bar */}
      <Card className="p-6 space-y-4">
        <form onSubmit={handleStartPrepare} className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Input
                type="url"
                required
                placeholder="Paste Job URL (LinkedIn, Greenhouse, Lever, Ashby, Workday, Naukri, or Company Portal)..."
                value={jobUrlInput}
                onChange={e => setJobUrlInput(e.target.value)}
                className="pl-10 pr-4 h-12 text-sm"
              />
              <Search className="w-5 h-5 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-3.5" />
            </div>

            <Button
              type="submit"
              disabled={prepareMutation.isPending || !jobUrlInput.trim()}
              variant="primary"
              size="lg"
              className="px-5 h-12 shadow-md gap-2"
            >
              {prepareMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Preparing Package...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Prepare Package (Copilot)</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              onClick={handleAutonomousIngest}
              disabled={ingestMutation.isPending || !jobUrlInput.trim()}
              variant="outline"
              size="lg"
              className="px-5 h-12 shadow-sm gap-2 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
            >
              {ingestMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Publishing to NATS...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Autonomous Ingest (NATS + RAG)</span>
                </>
              )}
            </Button>
          </div>

          {/* Optional Screening Questions Prompt */}
          <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-zinc-400">Add custom screening questions (optional):</span>
            <div className="flex gap-2 flex-1 max-w-md">
              <Input
                type="text"
                placeholder="e.g. Why do you want to join us?"
                value={customQuestionInput}
                onChange={e => setCustomQuestionInput(e.target.value)}
                className="h-8 text-xs"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={addCustomQuestion}
                className="h-8 text-xs px-3"
              >
                Add
              </Button>
            </div>

            {customQuestions.map((q, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 font-medium">
                {q.slice(0, 30)}...
              </span>
            ))}
          </div>
        </form>
      </Card>

      {/* Main Grid: Queue Table & Review Gateway Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Queue List */}
        <Card className="lg:col-span-1 p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Application Staging Queue
            </h2>
            <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">({queue?.length || 0} packages)</span>
          </div>

          <div className="space-y-2.5">
            {(!queue || queue.length === 0) ? (
              <div className="text-center py-12 text-slate-400 dark:text-zinc-500 text-sm">
                No application packages prepared yet. Paste a job URL above to start.
              </div>
            ) : (
              queue.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedQueueItem(item)}
                  className={`p-3.5 rounded-xl cursor-pointer transition space-y-2 border ${
                    selectedQueueItem?.id === item.id
                      ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 shadow-sm'
                      : 'border-slate-200 dark:border-zinc-800/80 bg-slate-50/60 dark:bg-zinc-950/50 hover:bg-slate-100 dark:hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white truncate max-w-[160px]">
                      {item.targetCompany || 'Target Company'}
                    </span>
                    {getStatusBadge(item.status)}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-zinc-300 truncate">
                    {item.targetRole || 'Software Engineer'}
                  </p>

                  <div className="flex items-center justify-between pt-1">
                    {getSourceBadge(item.detectedSource)}
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                      {new Date(item.createdAtUtc).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Right: Review Gateway & Copilot Execution Studio */}
        <Card className="lg:col-span-2 p-6 space-y-6">
          {!selectedQueueItem ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 text-slate-400 dark:text-zinc-500">
              <Bot className="w-12 h-12 text-slate-300 dark:text-zinc-600 mb-3" />
              <p className="text-base font-medium text-slate-700 dark:text-zinc-300">Select an application package to review</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mt-1">
                Inspect AI-grounded screening answers, verify the tailored ATS resume, and launch Copilot execution.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Target Overview */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-zinc-950/70 rounded-xl border border-slate-200 dark:border-zinc-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {selectedQueueItem.targetRole} @ {selectedQueueItem.targetCompany}
                    </h3>
                    {getSourceBadge(selectedQueueItem.detectedSource)}
                  </div>
                  <a
                    href={selectedQueueItem.jobUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-1 font-medium"
                  >
                    View Job Posting <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="flex items-center gap-3">
                  {getStatusBadge(selectedQueueItem.status)}
                </div>
              </div>

              {/* Submission State Banner or Copilot Options Bar */}
              {selectedQueueItem.status === PipelineExecutionStatus.Submitted ? (
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200 tracking-wide uppercase">
                        Application Package Submitted Successfully
                      </h4>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                        {selectedQueueItem.appliedAtUtc ? `Submitted on ${new Date(selectedQueueItem.appliedAtUtc).toLocaleString()}` : 'Submitted'} • Synchronized to Job Tracker
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {setActivePage && (
                      <Button
                        onClick={() => setActivePage('tracker')}
                        size="sm"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition"
                      >
                        <Kanban className="w-3.5 h-3.5" /> View in Job Tracker
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-900/50">
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-zinc-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isCopilotMode}
                        onChange={e => setIsCopilotMode(e.target.checked)}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                      />
                      Copilot Mode (Pause at Review Gateway)
                    </label>

                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isHeadedBrowser}
                        onChange={e => setIsHeadedBrowser(e.target.checked)}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                      />
                      Headed Browser Window
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedQueueItem.jobUrl && (
                      <a
                        href={selectedQueueItem.jobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-sm transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Open & 1-Click Apply
                      </a>
                    )}

                    {selectedQueueItem.status === PipelineExecutionStatus.PausedForUserReview ? (
                      <>
                        <Button
                          onClick={() => {
                            executeMutation.mutate({
                              id: selectedQueueItem.id,
                              headed: isHeadedBrowser,
                              copilot: false // Review is finished; proceed with final submission!
                            });
                            if (selectedQueueItem.jobUrl?.includes('linkedin.com')) {
                              window.open(selectedQueueItem.jobUrl, '_blank');
                            }
                          }}
                          disabled={executeMutation.isPending}
                          size="sm"
                          className="gap-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500 shadow-md shadow-emerald-600/20"
                        >
                          {executeMutation.isPending ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                          Confirm & Finalize
                        </Button>

                        <Button
                          onClick={() => updateStatusMutation.mutate({ id: selectedQueueItem.id, status: 'Submitted' })}
                          variant="secondary"
                          size="sm"
                          className="gap-1.5 text-xs font-medium"
                        >
                          Mark Submitted
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => executeMutation.mutate({
                          id: selectedQueueItem.id,
                          headed: isHeadedBrowser,
                          copilot: isCopilotMode
                        })}
                        disabled={executeMutation.isPending}
                        variant="primary"
                        size="sm"
                        className="gap-2 text-xs font-semibold"
                      >
                        {executeMutation.isPending ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        Launch Copilot Automation
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Execution Feedback Notification Banner */}
              {executionFeedback && (
                <div className={cn(
                  "p-4 rounded-xl border text-xs flex items-start gap-3 transition-all",
                  executionFeedback.type === 'success' && "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300",
                  executionFeedback.type === 'warning' && "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300",
                  executionFeedback.type === 'error' && "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300",
                  executionFeedback.type === 'info' && "bg-sky-500/10 border-sky-500/30 text-sky-800 dark:text-sky-300"
                )}>
                  <div className="shrink-0 mt-0.5">
                    {executionFeedback.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                    {executionFeedback.type === 'warning' && <AlertCircle className="w-4 h-4 text-amber-500" />}
                    {executionFeedback.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-500" />}
                    {executionFeedback.type === 'info' && <ShieldCheck className="w-4 h-4 text-sky-500" />}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white">
                      {executionFeedback.type === 'success' && 'Application Status: Finalized'}
                      {executionFeedback.type === 'warning' && 'Session Authentication Required'}
                      {executionFeedback.type === 'error' && 'Execution Error'}
                      {executionFeedback.type === 'info' && 'Automation Status'}
                    </div>
                    <div className="leading-relaxed text-slate-700 dark:text-zinc-200">{executionFeedback.message}</div>
                    <div className="flex items-center gap-3 pt-1.5">
                      {selectedQueueItem.jobUrl && (
                        <a
                          href={selectedQueueItem.jobUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-xs text-sky-600 dark:text-sky-400 hover:underline"
                        >
                          Open Job Tab <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {selectedQueueItem.status !== PipelineExecutionStatus.Submitted && (
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: selectedQueueItem.id, status: 'Submitted' })}
                          className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] shadow-sm transition"
                        >
                          Mark as Submitted
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setExecutionFeedback(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Review Gateway Informational Banner */}
              {selectedQueueItem.status === PipelineExecutionStatus.PausedForUserReview && (
                <div className="p-3.5 bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs flex items-start gap-2.5 text-amber-800 dark:text-amber-300">
                  <ShieldCheck className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div className="space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white">Review Gateway Active: Resume & Screening Answers Staged</div>
                    <div className="text-slate-600 dark:text-zinc-300">
                      {selectedQueueItem.jobUrl?.includes('linkedin.com') ? (
                        <span>Because LinkedIn Easy Apply requires your authenticated user session, click <strong>&quot;Open & 1-Click Apply&quot;</strong> to let the <strong>Vedha Desktop Extension</strong> automatically fill all modal steps in your logged-in browser tab, or click <strong>Mark Submitted</strong> once submitted.</span>
                      ) : (
                        <span>Verify pre-filled answers and tailored resume below. Click <strong>&quot;Confirm & Finalize&quot;</strong> to dispatch Playwright browser submission.</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Review Gateway: Pre-filled Screening Answers */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-zinc-800">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Pre-filled Screening Questionnaire ({selectedQueueItem.prefilledAnswers?.length || 0} fields)
                  </h4>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400">100% Grounded in Master Profile & Resume</span>
                </div>

                <div className="space-y-3">
                  {selectedQueueItem.prefilledAnswers?.map((ans, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-slate-50 dark:bg-zinc-950/70 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                          {idx + 1}. {ans.questionText}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {ans.source}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 p-3 rounded-lg border border-slate-200 dark:border-zinc-800 font-mono">
                        {ans.answerText}
                      </p>

                      {ans.evidenceSnippet && (
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 italic">
                          Evidence: {ans.evidenceSnippet}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Cover Letter Preview */}
              {selectedQueueItem.coverLetterText && (
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Tailored Cover Letter
                  </h4>
                  <div className="p-4 bg-slate-50 dark:bg-zinc-950/70 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs text-slate-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">
                    {selectedQueueItem.coverLetterText}
                  </div>
                </div>
              )}

              {/* Real-Time Terminal Execution Traces */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
                  Pipeline Automation Step Trace
                </h4>

                <div className="p-4 bg-slate-950 dark:bg-zinc-950 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto max-h-56 space-y-1 border border-slate-800 dark:border-zinc-800">
                  {selectedQueueItem.executionLogs?.length > 0 ? (
                    selectedQueueItem.executionLogs.map((log, i) => (
                      <div key={i} className="leading-relaxed">
                        {log}
                      </div>
                    ))
                  ) : (
                    <div className="text-zinc-500">Pipeline ready. Click &quot;Launch Copilot Automation&quot; to execute.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Autonomous Event-Driven Applications Audit (NATS JetStream & S3 Engine) */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Autonomous Applications (NATS JetStream State Machine)
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Decoupled event queue transitions (pending ➔ generating_resume ➔ applying ➔ success). S3 PDF downloads & atomic credit tracking.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 self-start sm:self-auto">
            {autonomousApps?.length || 0} Autonomous Runs
          </span>
        </div>

        {(!autonomousApps || autonomousApps.length === 0) ? (
          <div className="text-center py-10 text-slate-400 dark:text-zinc-500 text-sm">
            No autonomous event-driven applications yet. Click &quot;Autonomous Ingest (NATS + RAG)&quot; above to trigger an end-to-end background run!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400">
                  <th className="py-2.5 px-3 font-semibold">Target Opening</th>
                  <th className="py-2.5 px-3 font-semibold">Status Lifecycle</th>
                  <th className="py-2.5 px-3 font-semibold">S3 Resume PDF</th>
                  <th className="py-2.5 px-3 font-semibold">HitL / Alert</th>
                  <th className="py-2.5 px-3 font-semibold">Initiated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                {autonomousApps.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-900/40 transition">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900 dark:text-zinc-100">{app.companyName || 'Company'}</div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400">{app.jobTitle || 'Role'}</div>
                      <a
                        href={app.jobUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 mt-0.5"
                      >
                        {app.jobUrl.slice(0, 35)}... <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </td>

                    <td className="py-3 px-3">
                      {app.status === 'pending' && (
                        <span className="px-2.5 py-1 rounded-full font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] flex items-center gap-1 w-max">
                          <Clock className="w-3 h-3" /> In NATS Queue
                        </span>
                      )}
                      {app.status === 'generating_resume' && (
                        <span className="px-2.5 py-1 rounded-full font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[11px] flex items-center gap-1 w-max">
                          <RefreshCw className="w-3 h-3 animate-spin" /> RAG & Vector Search
                        </span>
                      )}
                      {app.status === 'applying' && (
                        <span className="px-2.5 py-1 rounded-full font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] flex items-center gap-1 w-max">
                          <Bot className="w-3 h-3 animate-pulse" /> Playwright + AgentQL
                        </span>
                      )}
                      {app.status === 'hitl_required' && (
                        <span className="px-2.5 py-1 rounded-full font-semibold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 text-[11px] flex items-center gap-1 w-max animate-bounce">
                          <AlertTriangle className="w-3 h-3 text-amber-600" /> Action Required (HitL)
                        </span>
                      )}
                      {app.status === 'success' && (
                        <span className="px-2.5 py-1 rounded-full font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] flex items-center gap-1 w-max">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Submitted (1 Credit Deducted)
                        </span>
                      )}
                      {app.status === 'failed' && (
                        <span className="px-2.5 py-1 rounded-full font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[11px] flex items-center gap-1 w-max">
                          <AlertCircle className="w-3 h-3" /> Failed
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      {app.resumeS3Url ? (
                        <a
                          href={app.resumeS3Url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 font-medium text-xs transition"
                        >
                          <Download className="w-3 h-3" /> S3 PDF
                        </a>
                      ) : (
                        <span className="text-slate-400 dark:text-zinc-600 italic">Generating...</span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      {app.status === 'hitl_required' && app.hitlQuestion ? (
                        <div className="text-amber-700 dark:text-amber-400 font-medium">
                          Question: &quot;{app.hitlQuestion.slice(0, 30)}...&quot;
                        </div>
                      ) : app.errorMessage ? (
                        <span className="text-rose-600 dark:text-rose-400">{app.errorMessage}</span>
                      ) : (
                        <span className="text-slate-400 dark:text-zinc-600">-</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-slate-500 dark:text-zinc-400 text-[11px]">
                      {new Date(app.createdAtUtc).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
