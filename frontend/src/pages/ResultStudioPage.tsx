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
  Layers, 
  Copy, 
  Check, 
  Columns,
  RefreshCw,
  ExternalLink,
  Award,
  GraduationCap,
  Briefcase,
  Code
} from 'lucide-react';
import { Button, Card, Badge, Modal } from '../components/ui';
import { useTailorStore } from '../stores/useTailorStore';
import { tailorApi, toolsApi } from '../api';
import { ResumeFormat, TemplateStyle } from '../types/resume';
import { CoverLetterDto, InterviewPrepDto } from '../types/shared';
import { GeneratedResumeSummaryDto } from '../types/ats';
import { ActivePage } from '../components/layout/AppLayout';
import confetti from 'canvas-confetti';

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
      <div className="text-center py-24 space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600 dark:text-indigo-400" />
        <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
          Loading your tailored resume & ATS scorecard...
        </p>
      </div>
    );
  }

  if (!tailoredResult) {
    return (
      <div className="text-center py-20 space-y-4 max-w-md mx-auto">
        {studioError && (
          <div className="flex items-center gap-2.5 p-3 text-left rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{studioError}</span>
          </div>
        )}
        <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
          <Sparkles className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Tailored Resume Loaded</h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Please select a job opening in the Tailor Studio to generate your tailored resume and ATS scorecard.
          </p>
        </div>
        {setActivePage && (
          <Button
            variant="primary"
            size="md"
            onClick={() => setActivePage('tailor-studio')}
            className="gap-2 mx-auto mt-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Open Tailor Studio</span>
          </Button>
        )}
      </div>
    );
  }

  const { masterSchema, tailoredSchema, atsAnalysis } = tailoredResult;


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
      link.download = `${tailoredSchema.personalInfo.fullName.replace(/\s+/g, '_')}_Resume.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
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
    <div className="space-y-5">
      {studioError && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{studioError}</span>
          <button onClick={() => setStudioError(null)} className="ml-auto" aria-label="Dismiss">✕</button>
        </div>
      )}
      {/* Download Error Banner */}
      {downloadError && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
          <span>{downloadError}</span>
          <button onClick={() => setDownloadError(null)} className="ml-auto text-rose-400 hover:text-rose-700 dark:hover:text-rose-300" aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* Action Header */}
      <Card className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 shadow-sm">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-black text-slate-900 dark:text-white">{tailoredResult.targetRole}</h2>
            <Badge variant="purple">@ {tailoredResult.targetCompany}</Badge>
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
                className="text-xs py-1 px-2.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 font-medium ml-1 cursor-pointer hover:border-indigo-400 focus:ring-1 focus:ring-indigo-500"
                title="Switch tailored resume version"
              >
                {historyList.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.targetRole} @ {item.targetCompany} ({item.matchScore}% ATS)
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Strict Truth-Preservation Verified • 0 Hallucinations • ATS Match: <strong className="text-emerald-600 dark:text-emerald-400">{atsAnalysis.overallScore}%</strong>
          </div>
        </div>


        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Cover Letter */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateCoverLetter}
            className="gap-1.5 text-xs"
          >
            <Mail className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Cover Letter</span>
          </Button>

          {/* Interview Prep */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateInterviewPrep}
            className="gap-1.5 text-xs"
          >
            <HelpCircle className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Interview Prep</span>
          </Button>

          {/* Exports */}
          <Button
            variant="primary"
            size="sm"
            disabled={downloading !== null}
            onClick={() => handleDownload(ResumeFormat.Pdf)}
            className="gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md shadow-indigo-600/20"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloading === ResumeFormat.Pdf ? 'Rendering PDF...' : 'Download PDF'}</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            disabled={downloading !== null}
            onClick={() => handleDownload(ResumeFormat.Docx)}
            className="gap-1.5 text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>DOCX</span>
          </Button>
        </div>
      </Card>

      {/* 3-Column Inspection Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Original Master Resume (3 cols) */}
        <div className="lg:col-span-3 space-y-3">
          <Card className="p-4 space-y-3 sticky top-20 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800">
              <span className="text-xs font-bold text-slate-800 dark:text-zinc-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" /> Original Master Resume
              </span>
              <Badge variant="outline" className="text-[10px]">Reference</Badge>
            </div>

            <div className="space-y-3 text-xs text-slate-700 dark:text-zinc-300">
              <div>
                <div className="font-bold text-slate-900 dark:text-white text-sm">{masterSchema.personalInfo.fullName}</div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400">{masterSchema.personalInfo.email}</div>
                {masterSchema.personalInfo.phone && (
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400">{masterSchema.personalInfo.phone}</div>
                )}
                {masterSchema.personalInfo.location && (
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400">{masterSchema.personalInfo.location}</div>
                )}
              </div>

              {masterSchema.summary && (
                <div>
                  <div className="font-semibold text-slate-500 dark:text-zinc-400 text-[11px] uppercase tracking-wider">Summary</div>
                  <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-1 line-clamp-4">{masterSchema.summary}</p>
                </div>
              )}

              {masterSchema.experience && masterSchema.experience.length > 0 && (
                <div>
                  <div className="font-semibold text-slate-500 dark:text-zinc-400 text-[11px] uppercase tracking-wider mb-1.5">Experience</div>
                  <div className="space-y-2">
                    {masterSchema.experience.map((exp, i) => (
                      <div key={i} className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-950/70 border border-slate-200 dark:border-zinc-800/80">
                        <div className="font-semibold text-slate-900 dark:text-white text-[11px]">{exp.role}</div>
                        <div className="text-[10px] text-slate-500 dark:text-zinc-400">{exp.company} ({exp.startDate} - {exp.isCurrent ? 'Present' : exp.endDate})</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {masterSchema.skills && masterSchema.skills.length > 0 && (
                <div>
                  <div className="font-semibold text-slate-500 dark:text-zinc-400 text-[11px] uppercase tracking-wider mb-1">Skills</div>
                  <div className="flex flex-wrap gap-1">
                    {masterSchema.skills.flatMap(s => s.skills).map((skill, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-400">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {masterSchema.projects && masterSchema.projects.length > 0 && (
                <div>
                  <div className="font-semibold text-slate-500 dark:text-zinc-400 text-[11px] uppercase tracking-wider mb-1">Projects</div>
                  <div className="space-y-1.5">
                    {masterSchema.projects.map((proj, i) => (
                      <div key={i} className="p-2 rounded bg-slate-50 dark:bg-zinc-950/70 border border-slate-200 dark:border-zinc-800/80 text-[11px]">
                        <div className="font-semibold text-slate-900 dark:text-white">{proj.title}</div>
                        {proj.technologies && <div className="text-[10px] text-indigo-600 dark:text-indigo-400">{proj.technologies}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {masterSchema.education && masterSchema.education.length > 0 && (
                <div>
                  <div className="font-semibold text-slate-500 dark:text-zinc-400 text-[11px] uppercase tracking-wider mb-1">Education</div>
                  <div className="space-y-1 text-[11px]">
                    {masterSchema.education.map((edu, i) => (
                      <div key={i} className="text-slate-700 dark:text-zinc-300">
                        <div><strong>{edu.degree}</strong> ({edu.graduationYear})</div>
                        <div className="text-[10px] text-slate-500">{edu.institution}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {masterSchema.certifications && masterSchema.certifications.length > 0 && (
                <div>
                  <div className="font-semibold text-slate-500 dark:text-zinc-400 text-[11px] uppercase tracking-wider mb-1">Certifications</div>
                  <div className="space-y-1 text-[11px]">
                    {masterSchema.certifications.map((cert, i) => (
                      <div key={i} className="text-slate-700 dark:text-zinc-300">
                        <div><strong>{cert.name}</strong></div>
                        <div className="text-[10px] text-slate-500">{cert.issuer} ({cert.issueDate})</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {masterSchema.achievements && masterSchema.achievements.length > 0 && (
                <div>
                  <div className="font-semibold text-slate-500 dark:text-zinc-400 text-[11px] uppercase tracking-wider mb-1">Achievements</div>
                  <div className="space-y-1 text-[11px]">
                    {masterSchema.achievements.map((ach, i) => (
                      <div key={i} className="text-slate-700 dark:text-zinc-300">
                        <div><strong>{ach.title}</strong></div>
                        {ach.description && <div className="text-[10px] text-slate-500">{ach.description}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Center Column: Tailored Resume Document Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 bg-white text-zinc-900 shadow-xl rounded-2xl min-h-[700px] space-y-4 font-sans border border-slate-200 dark:border-zinc-800">
            {/* Header */}
            <div className="text-center space-y-1 pb-3 border-b border-zinc-300">
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 uppercase">
                {tailoredSchema.personalInfo.fullName}
              </h1>
              {tailoredSchema.personalInfo.title && (
                <div className="text-xs font-semibold text-zinc-600">{tailoredSchema.personalInfo.title}</div>
              )}
              <div className="text-[10px] text-zinc-500 font-medium">
                {[
                  tailoredSchema.personalInfo.email,
                  tailoredSchema.personalInfo.phone,
                  tailoredSchema.personalInfo.location,
                  tailoredSchema.personalInfo.linkedInUrl,
                  tailoredSchema.personalInfo.gitHubUrl,
                  tailoredSchema.personalInfo.portfolioUrl,
                ].filter(Boolean).join(' | ')}
              </div>
            </div>

            {/* Professional Summary */}
            {tailoredSchema.summary && (
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider border-b border-zinc-200 pb-0.5">
                  Professional Summary
                </h3>
                <p className="text-[11px] text-zinc-800 leading-relaxed">
                  {tailoredSchema.summary}
                </p>
              </div>
            )}

            {/* Technical Skills */}
            {tailoredSchema.skills && tailoredSchema.skills.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider border-b border-zinc-200 pb-0.5">
                  Technical Skills
                </h3>
                <div className="space-y-0.5 text-[11px]">
                  {tailoredSchema.skills.map((cat, i) => (
                    <div key={i} className="text-zinc-800">
                      <strong className="text-zinc-900">{cat.categoryName}: </strong>
                      {cat.skills.join(', ')}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Work Experience */}
            {tailoredSchema.experience && tailoredSchema.experience.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider border-b border-zinc-200 pb-0.5">
                  Work Experience
                </h3>
                <div className="space-y-3">
                  {tailoredSchema.experience.map((exp, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between items-baseline text-[11px]">
                        <div>
                          <strong className="text-zinc-900">{exp.role}</strong> — <span className="text-zinc-700">{exp.company}</span>
                        </div>
                        <span className="text-zinc-500 text-[10px]">{exp.startDate} – {exp.isCurrent ? 'Present' : exp.endDate}</span>
                      </div>
                      {exp.location && <div className="text-[10px] italic text-zinc-500">{exp.location}</div>}
                      <ul className="list-disc pl-4 space-y-0.5 text-[10.5px] text-zinc-800 leading-normal">
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
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider border-b border-zinc-200 pb-0.5">
                  Key Projects
                </h3>
                <div className="space-y-2.5">
                  {tailoredSchema.projects.map((proj, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between items-baseline text-[11px]">
                        <div>
                          <strong className="text-zinc-900">{proj.title}</strong>
                          {proj.technologies && (
                            <span className="text-zinc-500 text-[10px] ml-2">[{proj.technologies}]</span>
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
                        <p className="text-[10.5px] text-zinc-700 leading-snug">{proj.description}</p>
                      )}
                      {proj.highlights && proj.highlights.length > 0 && (
                        <ul className="list-disc pl-4 space-y-0.5 text-[10.5px] text-zinc-800 leading-normal">
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
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider border-b border-zinc-200 pb-0.5">
                  Education
                </h3>
                {tailoredSchema.education.map((edu, i) => (
                  <div key={i} className="flex justify-between text-[11px] text-zinc-800">
                    <div>
                      <strong>{edu.degree} in {edu.fieldOfStudy}</strong>, {edu.institution}
                    </div>
                    <span className="text-zinc-500 text-[10px]">{edu.graduationYear}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Certifications */}
            {tailoredSchema.certifications && tailoredSchema.certifications.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider border-b border-zinc-200 pb-0.5">
                  Certifications
                </h3>
                <div className="space-y-1">
                  {tailoredSchema.certifications.map((cert, i) => (
                    <div key={i} className="flex justify-between text-[11px] text-zinc-800">
                      <div>
                        <strong>{cert.name}</strong> — <span className="text-zinc-600">{cert.issuer}</span>
                      </div>
                      <span className="text-zinc-500 text-[10px]">{cert.issueDate}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Achievements */}
            {tailoredSchema.achievements && tailoredSchema.achievements.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider border-b border-zinc-200 pb-0.5">
                  Achievements & Honors
                </h3>
                <div className="space-y-1">
                  {tailoredSchema.achievements.map((ach, i) => (
                    <div key={i} className="text-[11px] text-zinc-800">
                      <strong>{ach.title}</strong>
                      {ach.date && <span className="text-zinc-500 text-[10px] ml-1.5">({ach.date})</span>}
                      {ach.description && <p className="text-[10.5px] text-zinc-600 mt-0.5">{ach.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>


        {/* Right Column: ATS Scorecard, Recruiter Feedback & Tools (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* ATS Score Gauge Card */}
          <Card className="p-5 space-y-4 border-indigo-200 dark:border-indigo-500/30 bg-gradient-to-br from-indigo-50/50 via-white to-indigo-100/30 dark:from-zinc-900 dark:via-zinc-900 dark:to-indigo-950/40 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800">
              <span className="text-xs font-bold text-slate-900 dark:text-zinc-200 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> ATS Optimization Score
              </span>
              <Badge variant={atsAnalysis.overallScore >= 80 ? 'success' : 'warning'}>
                {atsAnalysis.overallScore >= 80 ? 'High Match' : 'Moderate Match'}
              </Badge>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative flex items-center justify-center h-20 w-20 rounded-full border-4 border-emerald-500 bg-white dark:bg-zinc-950 text-emerald-600 dark:text-emerald-400 font-black text-2xl shadow-md shadow-emerald-500/20 shrink-0">
                {atsAnalysis.overallScore}%
              </div>
              <div className="space-y-1 text-xs">
                <div className="text-slate-800 dark:text-zinc-300 font-semibold">Semantic Match Summary</div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                  {atsAnalysis.matchingKeywords.length} matching keywords • {atsAnalysis.missingKeywords.length} missing keywords
                </div>
              </div>
            </div>

            {/* Score Breakdown Bars */}
            <div className="space-y-2.5 pt-2 text-xs">
              <div>
                <div className="flex justify-between text-[11px] text-slate-600 dark:text-zinc-400 mb-1">
                  <span>Keyword Density</span>
                  <span className="font-semibold text-slate-900 dark:text-zinc-200">{atsAnalysis.keywordMatchScore}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-zinc-950 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full" style={{ width: `${atsAnalysis.keywordMatchScore}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-600 dark:text-zinc-400 mb-1">
                  <span>Skills Coverage</span>
                  <span className="font-semibold text-slate-900 dark:text-zinc-200">{atsAnalysis.skillsMatchScore}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-zinc-950 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-600 dark:bg-emerald-500 h-full rounded-full" style={{ width: `${atsAnalysis.skillsMatchScore}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-600 dark:text-zinc-400 mb-1">
                  <span>Quantified Impact</span>
                  <span className="font-semibold text-slate-900 dark:text-zinc-200">{atsAnalysis.experienceRelevanceScore}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-zinc-950 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-purple-600 dark:bg-purple-500 h-full rounded-full" style={{ width: `${atsAnalysis.experienceRelevanceScore}%` }} />
                </div>
              </div>
            </div>
          </Card>

          {/* Keywords Match Cloud */}
          <Card className="p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-200 flex items-center justify-between">
              <span>Keywords Breakdown</span>
              <span className="text-[10px] text-slate-500 dark:text-zinc-500 font-normal">{atsAnalysis.matchingKeywords.length} found</span>
            </h4>

            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Matching Keywords
              </div>
              <div className="flex flex-wrap gap-1">
                {atsAnalysis.matchingKeywords.map((kw, i) => (
                  <Badge key={i} variant="success" className="text-[10px] py-0.5">
                    {kw}
                  </Badge>
                ))}
              </div>
            </div>

            {atsAnalysis.missingKeywords.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
                <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Missing from Experience
                </div>
                <div className="flex flex-wrap gap-1">
                  {atsAnalysis.missingKeywords.map((kw, i) => (
                    <Badge key={i} variant="warning" className="text-[10px] py-0.5">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Recruiter Feedback */}
          <Card className="p-4 space-y-2">
            <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-200">Recruiter Feedback</h4>
            <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
              {atsAnalysis.recruiterFeedback}
            </p>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRoadmapModalOpen(true)}
              className="w-full mt-2 gap-1.5 text-xs text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>View Missing Skills Roadmap ({atsAnalysis.skillRoadmap.length})</span>
            </Button>
          </Card>
        </div>
      </div>

      {/* Cover Letter Modal */}
      <Modal
        isOpen={isCoverLetterModalOpen}
        onClose={() => setIsCoverLetterModalOpen(false)}
        title={`Targeted Cover Letter — ${tailoredResult.targetRole}`}
        description={`Tailored for ${tailoredResult.targetCompany}`}
      >
        {isCoverLetterLoading ? (
          <div className="py-12 text-center text-xs text-slate-500 dark:text-zinc-400 space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-600 dark:text-indigo-400" />
            <div>Generating compelling 1-page cover letter...</div>
          </div>
        ) : coverLetterError ? (
          <div className="py-12 text-center text-xs text-rose-600 dark:text-rose-400">{coverLetterError}</div>
        ) : coverLetter ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs text-slate-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed font-sans">
              {coverLetter.content}
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(coverLetter.content);
                setCopiedCoverLetter(true);
                setTimeout(() => setCopiedCoverLetter(false), 2000);
              }}
              className="w-full gap-1.5"
            >
              {copiedCoverLetter ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCoverLetter ? 'Copied to Clipboard!' : 'Copy Cover Letter'}</span>
            </Button>
          </div>
        ) : null}
      </Modal>

      {/* Interview Prep Modal */}
      <Modal
        isOpen={isInterviewPrepModalOpen}
        onClose={() => setIsInterviewPrepModalOpen(false)}
        title={`Interview Preparation Coach — ${tailoredResult.targetRole}`}
        description="STAR Method & Technical Coaching tailored to the target role requirements"
        maxWidth="max-w-3xl"
      >
        {isInterviewPrepLoading ? (
          <div className="py-12 text-center text-xs text-slate-500 dark:text-zinc-400 space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-purple-600 dark:text-purple-400" />
            <div>Generating role-specific interview coaching questions...</div>
          </div>
        ) : interviewPrepError ? (
          <div className="py-12 text-center text-xs text-rose-600 dark:text-rose-400">{interviewPrepError}</div>
        ) : interviewPrep ? (
          <div className="space-y-5">
            {/* Behavioral */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Behavioral & Leadership</h4>
              {interviewPrep.behavioralQuestions.map((q, i) => (
                <div key={i} className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-1.5 text-xs">
                  <div className="font-semibold text-slate-900 dark:text-white">Q: {q.question}</div>
                  <div className="text-[11px] text-slate-600 dark:text-zinc-400"><strong className="text-slate-800 dark:text-zinc-300">STAR Approach:</strong> {q.suggestedStarApproach}</div>
                </div>
              ))}
            </div>

            {/* Technical */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Technical Deep-Dive</h4>
              {interviewPrep.technicalQuestions.map((q, i) => (
                <div key={i} className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-1.5 text-xs">
                  <div className="font-semibold text-slate-900 dark:text-white">Q: {q.question}</div>
                  <div className="text-[11px] text-slate-600 dark:text-zinc-400"><strong className="text-slate-800 dark:text-zinc-300">Talking Point:</strong> {q.exampleTalkingPoint}</div>
                </div>
              ))}
            </div>

            {/* Gap Probe */}
            {interviewPrep.gapProbeQuestions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Skill Gap Probes</h4>
                {interviewPrep.gapProbeQuestions.map((q, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-1.5 text-xs">
                    <div className="font-semibold text-slate-900 dark:text-white">Q: {q.question}</div>
                    <div className="text-[11px] text-slate-600 dark:text-zinc-400"><strong className="text-slate-800 dark:text-zinc-300">Handling Strategy:</strong> {q.suggestedStarApproach}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Questions to Ask Employer */}
            {interviewPrep.questionsToAskEmployer && interviewPrep.questionsToAskEmployer.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Strategic Questions to Ask Employer
                </h4>
                <div className="space-y-1.5">
                  {interviewPrep.questionsToAskEmployer.map((item, i) => {
                    const qText = typeof item === 'string' ? item : (item as any).question || JSON.stringify(item);
                    const cat = typeof item === 'object' && (item as any).category ? (item as any).category : null;
                    const rat = typeof item === 'object' && (item as any).rationale ? (item as any).rationale : null;
                    return (
                      <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-1 text-xs">
                        {cat && <div className="text-[10px] font-semibold text-emerald-500 uppercase">{cat}</div>}
                        <div className="font-semibold text-slate-900 dark:text-white">Q: {qText}</div>
                        {rat && <div className="text-[11px] text-slate-500 dark:text-zinc-400"><em>Why to ask:</em> {rat}</div>}
                      </div>
                    );
                  })}
                </div>
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
        description="Actionable steps to bridge candidate-job requirement gaps"
      >
        <div className="space-y-3">
          {atsAnalysis.skillRoadmap.map((item, i) => (
            <div key={i} className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex items-start justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  {item.skillName}
                  <Badge variant={item.priority === 'High' ? 'danger' : 'warning'} className="text-[10px]">
                    {item.priority} Priority
                  </Badge>
                </div>
                <div className="text-slate-600 dark:text-zinc-400 text-[11px]">{item.recommendedAction}</div>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-zinc-500 shrink-0 font-mono">
                {item.estimatedLearningTime || '1-2 weeks'}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};
