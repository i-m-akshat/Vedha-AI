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
    <div className="flex flex-col w-full gap-6 font-sans text-[#e2e4e9]">
      
      {/* Top Header Card */}
      <div className="p-6 rounded-2xl bg-[#111216] border border-[#23252b] space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Resume Tailoring Studio
            </h1>
            <p className="text-xs sm:text-sm text-[#8e929b] mt-0.5">
              Customize your resume to match specific job requirements for 95%+ ATS alignment.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-[#16181f] p-1 rounded-xl border border-[#23252b] text-xs self-start md:self-auto">
            <button
              onClick={() => setInputMode('url')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                inputMode === 'url' ? 'bg-indigo-600 text-white font-semibold' : 'text-[#8e929b] hover:text-white'
              }`}
            >
              Job Posting URL
            </button>
            <button
              onClick={() => setInputMode('text')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                inputMode === 'text' ? 'bg-indigo-600 text-white font-semibold' : 'text-[#8e929b] hover:text-white'
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
              className="flex-1 rounded-xl bg-[#16181f] border border-[#2a2d36] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 py-3 px-4 text-xs sm:text-sm text-white placeholder-[#555866] outline-none transition-colors"
            />
          ) : (
            <textarea
              rows={3}
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              placeholder="Paste full job description text here..."
              className="flex-1 rounded-xl bg-[#16181f] border border-[#2a2d36] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 p-3 text-xs sm:text-sm text-white placeholder-[#555866] outline-none transition-colors resize-none"
            />
          )}

          <button
            onClick={handleStartGeneration}
            disabled={isGenerating}
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 flex-shrink-0"
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
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-white hover:underline text-xs">Dismiss</button>
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
            <div className="p-5 rounded-2xl bg-[#111216] border border-[#23252b] space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold text-indigo-400 block uppercase tracking-wider">
                    Target Role
                  </span>
                  <h2 className="text-lg font-bold text-white tracking-tight mt-0.5">
                    {tailoredResult.targetRole || 'Target Role'}
                  </h2>
                  <p className="text-xs text-[#8e929b] mt-0.5">
                    {tailoredResult.targetCompany ? `@ ${tailoredResult.targetCompany}` : 'Target Opportunity'}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-[#16181f] border border-[#2a2d36] text-white text-xs font-semibold">
                  {tailoredResult.selectedTemplate || 'Classic ATS'}
                </span>
              </div>

              {/* Match Score Card */}
              <div className="p-4 rounded-xl bg-[#16181f] border border-[#23252b] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    ATS Match Score
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold">
                    {overallScore}% Match
                  </span>
                </div>

                <div className="flex items-center gap-5">
                  <div className="relative w-20 h-20 flex-shrink-0 flex items-center justify-center">
                    <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-[#23252b]"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.5"
                      />
                      <path
                        className="text-emerald-400"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeDasharray={`${overallScore}, 100`}
                        strokeLinecap="round"
                        strokeWidth="3.5"
                      />
                    </svg>
                    <div className="absolute text-center">
                      <span className="text-base font-bold text-white block">{overallScore}%</span>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-[#8e929b]">
                    <div>Keyword Match: <strong className="text-white">{tailoredResult.atsAnalysis.keywordMatchScore}%</strong></div>
                    <div>Skills Match: <strong className="text-white">{tailoredResult.atsAnalysis.skillsMatchScore}%</strong></div>
                    <div>Experience Relevance: <strong className="text-white">{tailoredResult.atsAnalysis.experienceRelevanceScore}%</strong></div>
                  </div>
                </div>
              </div>

              {/* Key Skills Identified */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-white block">
                  Matched Keywords &amp; Competencies ({allMatchedTerms.length})
                </span>
                <div className="flex flex-wrap gap-1.5 text-xs max-h-40 overflow-y-auto pr-1">
                  {allMatchedTerms.length > 0 ? (
                    allMatchedTerms.map((skill, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-[#16181f] border border-[#2a2d36] text-[#c4c7d0] text-[11px] font-medium flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>{skill}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[#6c707d]">No direct keyword matches found.</span>
                  )}
                </div>
              </div>

              {/* Missing Skills Warning */}
              {missingTerms.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-[#23252b]">
                  <span className="text-xs font-semibold text-amber-400 block">
                    Recommended Keywords to Consider ({missingTerms.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5 text-xs max-h-32 overflow-y-auto pr-1">
                    {missingTerms.map((sk, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
                        + {sk}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Recruiter Feedback Card */}
            {tailoredResult.atsAnalysis.recruiterFeedback && (
              <div className="p-4 rounded-2xl bg-[#111216] border border-[#23252b] space-y-2">
                <span className="text-xs font-semibold text-indigo-400 block uppercase tracking-wider">
                  AI Recruiter Assessment
                </span>
                <p className="text-xs text-[#8e929b] leading-relaxed">
                  {tailoredResult.atsAnalysis.recruiterFeedback}
                </p>
              </div>
            )}
          </section>

          {/* Right Column (7 Cols): Bullet Diff & Customizations */}
          <section className="lg:col-span-7 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">
                  Resume Enhancements &amp; Changes
                </h2>
                <p className="text-xs text-[#8e929b]">
                  Compare your original master experience against the optimized tailored bullets.
                </p>
              </div>

              <div className="flex bg-[#16181f] p-1 rounded-xl border border-[#23252b] text-xs self-start sm:self-auto">
                <button
                  onClick={() => setActiveDiffFilter('all')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    activeDiffFilter === 'all' ? 'bg-white text-zinc-950 font-semibold' : 'text-[#8e929b] hover:text-white'
                  }`}
                >
                  All Changes
                </button>
                <button
                  onClick={() => setActiveDiffFilter('keywords')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    activeDiffFilter === 'keywords' ? 'bg-white text-zinc-950 font-semibold' : 'text-[#8e929b] hover:text-white'
                  }`}
                >
                  Keywords
                </button>
                <button
                  onClick={() => setActiveDiffFilter('impact')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    activeDiffFilter === 'impact' ? 'bg-white text-zinc-950 font-semibold' : 'text-[#8e929b] hover:text-white'
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
                    <div key={exp.id || expIdx} className="p-5 rounded-2xl bg-[#111216] border border-[#23252b] space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">
                          {exp.role} • {exp.company}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 text-[10px] font-semibold border border-indigo-500/20">
                          {exp.startDate} - {exp.isCurrent ? 'Present' : exp.endDate}
                        </span>
                      </div>

                      {tailoredHighlights.map((tailoredBullet, bIdx) => {
                        const originalBullet = originalHighlights[bIdx];
                        return (
                          <div key={bIdx} className="space-y-2 pt-1 border-t border-[#1e2027]">
                            {/* Original */}
                            {originalBullet && originalBullet !== tailoredBullet && (
                              <div className="p-3 rounded-xl bg-[#16181f] border border-[#23252b] text-xs text-[#8e929b] leading-relaxed">
                                <span className="text-[10px] font-semibold uppercase text-[#6c707d] block mb-1">
                                  Original Master Bullet:
                                </span>
                                {originalBullet}
                              </div>
                            )}

                            {/* Tailored */}
                            <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-500/30 text-xs text-white leading-relaxed">
                              <span className="text-[10px] font-semibold uppercase text-indigo-400 block mb-1">
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
                <div className="p-8 rounded-2xl bg-[#111216] border border-[#23252b] text-center text-xs text-[#8e929b]">
                  No tailored experience bullets found.
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="p-4 rounded-2xl bg-[#111216] border border-[#23252b] flex items-center justify-between">
              <span className="text-xs text-[#8e929b]">Ready to inspect your full formatted resume and export?</span>
              <button
                onClick={() => setActivePage('result-studio')}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
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
        <div className="p-8 sm:p-12 rounded-2xl bg-[#111216] border border-[#23252b] space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Ready to Tailor Your Resume
            </h2>
            <p className="text-xs sm:text-sm text-[#8e929b] leading-relaxed">
              Enter a job posting URL or paste the job description above. Our AI aligns your experience, highlights critical keywords, and tunes your bullets for 95%+ ATS matching.
            </p>
          </div>

          {/* 3 Simple Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl bg-[#16181f] border border-[#23252b] space-y-2">
              <span className="text-xs font-bold text-indigo-400">Step 1</span>
              <h3 className="text-sm font-semibold text-white">Target Job Input</h3>
              <p className="text-xs text-[#8e929b]">
                Paste any job posting link (LinkedIn, Greenhouse, Lever, Ashby, or company career page) or raw job description text.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#16181f] border border-[#23252b] space-y-2">
              <span className="text-xs font-bold text-indigo-400">Step 2</span>
              <h3 className="text-sm font-semibold text-white">Select Resume Style</h3>
              <p className="text-xs text-[#8e929b]">
                Choose from ATS Classic, Modern Minimalist, Executive Clean, or Technical Pro layouts.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#16181f] border border-[#23252b] space-y-2">
              <span className="text-xs font-bold text-indigo-400">Step 3</span>
              <h3 className="text-sm font-semibold text-white">Generate &amp; Review</h3>
              <p className="text-xs text-[#8e929b]">
                Click "Tailor Resume" to inspect matched keywords, bullet enhancements, and export PDF or Word documents.
              </p>
            </div>
          </div>

          {/* Template Selection Preview */}
          <div className="space-y-3 pt-4 border-t border-[#23252b]">
            <span className="text-xs font-semibold text-white block">
              Choose Your Default Template Style:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {templateOptions.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setSelectedTemplate(tpl.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedTemplate === tpl.id
                      ? 'border-indigo-500 bg-indigo-950/30 text-white shadow-sm'
                      : 'border-[#23252b] bg-[#16181f] text-[#8e929b] hover:border-[#323640] hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-white">{tpl.name}</span>
                    {selectedTemplate === tpl.id && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                  </div>
                  <p className="text-[11px] leading-relaxed text-[#8e929b]">{tpl.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Master Resume Status Check */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[#16181f] border border-[#23252b] text-xs">
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>
                Master Resume Status:{' '}
                {masterResume ? (
                  <strong className="text-emerald-400 font-semibold">Loaded ({masterResume.title || 'Master'})</strong>
                ) : (
                  <strong className="text-amber-400 font-semibold">Not Uploaded Yet</strong>
                )}
              </span>
            </div>
            {!masterResume && (
              <button
                onClick={() => setActivePage('master-resume')}
                className="text-indigo-400 hover:text-indigo-300 font-medium underline"
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
