import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Loader2, 
  FileText, 
  Check, 
  TrendingUp, 
  ArrowRight,
  Layers,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  RefreshCw,
  LayoutTemplate
} from 'lucide-react';
import { useTailorStore, useResumeStore } from '../stores/useTailorStore';
import { useAuthStore } from '../stores/useAuthStore';
import { tailorApi } from '../api';
import { TemplateStyle, sortExperiencesChronologically } from '../types/resume';
import { AiProviderType } from '../types/shared';
import { ActivePage } from '../components/layout/AppLayout';

export const TailorStudioPage: React.FC<{ setActivePage: (p: ActivePage) => void }> = ({ setActivePage }) => {
  const { user } = useAuthStore();
  const { masterResume, fetchMasterResume } = useResumeStore();
  const { 
    isGenerating, 
    generateTailoring, 
    selectedTemplate, 
    setSelectedTemplate,
    tailoredResult,
    setTailoredResult
  } = useTailorStore();

  const [jobUrl, setJobUrl] = useState('');
  const [jobText, setJobText] = useState('');
  const [inputMode, setInputMode] = useState<'url' | 'text'>('url');
  const [activeDiffFilter, setActiveDiffFilter] = useState<'all' | 'keywords' | 'impact'>('all');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMasterResume();

    // If no active tailored result is in memory, check if user has previous generations
    if (!tailoredResult) {
      setIsLoadingHistory(true);
      tailorApi.getHistory()
        .then((history) => {
          if (history && history.length > 0) {
            return tailorApi.getById(history[0].id).then((full) => {
              setTailoredResult(full);
            });
          }
        })
        .catch(() => {
          // Silent catch on history auto-load
        })
        .finally(() => {
          setIsLoadingHistory(false);
        });
    }
  }, []);

  const handleStartGeneration = async () => {
    if (!user) return;
    setError(null);

    if (!masterResume) {
      setError('Please upload or create a Master Resume before tailoring.');
      return;
    }

    if (inputMode === 'url' && !jobUrl.trim()) {
      setError('Please enter a target Job Posting URL.');
      return;
    }

    if (inputMode === 'text' && !jobText.trim()) {
      setError('Please paste the Job Description text.');
      return;
    }

    try {
      const result = await generateTailoring(
        {
          masterResumeId: masterResume.id,
          directJobUrl: inputMode === 'url' ? jobUrl.trim() : undefined,
          directJobText: inputMode === 'text' ? jobText.trim() : undefined,
          selectedTemplate: selectedTemplate,
          providerOverride: user?.preferredAiProvider || AiProviderType.Gemini,
        },
        user.id
      );

      setTailoredResult(result);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Resume tailoring failed. Please check the job description.');
    }
  };

  const templateOptions = [
    { id: TemplateStyle.ClassicAts, name: 'Classic ATS', desc: 'Single-column, high-contrast, optimized for legacy applicant tracking systems.' },
    { id: TemplateStyle.ModernMinimalist, name: 'Modern Minimalist', desc: 'Clean typography, subtle divider lines, balanced whitespace.' },
    { id: TemplateStyle.ExecutiveClean, name: 'Executive Clean', desc: 'Authoritative styling with emphasized leadership & impact metrics.' },
    { id: TemplateStyle.TechnicalPro, name: 'Technical Pro', desc: 'Structured competency blocks, developer skills matrix, and project links.' },
  ];

  // Helper to filter highlights based on active filter
  const filterHighlights = (originalHighlights: string[], tailoredHighlights: string[], keywords: string[]) => {
    if (activeDiffFilter === 'keywords') {
      const kwLower = keywords.map(k => k.toLowerCase());
      return tailoredHighlights.filter(h => kwLower.some(k => h.toLowerCase().includes(k)));
    }
    if (activeDiffFilter === 'impact') {
      // Filter bullets containing numbers, percentages, currency, or metrics
      const metricRegex = /\d+%|\d+x|\$\d+|\d+\+|\b\d+\b/;
      return tailoredHighlights.filter(h => metricRegex.test(h));
    }
    return tailoredHighlights;
  };

  const matchingKeywords = tailoredResult?.atsAnalysis?.matchingKeywords || [];
  const matchingSkills = tailoredResult?.atsAnalysis?.matchingSkills || [];
  const allMatchedTerms = Array.from(new Set([...matchingKeywords, ...matchingSkills]));
  const missingTerms = tailoredResult?.atsAnalysis?.missingKeywords || [];
  const overallScore = tailoredResult?.atsAnalysis?.overallScore ?? 0;

  return (
    <div className="flex flex-col w-full gap-6 font-sans text-zinc-900 dark:text-[#ededed]">
      
      {/* Top Header Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              Resume Tailoring Studio
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              Customize your resume to match specific job requirements for 95%+ ATS alignment.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-black/[0.04] dark:bg-white/[0.06] p-1 rounded-xl border border-black/[0.05] dark:border-white/[0.08] text-xs self-start md:self-auto">
            <button
              onClick={() => setInputMode('url')}
              className={`px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                inputMode === 'url' ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-semibold shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Job Posting URL
            </button>
            <button
              onClick={() => setInputMode('text')}
              className={`px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                inputMode === 'text' ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-semibold shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Paste Job Description
            </button>
          </div>
        </div>

        {/* Input Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          {inputMode === 'url' ? (
            <input
              type="url"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              placeholder="Paste LinkedIn, Greenhouse, Lever, Ashby, or company job URL..."
              className="flex-1 rounded-xl bg-white dark:bg-zinc-900/80 border border-black/[0.08] dark:border-white/[0.08] focus:border-zinc-400 dark:focus:border-white/30 py-3 px-4 text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-colors shadow-inner"
            />
          ) : (
            <textarea
              rows={3}
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              placeholder="Paste full job description text here..."
              className="flex-1 rounded-xl bg-white dark:bg-zinc-900/80 border border-black/[0.08] dark:border-white/[0.08] focus:border-zinc-400 dark:focus:border-white/30 p-3 text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-colors resize-none shadow-inner"
            />
          )}

          <button
            onClick={handleStartGeneration}
            disabled={isGenerating}
            className="px-6 py-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs sm:text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 flex-shrink-0 cursor-pointer active:scale-95"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Tailoring Resume...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Tailor Resume</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-zinc-900 dark:text-white hover:underline text-xs cursor-pointer">Dismiss</button>
          </div>
        )}
      </div>

      {isLoadingHistory && (
        <div className="p-12 text-center text-[#8e929b] text-sm flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
          <span>Loading your latest tailored resume...</span>
        </div>
      )}

      {/* When Tailored Result Exists */}
      {!isLoadingHistory && tailoredResult && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column (5 Cols): Target Opening & Match Analysis */}
          <section className="lg:col-span-5 flex flex-col gap-5">
            {/* Target Job Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold text-[#D9704F] dark:text-[#F39A7E] block uppercase tracking-wider">
                    Target Role
                  </span>
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight mt-0.5">
                    {tailoredResult.targetRole || 'Target Role'}
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {tailoredResult.targetCompany ? `@ ${tailoredResult.targetCompany}` : 'Target Opportunity'}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-black/[0.04] dark:bg-zinc-800 border border-black/[0.05] dark:border-white/[0.06] text-zinc-800 dark:text-zinc-200 text-xs font-semibold">
                  {tailoredResult.selectedTemplate || 'Classic ATS'}
                </span>
              </div>

              {/* Match Score Card */}
              <div className="p-4 rounded-xl bg-[#FAF7F2] dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    ATS Match Score
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold font-mono">
                    {overallScore}% Match
                  </span>
                </div>

                <div className="flex items-center gap-5">
                  <div className="relative w-20 h-20 flex-shrink-0 flex items-center justify-center">
                    <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-zinc-200 dark:text-zinc-800"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.5"
                      />
                      <path
                        className="text-emerald-500"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeDasharray={`${overallScore}, 100`}
                        strokeLinecap="round"
                        strokeWidth="3.5"
                      />
                    </svg>
                    <div className="absolute text-center">
                      <span className="text-base font-bold text-zinc-900 dark:text-white block font-mono">{overallScore}%</span>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                    <div>Keyword Match: <strong className="text-zinc-900 dark:text-white font-mono">{tailoredResult.atsAnalysis.keywordMatchScore}%</strong></div>
                    <div>Skills Match: <strong className="text-zinc-900 dark:text-white font-mono">{tailoredResult.atsAnalysis.skillsMatchScore}%</strong></div>
                    <div>Experience Relevance: <strong className="text-zinc-900 dark:text-white font-mono">{tailoredResult.atsAnalysis.experienceRelevanceScore}%</strong></div>
                  </div>
                </div>
              </div>

              {/* Key Skills Identified */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-zinc-900 dark:text-white block">
                  Matched Keywords &amp; Competencies ({allMatchedTerms.length})
                </span>
                <div className="flex flex-wrap gap-1.5 text-xs max-h-40 overflow-y-auto pr-1">
                  {allMatchedTerms.length > 0 ? (
                    allMatchedTerms.map((skill, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-black/[0.03] dark:bg-zinc-800/60 border border-black/[0.06] dark:border-white/[0.08] text-zinc-800 dark:text-zinc-200 text-[11px] font-medium flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span>{skill}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">No direct keyword matches found.</span>
                  )}
                </div>
              </div>

              {/* Missing Skills Warning */}
              {missingTerms.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-black/[0.05] dark:border-white/[0.06]">
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 block">
                    Recommended Keywords to Consider ({missingTerms.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5 text-xs max-h-32 overflow-y-auto pr-1">
                    {missingTerms.map((sk, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px]">
                        + {sk}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Recruiter Feedback Card */}
            {tailoredResult.atsAnalysis.recruiterFeedback && (
              <div className="p-4 rounded-2xl bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] shadow-sm space-y-2">
                <span className="text-xs font-semibold text-[#D9704F] dark:text-[#F39A7E] block uppercase tracking-wider">
                  AI Recruiter Assessment
                </span>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {tailoredResult.atsAnalysis.recruiterFeedback}
                </p>
              </div>
            )}
          </section>

          {/* Right Column (7 Cols): Bullet Diff & Customizations */}
          <section className="lg:col-span-7 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">
                  Resume Enhancements &amp; Changes
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Compare your original master experience against the optimized tailored bullets.
                </p>
              </div>

              <div className="flex bg-black/[0.04] dark:bg-white/[0.06] p-1 rounded-xl border border-black/[0.05] dark:border-white/[0.08] text-xs self-start sm:self-auto">
                <button
                  onClick={() => setActiveDiffFilter('all')}
                  className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    activeDiffFilter === 'all' ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-semibold shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  All Changes
                </button>
                <button
                  onClick={() => setActiveDiffFilter('keywords')}
                  className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    activeDiffFilter === 'keywords' ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-semibold shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  Keywords
                </button>
                <button
                  onClick={() => setActiveDiffFilter('impact')}
                  className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    activeDiffFilter === 'impact' ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-semibold shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  Metrics
                </button>
              </div>
            </div>

            {/* Experience Diffs */}
            <div className="space-y-4">
              {tailoredResult.tailoredSchema.experience && tailoredResult.tailoredSchema.experience.length > 0 ? (
                sortExperiencesChronologically(tailoredResult.tailoredSchema.experience).map((exp, expIdx) => {
                  const masterExp = tailoredResult.masterSchema.experience?.find(m => m.company.toLowerCase() === exp.company.toLowerCase()) || tailoredResult.masterSchema.experience?.[expIdx];
                  const originalHighlights = masterExp?.highlights || [];
                  const tailoredHighlights = filterHighlights(originalHighlights, exp.highlights || [], allMatchedTerms);

                  return (
                    <div key={exp.id || expIdx} className="p-5 rounded-2xl bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] shadow-sm space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-zinc-900 dark:text-white">
                          {exp.role} • {exp.company}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#FDF2EE] dark:bg-[#2A1B16] text-[#D9704F] dark:text-[#F39A7E] text-[10px] font-semibold border border-[#FAD9CE] dark:border-[#542B20]">
                          {exp.startDate} - {exp.isCurrent ? 'Present' : exp.endDate}
                        </span>
                      </div>

                      {tailoredHighlights.map((tailoredBullet, bIdx) => {
                        const originalBullet = originalHighlights[bIdx];
                        return (
                          <div key={bIdx} className="space-y-2 pt-1 border-t border-black/[0.05] dark:border-white/[0.06]">
                            {/* Original */}
                            {originalBullet && originalBullet !== tailoredBullet && (
                              <div className="p-3 rounded-xl bg-[#FAF7F2] dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.06] text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                <span className="text-[10px] font-semibold uppercase text-zinc-400 dark:text-zinc-500 block mb-1">
                                  Original Master Bullet:
                                </span>
                                {originalBullet}
                              </div>
                            )}

                            {/* Tailored */}
                            <div className="p-3 rounded-xl bg-emerald-500/[0.06] dark:bg-emerald-950/20 border border-emerald-500/20 text-xs text-zinc-900 dark:text-white leading-relaxed">
                              <span className="text-[10px] font-semibold uppercase text-emerald-600 dark:text-emerald-400 block mb-1">
                                Tailored Bullet (Optimized):
                              </span>
                              {tailoredBullet}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              ) : (
                <div className="p-8 rounded-2xl bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] text-center text-xs text-zinc-500 dark:text-zinc-400 shadow-sm">
                  No tailored experience bullets found.
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] shadow-sm flex items-center justify-between">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Ready to inspect your full formatted resume and export?</span>
              <button
                onClick={() => setActivePage('result-studio')}
                className="px-4 py-2 rounded-xl bg-[#D9704F] hover:bg-[#C85F3E] text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span>View Full Formatted Resume</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Empty State: Ready to Tailor */}
      {!isLoadingHistory && !tailoredResult && (
        <div className="p-8 sm:p-12 rounded-3xl bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] shadow-sm space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-3">
            <div className="relative inline-block group">
              <div className="w-56 h-40 sm:w-64 sm:h-44 rounded-3xl overflow-hidden bg-gradient-to-b from-[#FDF5EE] to-[#FBF0E6] dark:from-[#231F2E] dark:to-[#181622] border border-[#D9704F]/20 dark:border-[#D9704F]/30 p-2 shadow-sm flex items-center justify-center transition-transform duration-300 group-hover:scale-[1.02]">
                <img
                  src="/assets/resume-tailor-illustration.png"
                  alt="Resume Tailoring & Optimization"
                  className="w-full h-full object-contain filter drop-shadow-sm"
                />
              </div>
              <div className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full bg-[#D9704F] text-white text-[10px] font-bold shadow-sm border border-white dark:border-[#16151F] flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-200" />
                <span>95%+ ATS Match</span>
              </div>
            </div>

            <h2 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight pt-1">
              Ready to Tailor Your Resume
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-lg mx-auto">
              Enter a job posting URL or paste the job description above. Our AI aligns your experience, highlights critical keywords, and tunes your bullets with Google XYZ metrics.
            </p>
          </div>

          {/* 3 Simple Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl bg-[#FAF7F2] dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.06] space-y-2">
              <span className="text-xs font-bold text-[#D9704F] dark:text-[#F39A7E]">Step 1</span>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Target Job Input</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Paste any job posting link (LinkedIn, Greenhouse, Lever, Ashby, or company career page) or raw job description text.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#FAF7F2] dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.06] space-y-2">
              <span className="text-xs font-bold text-[#D9704F] dark:text-[#F39A7E]">Step 2</span>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Select Resume Style</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Choose from ATS Classic, Modern Minimalist, Executive Clean, or Technical Pro layouts.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#FAF7F2] dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.06] space-y-2">
              <span className="text-xs font-bold text-[#D9704F] dark:text-[#F39A7E]">Step 3</span>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Generate &amp; Review</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Click "Tailor Resume" to inspect matched keywords, bullet enhancements, and export PDF or Word documents.
              </p>
            </div>
          </div>

          {/* Template Selection Preview */}
          <div className="space-y-3 pt-4 border-t border-black/[0.05] dark:border-white/[0.06]">
            <span className="text-xs font-semibold text-zinc-900 dark:text-white block">
              Choose Your Default Template Style:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {templateOptions.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setSelectedTemplate(tpl.id)}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedTemplate === tpl.id
                      ? 'border-[#D9704F] bg-[#FDF2EE] dark:bg-[#2A1B16] text-[#D9704F] dark:text-[#F39A7E] shadow-sm'
                      : 'border-black/[0.06] dark:border-white/[0.08] bg-[#FAF7F2] dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-zinc-900 dark:text-white">{tpl.name}</span>
                    {selectedTemplate === tpl.id && <Check className="w-3.5 h-3.5 text-[#D9704F] dark:text-[#F39A7E]" />}
                  </div>
                  <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">{tpl.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Master Resume Status Check */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[#FAF7F2] dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.06] text-xs">
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-[#D9704F] dark:text-[#F39A7E]" />
              <span>
                Master Resume Status:{' '}
                {masterResume ? (
                  <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">Loaded ({masterResume.title || 'Master'})</strong>
                ) : (
                  <strong className="text-amber-600 dark:text-amber-400 font-semibold">Not Uploaded Yet</strong>
                )}
              </span>
            </div>
            {!masterResume && (
              <button
                onClick={() => setActivePage('master-resume')}
                className="text-[#D9704F] hover:underline font-medium cursor-pointer"
              >
                Upload Master Resume
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
