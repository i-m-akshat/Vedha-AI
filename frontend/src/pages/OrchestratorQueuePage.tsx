import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orchestratorApi, masterResumeApi } from '../api';
import { ApplicationQueueItemDto, PipelineExecutionStatus, ScreeningQuestionAnswerDto } from '../types/orchestrator';
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
  Edit3
} from 'lucide-react';
import { Button, Card, Badge, Input } from '../components/ui';

export const OrchestratorQueuePage: React.FC = () => {
  const queryClient = useQueryClient();
  const [jobUrlInput, setJobUrlInput] = useState('');
  const [selectedQueueItem, setSelectedQueueItem] = useState<ApplicationQueueItemDto | null>(null);
  const [isCopilotMode, setIsCopilotMode] = useState(true);
  const [isHeadedBrowser, setIsHeadedBrowser] = useState(false);
  const [customQuestionInput, setCustomQuestionInput] = useState('');
  const [customQuestions, setCustomQuestions] = useState<string[]>([]);

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

  // Mutation: Execute Pipeline
  const executeMutation = useMutation({
    mutationFn: ({ id, headed, copilot }: { id: string; headed: boolean; copilot: boolean }) =>
      orchestratorApi.execute(id, headed, copilot),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['orchestratorQueue'] });
      if (selectedQueueItem) {
        orchestratorApi.getQueueItem(selectedQueueItem.id).then(item => setSelectedQueueItem(item));
      }
    }
  });

  // Mutation: Update Status
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      orchestratorApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orchestratorQueue'] });
      if (selectedQueueItem) {
        orchestratorApi.getQueueItem(selectedQueueItem.id).then(item => setSelectedQueueItem(item));
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
            Job Application Orchestrator & Copilot
          </h1>
          <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1">
            Multi-pipeline application engine: Paste any job URL to unwind redirects, auto-tailor resume, generate evidence-grounded screening answers, and execute via Copilot.
          </p>
        </div>
      </div>

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
              className="px-6 h-12 shadow-md gap-2"
            >
              {prepareMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Preparing Package...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Prepare Application Package</span>
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

              {/* Copilot Options Bar */}
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
                    {selectedQueueItem.status === PipelineExecutionStatus.PausedForUserReview
                      ? 'Confirm & Finalize'
                      : 'Launch Copilot Automation'}
                  </Button>

                  {selectedQueueItem.status === PipelineExecutionStatus.PausedForUserReview && (
                    <Button
                      onClick={() => updateStatusMutation.mutate({ id: selectedQueueItem.id, status: 'Submitted' })}
                      variant="primary"
                      size="sm"
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs font-medium"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Mark Submitted
                    </Button>
                  )}
                </div>
              </div>

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
    </div>
  );
};
