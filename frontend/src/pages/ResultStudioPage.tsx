import React, { useState, useEffect } from 'react';
import { 
  Download, 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  Mail, 
  HelpCircle, 
  Compass, 
  Copy, 
  Check, 
  RefreshCw,
  ExternalLink,
  ArrowRight
} from 'lucide-react';
import { Modal } from '../components/ui';
import { useTailorStore } from '../stores/useTailorStore';
import { tailorApi, toolsApi } from '../api';
import { ResumeFormat, TemplateStyle, sortExperiencesChronologically } from '../types/resume';
import { CoverLetterDto, InterviewPrepDto } from '../types/shared';
import { GeneratedResumeSummaryDto } from '../types/ats';
import { ActivePage } from '../components/layout/AppLayout';

export const ResultStudioPage: React.FC<{ setActivePage?: (p: ActivePage) => void }> = ({ setActivePage }) => {
  const { tailoredResult, setTailoredResult, selectedTemplate, setSelectedTemplate } = useTailorStore();
  const [downloading, setDownloading] = useState<ResumeFormat | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [historyList, setHistoryList] = useState<GeneratedResumeSummaryDto[]>([]);

  // Modals state
  const [coverLetter, setCoverLetter] = useState<CoverLetterDto | null>(null);
  const [isCoverLetterModalOpen, setIsCoverLetterModalOpen] = useState(false);
  const [isCoverLetterLoading, setIsCoverLetterLoading] = useState(false);
  const [copiedCoverLetter, setCopiedCoverLetter] = useState(false);

  const [interviewPrep, setInterviewPrep] = useState<InterviewPrepDto | null>(null);
  const [isInterviewPrepModalOpen, setIsInterviewPrepModalOpen] = useState(false);
  const [isInterviewPrepLoading, setIsInterviewPrepLoading] = useState(false);

  const [isRoadmapModalOpen, setIsRoadmapModalOpen] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [studioError, setStudioError] = useState<string | null>(null);
  const [coverLetterError, setCoverLetterError] = useState<string | null>(null);
  const [interviewPrepError, setInterviewPrepError] = useState<string | null>(null);

  useEffect(() => {
    tailorApi.getHistory().then((data) => {
      setHistoryList(data);
      if (!tailoredResult && data.length > 0) {
        setLoadingInitial(true);
        tailorApi.getById(data[0].id)
          .then((res) => setTailoredResult(res))
          .catch(() => setStudioError('The latest tailored resume could not be loaded.'))
          .finally(() => setLoadingInitial(false));
      }
    }).catch(() => setStudioError('Resume history could not be loaded.'));
  }, []);

  if (loadingInitial) {
    return (
      <div className="text-center py-24 space-y-4 font-sans">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-400" />
        <p className="text-sm font-medium text-[#8e929b]">
          Loading tailored resume and ATS scorecard...
        </p>
      </div>
    );
  }

  if (!tailoredResult) {
    return (
      <div className="text-center py-20 space-y-5 max-w-lg mx-auto font-sans">
        {studioError && (
          <div className="flex items-center gap-2.5 p-3 text-left rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{studioError}</span>
          </div>
        )}
        <div className="h-16 w-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
          <FileText className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white tracking-tight">
            No Tailored Resume Loaded
          </h3>
          <p className="text-xs text-[#8e929b] leading-relaxed">
            Please select a target job in the Tailor Studio to generate your customized resume and match scorecard.
          </p>
        </div>
        {setActivePage && (
          <button
            onClick={() => setActivePage('tailor-studio')}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors inline-flex items-center gap-2 shadow-sm"
          >
            <span>Open Tailor Studio</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  const masterSchema = tailoredResult?.masterSchema || ({} as any);
  const tailoredSchema = tailoredResult?.tailoredSchema || ({} as any);
  const atsAnalysis = tailoredResult?.atsAnalysis || ({
    overallScore: 0,
    keywordMatchScore: 0,
    skillsMatchScore: 0,
    experienceRelevanceScore: 0,
    recruiterFeedback: 'Recruiter feedback analysis is being prepared.',
    matchingKeywords: [],
    missingKeywords: [],
    matchingSkills: [],
    missingSkills: [],
    skillRoadmap: []
  } as any);

  const masterExperiences = React.useMemo(() => sortExperiencesChronologically(masterSchema?.experience || []), [masterSchema?.experience]);
  const tailoredExperiences = React.useMemo(() => sortExperiencesChronologically(tailoredSchema?.experience || []), [tailoredSchema?.experience]);

  const handleDownload = async (format: ResumeFormat) => {
    setDownloading(format);
    setDownloadError(null);
    try {
      const url = tailorApi.exportUrl(tailoredResult.id, format, selectedTemplate);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem('vedha_token') || localStorage.getItem('resumate_token')}` },
      });
      if (!res.ok) {
        throw new Error(`Export failed with status ${res.status}.`);
      }
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const extension = format === ResumeFormat.Pdf ? 'pdf' : format === ResumeFormat.Docx ? 'docx' : format === ResumeFormat.Json ? 'json' : 'md';
      const rawName = tailoredSchema?.personalInfo?.fullName || masterSchema?.personalInfo?.fullName || tailoredResult?.targetRole || 'Tailored_Resume';
      const sanitizedName = rawName.replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `${sanitizedName}_Resume.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setDownloadError('Download failed. Please check your connection and try again.');
    } finally {
      setDownloading(null);
    }
  };

  const handleGenerateCoverLetter = async () => {
    setIsCoverLetterModalOpen(true);
    setCoverLetterError(null);
    if (!coverLetter) {
      setIsCoverLetterLoading(true);
      try {
        const res = await toolsApi.generateCoverLetter(tailoredResult.id);
        setCoverLetter(res);
      } catch {
        setCoverLetterError('Cover letter generation failed. Please try again.');
      } finally {
        setIsCoverLetterLoading(false);
      }
    }
  };

  const handleGenerateInterviewPrep = async () => {
    setIsInterviewPrepModalOpen(true);
    setInterviewPrepError(null);
    if (!interviewPrep) {
      setIsInterviewPrepLoading(true);
      try {
        const res = await toolsApi.generateInterviewPrep(tailoredResult.id);
        setInterviewPrep(res);
      } catch {
        setInterviewPrepError('Interview preparation generation failed. Please try again.');
      } finally {
        setIsInterviewPrepLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6 font-sans text-zinc-900 dark:text-[#ededed]">
      {studioError && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{studioError}</span>
          <button onClick={() => setStudioError(null)} className="ml-auto cursor-pointer" aria-label="Dismiss">✕</button>
        </div>
      )}
      
      {downloadError && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{downloadError}</span>
          <button onClick={() => setDownloadError(null)} className="ml-auto text-rose-500 hover:text-rose-700 dark:hover:text-rose-200 cursor-pointer" aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* Top Action Header Bar */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">
              {tailoredResult.targetRole}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-[#FDF2EE] dark:bg-[#2A1B16] text-[#D9704F] dark:text-[#F39A7E] border border-[#FAD9CE] dark:border-[#542B20] text-xs font-semibold">
              @ {tailoredResult.targetCompany}
            </span>
            {historyList.length > 1 && (
              <select
                value={tailoredResult.id}
                onChange={async (e) => {
                  const selectedId = e.target.value;
                  try {
                    const fullResume = await tailorApi.getById(selectedId);
                    setTailoredResult(fullResume);
                    setStudioError(null);
                  } catch {
                    setStudioError('That tailored resume version could not be loaded.');
                  }
                }}
                className="text-xs py-1 px-2.5 bg-black/[0.04] dark:bg-zinc-800 border border-black/[0.08] dark:border-white/[0.08] rounded-lg text-zinc-800 dark:text-white font-medium cursor-pointer focus:outline-none"
                title="Switch tailored resume version"
              >
                {historyList.map((item) => (
                  <option key={item.id} value={item.id} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">
                    {item.targetRole} @ {item.targetCompany} ({item.matchScore}% ATS)
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2 pt-0.5">
            <span>Verified Truth-Preserved Content</span>
            <span>•</span>
            <span>ATS Match: <strong className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono">{atsAnalysis.overallScore}%</strong></span>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Template Style Selector */}
          <div className="flex items-center bg-black/[0.04] dark:bg-white/[0.06] p-1 rounded-xl border border-black/[0.05] dark:border-white/[0.08] text-xs">
            {[
              { id: TemplateStyle.ClassicAts, label: 'Classic' },
              { id: TemplateStyle.ModernMinimalist, label: 'Modern' },
              { id: TemplateStyle.ExecutiveClean, label: 'Executive' },
              { id: TemplateStyle.TechnicalPro, label: 'Technical' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSelectedTemplate(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  selectedTemplate === id ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-semibold shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Cover Letter */}
          <button
            onClick={handleGenerateCoverLetter}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-800/80 hover:bg-black/[0.04] dark:hover:bg-zinc-700 border border-black/[0.08] dark:border-white/[0.08] text-zinc-800 dark:text-white text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
          >
            <Mail className="w-3.5 h-3.5 text-[#D9704F] dark:text-[#F39A7E]" />
            <span>Cover Letter</span>
          </button>

          {/* Interview Prep */}
          <button
            onClick={handleGenerateInterviewPrep}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-800/80 hover:bg-black/[0.04] dark:hover:bg-zinc-700 border border-black/[0.08] dark:border-white/[0.08] text-zinc-800 dark:text-white text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
          >
            <HelpCircle className="w-3.5 h-3.5 text-purple-500" />
            <span>Interview Prep</span>
          </button>

          {/* Download PDF */}
          <button
            disabled={downloading !== null}
            onClick={() => handleDownload(ResumeFormat.Pdf)}
            className="px-4 py-2 rounded-xl bg-[#D9704F] hover:bg-[#C85F3E] text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloading === ResumeFormat.Pdf ? 'Rendering PDF...' : 'Download PDF'}</span>
          </button>

          {/* Download DOCX */}
          <button
            disabled={downloading !== null}
            onClick={() => handleDownload(ResumeFormat.Docx)}
            className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-800/80 hover:bg-black/[0.04] dark:hover:bg-zinc-700 border border-black/[0.08] dark:border-white/[0.08] text-zinc-800 dark:text-white text-xs font-medium transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Word</span>
          </button>
        </div>
      </div>

      {/* 3-Column Inspection Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (3 cols): Master Reference */}
        <div className="lg:col-span-3 space-y-3">
          <div className="p-5 rounded-2xl bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] shadow-sm space-y-4 sticky top-20 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.05] dark:border-white/[0.06]">
              <span className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#D9704F] dark:text-[#F39A7E]" /> Master Profile
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-black/[0.05] dark:border-white/[0.06]">
                Reference
              </span>
            </div>

            <div className="space-y-3 text-xs text-zinc-700 dark:text-zinc-300">
              <div>
                <div className="font-bold text-zinc-900 dark:text-white text-sm">
                  {masterSchema?.personalInfo?.fullName || tailoredSchema?.personalInfo?.fullName || 'Master Profile'}
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {masterSchema?.personalInfo?.email || tailoredSchema?.personalInfo?.email || ''}
                </div>
                {(masterSchema?.personalInfo?.phone || tailoredSchema?.personalInfo?.phone) && (
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {masterSchema?.personalInfo?.phone || tailoredSchema?.personalInfo?.phone}
                  </div>
                )}
              </div>

              {masterSchema.summary && (
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">Summary</span>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-4">{masterSchema.summary}</p>
                </div>
              )}

              {masterExperiences.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">Experience</span>
                  <div className="space-y-2">
                    {masterExperiences.map((exp, i) => (
                      <div key={i} className="p-2.5 rounded-xl bg-[#FAF7F2] dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.06]">
                        <div className="font-semibold text-zinc-900 dark:text-white text-xs">{exp.role}</div>
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">{exp.company} ({exp.startDate} - {exp.isCurrent ? 'Present' : exp.endDate})</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {masterSchema.skills && masterSchema.skills.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">Key Skills</span>
                  <div className="flex flex-wrap gap-1">
                    {masterSchema.skills.flatMap((s: any) => s.skills || []).map((skill: string, i: number) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-[#FAF7F2] dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border border-black/[0.05] dark:border-white/[0.06]">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center Column (5 cols): Resume Document Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-8 bg-white text-neutral-900 rounded-2xl shadow-xl min-h-[780px] space-y-5 font-sans border border-neutral-200">
            {/* Header */}
            <div className="text-center space-y-1 pb-4 border-b border-neutral-300">
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900 uppercase">
                {tailoredSchema?.personalInfo?.fullName || masterSchema?.personalInfo?.fullName || 'Candidate Profile'}
              </h1>
              {(tailoredSchema?.personalInfo?.title || tailoredResult.targetRole) && (
                <div className="text-xs font-semibold text-neutral-600 tracking-wider uppercase">
                  {tailoredSchema?.personalInfo?.title || tailoredResult.targetRole}
                </div>
              )}
              <div className="text-[11px] text-neutral-500">
                {[
                  tailoredSchema?.personalInfo?.email || masterSchema?.personalInfo?.email,
                  tailoredSchema?.personalInfo?.phone || masterSchema?.personalInfo?.phone,
                  tailoredSchema?.personalInfo?.location || masterSchema?.personalInfo?.location,
                  tailoredSchema?.personalInfo?.linkedInUrl || masterSchema?.personalInfo?.linkedInUrl,
                  tailoredSchema?.personalInfo?.gitHubUrl || masterSchema?.personalInfo?.gitHubUrl,
                ].filter(Boolean).join(' • ')}
              </div>
            </div>

            {/* Summary */}
            {tailoredSchema.summary && (
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider border-b border-neutral-200 pb-0.5">
                  Professional Summary
                </h3>
                <p className="text-[11px] text-neutral-800 leading-relaxed">
                  {tailoredSchema.summary}
                </p>
              </div>
            )}

            {/* Technical Skills */}
            {tailoredSchema.skills && tailoredSchema.skills.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider border-b border-neutral-200 pb-0.5">
                  Core Competencies &amp; Skills
                </h3>
                <div className="space-y-0.5 text-[11px]">
                  {tailoredSchema.skills.map((cat, i) => (
                    <div key={i} className="text-neutral-800">
                      <strong className="text-neutral-900">{cat.categoryName}: </strong>
                      {cat.skills.join(', ')}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Experience */}
            {tailoredExperiences.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider border-b border-neutral-200 pb-0.5">
                  Work Experience
                </h3>
                <div className="space-y-3">
                  {tailoredExperiences.map((exp, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between items-baseline text-[11px]">
                        <div>
                          <strong className="text-neutral-900 font-bold">{exp.role}</strong> — <span className="text-neutral-700">{exp.company}</span>
                        </div>
                        <span className="text-neutral-500 text-[10px]">{exp.startDate} – {exp.isCurrent ? 'Present' : exp.endDate}</span>
                      </div>
                      {exp.location && <div className="text-[10px] italic text-neutral-500">{exp.location}</div>}
                      <ul className="list-disc pl-4 space-y-0.5 text-[10.5px] text-neutral-800 leading-normal">
                        {exp.highlights.map((bullet, bIdx) => (
                          <li key={bIdx}>{bullet}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Key Projects */}
            {tailoredSchema.projects && tailoredSchema.projects.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider border-b border-neutral-200 pb-0.5">
                  Key Projects
                </h3>
                <div className="space-y-2.5">
                  {tailoredSchema.projects.map((proj, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between items-baseline text-[11px]">
                        <div>
                          <strong className="text-neutral-900 font-bold">{proj.title}</strong>
                          {proj.technologies && (
                            <span className="text-neutral-600 text-[10px] ml-2">[{proj.technologies}]</span>
                          )}
                        </div>
                        {proj.url && (
                          <a href={proj.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 text-[10px] hover:underline flex items-center gap-0.5">
                            <span>Link</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                      {proj.description && (
                        <p className="text-[10.5px] text-neutral-700 leading-snug">{proj.description}</p>
                      )}
                      {proj.highlights && proj.highlights.length > 0 && (
                        <ul className="list-disc pl-4 space-y-0.5 text-[10.5px] text-neutral-800 leading-normal">
                          {proj.highlights.map((bullet, bIdx) => (
                            <li key={bIdx}>{bullet}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Education */}
            {tailoredSchema.education && tailoredSchema.education.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider border-b border-neutral-200 pb-0.5">
                  Education
                </h3>
                {tailoredSchema.education.map((edu, i) => (
                  <div key={i} className="flex justify-between text-[11px] text-neutral-800">
                    <div>
                      <strong>{edu.degree} in {edu.fieldOfStudy}</strong>, {edu.institution}
                    </div>
                    <span className="text-neutral-500 text-[10px]">{edu.graduationYear}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (4 cols): ATS Scorecard */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.05] dark:border-white/[0.06]">
              <span className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span>ATS Scorecard</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold font-mono">
                High Alignment
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
                    strokeDasharray="96, 100"
                    strokeLinecap="round"
                    strokeWidth="3.5"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-base font-bold text-zinc-900 dark:text-white block font-mono">
                    {atsAnalysis.overallScore}%
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <div className="text-zinc-900 dark:text-white font-semibold">Semantic Match Score</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  <strong className="text-emerald-600 dark:text-emerald-400">{(atsAnalysis?.matchingKeywords || []).length}</strong> matching • <strong className="text-amber-600 dark:text-amber-400">{(atsAnalysis?.missingKeywords || []).length}</strong> missing
                </div>
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                  100% Parsed &amp; Readable
                </div>
              </div>
            </div>

            {/* Score Breakdown Bars */}
            <div className="space-y-3 pt-3 border-t border-black/[0.05] dark:border-white/[0.06] text-xs">
              <div>
                <div className="flex justify-between text-zinc-500 dark:text-zinc-400 mb-1 text-[11px]">
                  <span>Keyword Match</span>
                  <span className="font-semibold text-zinc-900 dark:text-white font-mono">{atsAnalysis?.keywordMatchScore ?? 0}%</span>
                </div>
                <div className="w-full bg-black/[0.05] dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-[#D9704F] h-full rounded-full" style={{ width: `${atsAnalysis?.keywordMatchScore ?? 0}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-zinc-500 dark:text-zinc-400 mb-1 text-[11px]">
                  <span>Skills Coverage</span>
                  <span className="font-semibold text-zinc-900 dark:text-white font-mono">{atsAnalysis?.skillsMatchScore ?? 0}%</span>
                </div>
                <div className="w-full bg-black/[0.05] dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${atsAnalysis?.skillsMatchScore ?? 0}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-zinc-500 dark:text-zinc-400 mb-1 text-[11px]">
                  <span>Experience Relevance</span>
                  <span className="font-semibold text-zinc-900 dark:text-white font-mono">{atsAnalysis?.experienceRelevanceScore ?? 0}%</span>
                </div>
                <div className="w-full bg-black/[0.05] dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-sky-500 h-full rounded-full" style={{ width: `${atsAnalysis?.experienceRelevanceScore ?? 0}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Keywords Match Cloud */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.05] dark:border-white/[0.06] text-xs">
              <span className="text-zinc-900 dark:text-white font-bold">Matched Keywords</span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                {(atsAnalysis?.matchingKeywords || []).length} Matched
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
              {(atsAnalysis?.matchingKeywords || []).map((kw: string, i: number) => (
                <span 
                  key={i} 
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                >
                  <Check className="w-3 h-3 text-emerald-500" />
                  {kw}
                </span>
              ))}
            </div>

            {(atsAnalysis?.missingKeywords || []).length > 0 && (
              <div className="space-y-2 pt-3 border-t border-black/[0.05] dark:border-white/[0.06]">
                <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  Missing Keywords ({(atsAnalysis?.missingKeywords || []).length})
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {(atsAnalysis?.missingKeywords || []).map((kw: string, i: number) => (
                    <span 
                      key={i} 
                      className="px-2.5 py-1 rounded-lg text-xs bg-[#FAF7F2] dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 border border-black/[0.05] dark:border-white/[0.06]"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Recruiter Feedback */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Recruiter AI Feedback</h4>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {atsAnalysis?.recruiterFeedback || 'Recruiter feedback analysis is being prepared.'}
            </p>

            <button
              onClick={() => setIsRoadmapModalOpen(true)}
              className="w-full mt-2 py-2 px-3 rounded-xl bg-black/[0.04] dark:bg-zinc-800/80 hover:bg-black/[0.08] dark:hover:bg-zinc-700 border border-black/[0.06] dark:border-white/[0.08] text-zinc-800 dark:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <Compass className="w-3.5 h-3.5 text-[#D9704F] dark:text-[#F39A7E]" />
              <span>View Skills Roadmap ({(atsAnalysis?.skillRoadmap || []).length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cover Letter Modal */}
      <Modal
        isOpen={isCoverLetterModalOpen}
        onClose={() => setIsCoverLetterModalOpen(false)}
        title={`Cover Letter — ${tailoredResult.targetRole}`}
        description={`Customized for ${tailoredResult.targetCompany}`}
      >
        {isCoverLetterLoading ? (
          <div className="py-12 text-center text-xs text-[#8e929b] space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-400" />
            <div>Generating compelling cover letter...</div>
          </div>
        ) : coverLetterError ? (
          <div className="py-12 text-center text-xs text-rose-500 dark:text-rose-400">{coverLetterError}</div>
        ) : coverLetter ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#FAF7F2] dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.06] text-xs text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">
              {coverLetter.content}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(coverLetter.content);
                setCopiedCoverLetter(true);
                setTimeout(() => setCopiedCoverLetter(false), 2000);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-[#D9704F] hover:bg-[#C85F3E] text-white font-semibold text-xs shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {copiedCoverLetter ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCoverLetter ? 'Copied to Clipboard!' : 'Copy Cover Letter'}</span>
            </button>
          </div>
        ) : null}
      </Modal>

      {/* Interview Prep Modal */}
      <Modal
        isOpen={isInterviewPrepModalOpen}
        onClose={() => setIsInterviewPrepModalOpen(false)}
        title={`Interview Coach — ${tailoredResult.targetRole}`}
        description="STAR Method & Technical Coaching tailored to this job"
        maxWidth="max-w-3xl"
      >
        {isInterviewPrepLoading ? (
          <div className="py-12 text-center text-xs text-zinc-500 dark:text-zinc-400 space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#D9704F]" />
            <div>Generating interview coaching questions...</div>
          </div>
        ) : interviewPrepError ? (
          <div className="py-12 text-center text-xs text-rose-500 dark:text-rose-400">{interviewPrepError}</div>
        ) : interviewPrep ? (
          <div className="space-y-5">
            {/* Behavioral */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-[#D9704F] uppercase tracking-wider">Behavioral Questions (STAR)</h4>
              {interviewPrep.behavioralQuestions.map((q, i) => (
                <div key={i} className="p-3.5 rounded-xl bg-[#FAF7F2] dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.06] space-y-1.5 text-xs">
                  <div className="font-semibold text-zinc-900 dark:text-white">Q: {q.question}</div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400"><strong className="text-zinc-800 dark:text-zinc-200">Suggested Approach:</strong> {q.suggestedStarApproach}</div>
                </div>
              ))}
            </div>

            {/* Technical */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Technical Deep-Dive</h4>
              {interviewPrep.technicalQuestions.map((q, i) => (
                <div key={i} className="p-3.5 rounded-xl bg-[#FAF7F2] dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.06] space-y-1.5 text-xs">
                  <div className="font-semibold text-zinc-900 dark:text-white">Q: {q.question}</div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400"><strong className="text-zinc-800 dark:text-zinc-200">Talking Point:</strong> {q.exampleTalkingPoint}</div>
                </div>
              ))}
            </div>

            {/* Gap Probe */}
            {interviewPrep.gapProbeQuestions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Skill Gap Questions</h4>
                {interviewPrep.gapProbeQuestions.map((q, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-[#FAF7F2] dark:bg-zinc-800/40 border border-amber-500/30 space-y-1.5 text-xs">
                    <div className="font-semibold text-zinc-900 dark:text-white">Q: {q.question}</div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400"><strong className="text-zinc-800 dark:text-zinc-200">Strategy:</strong> {q.suggestedStarApproach}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* Skill Roadmap Modal */}
      <Modal
        isOpen={isRoadmapModalOpen}
        onClose={() => setIsRoadmapModalOpen(false)}
        title="Missing Skills Learning Roadmap"
        description="Actionable steps to learn missing job requirements"
      >
        <div className="space-y-3">
          {atsAnalysis.skillRoadmap.map((item, i) => (
            <div key={i} className="p-3.5 rounded-xl bg-[#FAF7F2] dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.06] flex items-start justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>{item.skillName}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D9704F]/10 text-[#D9704F] font-semibold border border-[#D9704F]/20">
                    {item.priority} Priority
                  </span>
                </div>
                <div className="text-zinc-500 dark:text-zinc-400 text-[11px]">{item.recommendedAction}</div>
              </div>
              <div className="text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0 font-medium">
                {item.estimatedLearningTime || '1-2 weeks'}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};
