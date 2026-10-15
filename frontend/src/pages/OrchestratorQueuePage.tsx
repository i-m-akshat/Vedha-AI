import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orchestratorApi, masterResumeApi, autonomousApi } from '../api';
import { ApplicationQueueItemDto, PipelineExecutionStatus } from '../types/orchestrator';
import { ActivePage } from '../components/layout/AppLayout';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Play, 
  FileText, 
  ShieldCheck, 
  Coins, 
  ExternalLink, 
  RefreshCw,
  Send,
  Check,
  Building2,
  Sparkles,
  HelpCircle
} from 'lucide-react';

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
    // Hash-routed deep link (#/orchestrator?jobUrl=...): window.location.search
    // is always empty under hash routing, so read the query from the hash.
    const hashQIndex = window.location.hash.indexOf('?');
    const jobUrl =
      hashQIndex >= 0
        ? new URLSearchParams(window.location.hash.slice(hashQIndex + 1)).get('jobUrl')
        : new URLSearchParams(window.location.search).get('jobUrl');
    if (!jobUrl) return;

    setJobUrlInput(jobUrl);
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
  }, []);

  // Queries
  const { data: masterResume } = useQuery({
    queryKey: ['masterResume'],
    queryFn: masterResumeApi.get,
  });

  const { data: queue } = useQuery({
    queryKey: ['orchestratorQueue'],
    queryFn: () => orchestratorApi.getQueue(),
    refetchInterval: 5000,
  });

  const { data: credits } = useQuery({
    queryKey: ['userCredits'],
    queryFn: autonomousApi.getCredits,
    refetchInterval: 5000,
  });

  const { data: autonomousApps } = useQuery({
    queryKey: ['autonomousApps'],
    queryFn: () => autonomousApi.getApplications(),
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (!selectedQueueItem && queue && queue.length > 0) {
      setSelectedQueueItem(queue[0]);
    }
  }, [queue, selectedQueueItem]);

  // Mutations
  const prepareMutation = useMutation({
    mutationFn: orchestratorApi.preparePackage,
    onSuccess: (newItem) => {
      queryClient.invalidateQueries({ queryKey: ['orchestratorQueue'] });
      setSelectedQueueItem(newItem);
      setJobUrlInput('');
      setCustomQuestions([]);
    }
  });

  const resolveHitlMutation = useMutation({
    mutationFn: ({ applicationId, answer }: { applicationId: string; answer: string }) =>
      autonomousApi.resolveHitl(applicationId, answer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autonomousApps'] });
      setHitlAnswerInput('');
    }
  });

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
            ? 'LinkedIn Easy Apply is ready for final review. Click "Open Job Tab" to verify and submit in your browser.'
            : (result.message || 'Application package prepared. Please review below and authorize final submit.'),
          finalUrl: result.finalPageUrl
        });
      } else if (result.success) {
        setExecutionFeedback({
          type: 'success',
          message: result.message || 'Application submitted successfully! Saved to your Job Tracker.',
          finalUrl: result.finalPageUrl
        });
      } else {
        setExecutionFeedback({
          type: 'error',
          message: result.errorDetails || result.message || 'Application encountered an issue. Please review logs.',
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

  const cancelMutation = useMutation({
    mutationFn: (id: string) => orchestratorApi.updateStatus(id, 'Cancelled'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orchestratorQueue'] });
      if (selectedQueueItem) {
        orchestratorApi.getQueueItem(selectedQueueItem.id).then(item => setSelectedQueueItem(item));
      }
      setExecutionFeedback({
        type: 'info',
        message: 'Dispatched run cancelled. The browser extension will not execute it.'
      });
    },
    onError: (err: any) => {
      setExecutionFeedback({
        type: 'error',
        message: err?.response?.data?.error || err?.message || 'Failed to cancel the run.'
      });
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

  const hitlApp = autonomousApps?.find(a => a.status === 'hitl_required');

  const addCustomQuestion = () => {
    if (!customQuestionInput.trim()) return;
    setCustomQuestions(prev => [...prev, customQuestionInput.trim()]);
    setCustomQuestionInput('');
  };

  const getSourceBadge = (source: string | number | undefined) => {
    const s = String(source || 'Universal Agent').toLowerCase();
    if (s.includes('greenhouse')) return 'Greenhouse';
    if (s.includes('lever')) return 'Lever';
    if (s.includes('ashby')) return 'Ashby';
    if (s.includes('linkedin')) return 'LinkedIn Easy Apply';
    if (s.includes('workday')) return 'Workday';
    return 'Universal Agent';
  };

  return (
    <div className="flex flex-col gap-6 font-sans text-zinc-900 dark:text-[#ededed]">
      
      {/* Top Header Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              Automated Job Applications (Auto-Apply)
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              Paste a job link to automatically tailor your resume, pre-fill screening forms, and apply.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FAF7F2] dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.06] text-xs text-zinc-700 dark:text-zinc-300">
              <Coins className="w-3.5 h-3.5 text-[#D9704F]" />
              <span>Credits: <strong className="text-zinc-900 dark:text-white font-semibold">{credits?.creditsBalance ?? 50}</strong></span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Engine Ready</span>
            </div>

            <button
              type="button"
              onClick={() => setActivePage?.('ask-aksh')}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#D9704F] hover:bg-[#C85F3E] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Open in Ask Aksh</span>
            </button>
          </div>
        </div>

        {/* Input Bar */}
        <form onSubmit={handleStartPrepare} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="url"
              placeholder="Paste job posting URL (Greenhouse, Lever, LinkedIn, Ashby, Workday)..."
              value={jobUrlInput}
              onChange={e => setJobUrlInput(e.target.value)}
              required
              className="flex-1 rounded-xl bg-[#FAF7F2] dark:bg-zinc-800/40 border border-black/[0.06] dark:border-white/[0.08] focus:border-[#D9704F] focus:ring-1 focus:ring-[#D9704F] py-3 px-4 text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={prepareMutation.isPending || !jobUrlInput.trim()}
              className="px-6 py-3 rounded-xl bg-[#D9704F] hover:bg-[#C85F3E] text-white text-xs sm:text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 flex-shrink-0 cursor-pointer"
            >
              {prepareMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Preparing Package...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Start Application</span>
                </>
              )}
            </button>
          </div>

          {/* Optional Screening Hooks */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">Optional Screening Question:</span>
            <input
              type="text"
              placeholder="e.g. 'Years in Kubernetes?'"
              value={customQuestionInput}
              onChange={e => setCustomQuestionInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomQuestion(); } }}
              className="bg-[#FAF7F2] dark:bg-zinc-800/40 border border-black/[0.06] dark:border-white/[0.08] rounded-lg px-2.5 py-1 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#D9704F] w-56"
            />
            <button
              type="button"
              onClick={addCustomQuestion}
              className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-[11px] font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              + Add
            </button>
            {customQuestions.map((q, idx) => (
              <span key={idx} className="px-2.5 py-1 rounded-lg bg-[#FAF7F2] dark:bg-zinc-800/50 border border-black/[0.04] dark:border-white/[0.06] text-zinc-700 dark:text-zinc-300 text-[11px] flex items-center gap-1.5">
                <span>{q}</span>
                <button
                  type="button"
                  onClick={() => setCustomQuestions(prev => prev.filter((_, i) => i !== idx))}
                  className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </form>
      </div>

      {/* Human-In-The-Loop Confirmation Alert */}
      {hitlApp && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Action Required for {hitlApp.companyName}</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
              Review Paused
            </span>
          </div>
          <p className="leading-relaxed">
            {hitlApp.hitlQuestion || 'A custom screening question requires your confirmation before submitting.'}
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter your verified answer..."
              value={hitlAnswerInput}
              onChange={e => setHitlAnswerInput(e.target.value)}
              className="flex-1 rounded-xl bg-white dark:bg-[#16151F] border border-amber-500/40 px-3 py-1.5 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={() => resolveHitlMutation.mutate({ applicationId: hitlApp.id, answer: hitlAnswerInput })}
              disabled={!hitlAnswerInput.trim() || resolveHitlMutation.isPending}
              className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-semibold text-xs disabled:opacity-50 cursor-pointer"
            >
              {resolveHitlMutation.isPending ? 'Submitting...' : 'Confirm & Continue'}
            </button>
          </div>
        </div>
      )}

      {/* Feedback Banner */}
      {executionFeedback && (
        <div className={`p-4 rounded-2xl border text-xs space-y-2 ${
          executionFeedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300' :
          executionFeedback.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300' :
          'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
        }`}>
          <div className="flex items-center justify-between">
            <span className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Application Update</span>
            </span>
            <button onClick={() => setExecutionFeedback(null)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white">✕</button>
          </div>
          <p className="leading-relaxed">{executionFeedback.message}</p>
        </div>
      )}

      {/* Application Preview & Review Deck Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (8 cols): Application Information Form */}
        <section className="lg:col-span-8 flex flex-col gap-4">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#D9704F]/10 text-[#D9704F] border border-[#D9704F]/20 flex items-center justify-center font-bold text-sm">
                  {selectedQueueItem?.targetCompany?.slice(0, 2).toUpperCase() || 'AI'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">
                      {selectedQueueItem?.targetRole || 'Select an application from the queue'}
                    </h2>
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {selectedQueueItem?.targetCompany || 'Target Employer'} • {getSourceBadge(selectedQueueItem?.detectedSource)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                  97% Match
                </span>
                {selectedQueueItem?.jobUrl && (
                  <a
                    href={selectedQueueItem.jobUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg bg-[#FAF7F2] dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-black/[0.04] dark:border-white/[0.06] transition-colors"
                    title="Open original job posting"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            {/* Candidate Pre-filled Info */}
            <div className="space-y-4">
              <span className="text-xs font-semibold text-zinc-900 dark:text-white block">Pre-filled Application Details</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#FAF7F2] dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.06] space-y-1">
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Full Name:</span>
                  <div className="text-zinc-900 dark:text-white font-medium">
                    {masterResume?.schema?.personalInfo?.fullName || 'Alex Morgan'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#FAF7F2] dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.06] space-y-1">
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Email Address:</span>
                  <div className="text-zinc-900 dark:text-white font-medium">
                    {masterResume?.schema?.personalInfo?.email || 'alex.morgan@example.com'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#FAF7F2] dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.06] space-y-1 sm:col-span-2">
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Attached Resume:</span>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-900 dark:text-white font-medium flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#D9704F]" />
                      <span>{selectedQueueItem?.targetCompany ? `${selectedQueueItem.targetCompany}_Tailored_Resume.pdf` : 'Tailored_Resume_v4.2.pdf'}</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                      ATS Optimized
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Screening Answers */}
            <div className="space-y-3 pt-2">
              <span className="text-xs font-semibold text-zinc-900 dark:text-white block">Pre-filled Screening Questionnaire</span>

              {selectedQueueItem?.prefilledAnswers && selectedQueueItem.prefilledAnswers.length > 0 ? (
                selectedQueueItem.prefilledAnswers.map((ans, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-[#FAF7F2] dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.06] space-y-2 text-xs">
                    <div className="font-semibold text-zinc-900 dark:text-white">Q: {ans.questionText}</div>
                    <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">&ldquo;{ans.answerText}&rdquo;</p>
                  </div>
                ))
              ) : (
                <div className="p-3.5 rounded-xl bg-[#FAF7F2] dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.06] space-y-2 text-xs">
                  <div className="font-semibold text-zinc-900 dark:text-white">Q: Why are you interested in this role?</div>
                  <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    &ldquo;My extensive experience in large-scale distributed architectures and telemetry ingesters aligns directly with your platform scalability goals, allowing me to deliver high impact from day one.&rdquo;
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right Column (4 cols): Application Action Controls */}
        <section className="lg:col-span-4 flex flex-col gap-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight">
              Application Controls
            </h3>

            {/* Options */}
            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between p-3 rounded-xl bg-[#FAF7F2] dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.06] cursor-pointer">
                <span className="text-zinc-900 dark:text-white font-medium">Review Before Final Submit</span>
                <input
                  type="checkbox"
                  checked={isCopilotMode}
                  onChange={e => setIsCopilotMode(e.target.checked)}
                  className="w-4 h-4 rounded text-[#D9704F] accent-[#D9704F] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-[#FAF7F2] dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.06] cursor-pointer">
                <span className="text-zinc-900 dark:text-white font-medium">Show Browser Window</span>
                <input
                  type="checkbox"
                  checked={isHeadedBrowser}
                  onChange={e => setIsHeadedBrowser(e.target.checked)}
                  className="w-4 h-4 rounded text-[#D9704F] accent-[#D9704F] cursor-pointer"
                />
              </label>
            </div>

            {/* Primary Action Button */}
            {selectedQueueItem ? (
              selectedQueueItem.status === PipelineExecutionStatus.PausedForUserReview ? (
                <button
                  onClick={() => executeMutation.mutate({
                    id: selectedQueueItem.id,
                    headed: isHeadedBrowser,
                    copilot: false
                  })}
                  disabled={executeMutation.isPending}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {executeMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Authorize &amp; Finalize Submit</span>
                </button>
              ) : selectedQueueItem.status === PipelineExecutionStatus.Submitted ? (
                <div className="w-full py-3 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold text-xs text-center flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Submitted Successfully</span>
                </div>
              ) : selectedQueueItem.status === PipelineExecutionStatus.DispatchedToExtension ? (
                <div className="w-full p-4 rounded-xl bg-sky-500/10 border border-sky-500/20 space-y-3">
                  <div className="flex items-center gap-2 text-sky-700 dark:text-sky-300 font-semibold text-xs">
                    <Clock className="w-4 h-4" />
                    <span>Waiting for browser extension</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Dispatched. Open the job posting in a tab with the Vedha extension active — it will claim and fill this run, then report back here.
                  </p>
                  <button
                    onClick={() => cancelMutation.mutate(selectedQueueItem.id)}
                    disabled={cancelMutation.isPending}
                    className="w-full py-2 px-4 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/20 text-rose-700 dark:text-rose-300 font-semibold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {cancelMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <AlertCircle className="w-4 h-4" />}
                    <span>Cancel dispatched run</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => executeMutation.mutate({
                    id: selectedQueueItem.id,
                    headed: isHeadedBrowser,
                    copilot: isCopilotMode
                  })}
                  disabled={executeMutation.isPending}
                  className="w-full py-3 px-4 rounded-xl bg-[#D9704F] hover:bg-[#C85F3E] text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {executeMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Submitting Application...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Auto-Apply Now</span>
                    </>
                  )}
                </button>
              )
            ) : (
              <div className="py-3 px-4 rounded-xl bg-[#FAF7F2] dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 text-xs text-center border border-black/[0.04] dark:border-white/[0.06]">
                Select an application to begin
              </div>
            )}
          </div>

          {/* Supported Job Platforms Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] shadow-sm space-y-3">
            <span className="text-xs font-semibold text-zinc-900 dark:text-white block">Supported Job Platforms</span>
            <div className="space-y-2 text-xs">
              {[
                { name: 'Greenhouse ATS', desc: 'Direct API & Form Auto-fill', ready: true },
                { name: 'LinkedIn Easy Apply', desc: 'Automated Multi-Step Solver', ready: true },
                { name: 'Lever Direct', desc: 'Cover Note & Screening Mapping', ready: true },
                { name: 'Workday Portal', desc: 'Multi-Step Wizard Support', ready: true },
              ].map((p, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF7F2] dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.06]">
                  <div>
                    <div className="text-zinc-900 dark:text-white font-medium">{p.name}</div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{p.desc}</div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                    Ready
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Applications Table */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">
            Recent Applications
          </h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Total in Queue: {queue?.length || 0}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-black/[0.06] dark:border-white/[0.08] text-zinc-500 dark:text-zinc-400">
                <th className="py-3 px-4 font-semibold">Date &amp; Time</th>
                <th className="py-3 px-4 font-semibold">Job Title &amp; Company</th>
                <th className="py-3 px-4 font-semibold">Platform</th>
                <th className="py-3 px-4 font-semibold">Match Score</th>
                <th className="py-3 px-4 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.06] text-zinc-900 dark:text-white">
              {queue && queue.length > 0 ? (
                queue.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedQueueItem(item)}
                    className={`cursor-pointer transition-colors ${selectedQueueItem?.id === item.id ? 'bg-[#FAF7F2] dark:bg-zinc-800/50' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/30'}`}
                  >
                    <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400">
                      {item.createdAtUtc ? new Date(item.createdAtUtc).toLocaleDateString() : 'Today'}
                    </td>
                    <td className="py-3 px-4 font-semibold">
                      {item.targetRole} • {item.targetCompany}
                    </td>
                    <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400">
                      {getSourceBadge(item.detectedSource)}
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                      97%
                    </td>
                    <td className="py-3 px-4 text-right">
                      {item.status === PipelineExecutionStatus.Submitted ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] border border-emerald-500/20">
                          Submitted
                        </span>
                      ) : item.status === PipelineExecutionStatus.PausedForUserReview ? (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold text-[11px] border border-amber-500/20">
                          Ready for Review
                        </span>
                      ) : item.status === PipelineExecutionStatus.DispatchedToExtension ? (
                        <span className="px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300 font-semibold text-[11px] border border-sky-500/20">
                          Waiting for Extension
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-[#D9704F]/10 text-[#D9704F] font-semibold text-[11px] border border-[#D9704F]/20">
                          Queued
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                    No job applications in queue. Enter a job link above to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
