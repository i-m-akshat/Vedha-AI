import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Link2, 
  FileText, 
  Terminal, 
  CheckCircle2, 
  Loader2, 
  ArrowRight, 
  Cpu, 
  LayoutTemplate,
  AlertTriangle
} from 'lucide-react';
import { Button, Card, Input, Textarea, Badge } from '../components/ui';
import { useTailorStore, useResumeStore } from '../stores/useTailorStore';
import { useAuthStore } from '../stores/useAuthStore';
import { TemplateStyle } from '../types/resume';
import { AiProviderType } from '../types/shared';
import { ActivePage } from '../components/layout/AppLayout';

export const TailorStudioPage: React.FC<{ setActivePage: (p: ActivePage) => void }> = ({ setActivePage }) => {
  const { user } = useAuthStore();
  const { masterResume, fetchMasterResume } = useResumeStore();
  const { 
    isGenerating, 
    progressLogs, 
    currentProgressPercent, 
    currentStage, 
    generateTailoring, 
    selectedTemplate, 
    setSelectedTemplate 
  } = useTailorStore();

  const [inputMode, setInputMode] = useState<'url' | 'text'>('url');
  const [jobUrl, setJobUrl] = useState('');
  const [jobText, setJobText] = useState('');
  const [provider, setProvider] = useState<AiProviderType>(user?.preferredAiProvider || AiProviderType.Gemini);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMasterResume();
  }, []);

  const handleStartGeneration = async () => {
    if (!user) return;
    setError(null);

    if (!masterResume) {
      setError('Please upload a Master Resume first before tailoring.');
      return;
    }

    if (inputMode === 'url' && !jobUrl.trim()) {
      setError('Please enter a valid Job Posting URL.');
      return;
    }

    if (inputMode === 'text' && !jobText.trim()) {
      setError('Please paste the Job Description text.');
      return;
    }

    try {
      await generateTailoring({
        masterResumeId: masterResume.id,
        directJobUrl: inputMode === 'url' ? jobUrl.trim() : undefined,
        directJobText: inputMode === 'text' ? jobText.trim() : undefined,
        selectedTemplate: selectedTemplate,
        providerOverride: provider,
      }, user.id);

      setActivePage('result-studio');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Generation failed.');
    }
  };

  const templates = [
    { id: TemplateStyle.ClassicAts, name: 'Classic ATS', desc: 'Standard single-column, maximum parser readability' },
    { id: TemplateStyle.ModernMinimalist, name: 'Modern Minimalist', desc: 'Sleek spacing, crisp typography' },
    { id: TemplateStyle.ExecutiveClean, name: 'Executive Clean', desc: 'Polished layout for senior & leadership roles' },
    { id: TemplateStyle.TechnicalPro, name: 'Technical Pro', desc: 'Optimized for engineering stacks & projects' },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Resume Tailor Studio
        </h2>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
          Generate an ATS-optimized, truth-preserving tailored resume against any target opening.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Input Configuration */}
      <Card className="space-y-5 p-6">
        {/* Source Switcher */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-zinc-800">
          <div className="flex bg-slate-100 dark:bg-zinc-950 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">
            <button
              onClick={() => setInputMode('url')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                inputMode === 'url' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" /> Job Posting URL
            </button>
            <button
              onClick={() => setInputMode('text')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                inputMode === 'text' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Paste Raw Job Description
            </button>
          </div>

          <Badge variant="purple" className="hidden sm:inline-flex">
            Truth-Preserved AI Engine
          </Badge>
        </div>

        {/* Inputs */}
        {inputMode === 'url' ? (
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">Target Job URL</label>
            <Input
              placeholder="https://jobs.lever.co/company/job-id or LinkedIn, Greenhouse, Ashby, Workday, Indeed..."
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              disabled={isGenerating}
              className="h-11 text-sm"
            />
            <p className="text-[11px] text-slate-500 dark:text-zinc-500">
              The scraper will automatically extract title, company, requirements, and keywords while stripping ads and scripts.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">Paste Full Job Description</label>
            <Textarea
              placeholder="Paste the full job posting description including responsibilities, requirements, and skills..."
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              disabled={isGenerating}
              rows={7}
              className="text-xs"
            />
          </div>
        )}

        {/* Settings: Template & AI Engine */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Template Style */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
              <LayoutTemplate className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Resume Template
            </label>
            <div className="grid grid-cols-2 gap-2">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setSelectedTemplate(tpl.id)}
                  className={`p-2.5 text-left rounded-xl border text-xs transition ${
                    selectedTemplate === tpl.id
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-900 dark:bg-indigo-500/10 dark:text-white font-semibold'
                      : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="font-semibold text-xs text-slate-900 dark:text-zinc-200">{tpl.name}</div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-500 mt-0.5 line-clamp-1">{tpl.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* AI Provider */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> AI Engine
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: AiProviderType.Gemini, label: 'Flash Lite', sub: 'Fast & Efficient' },
                { id: AiProviderType.OpenAi, label: 'OpenAI GPT-4o', sub: 'High Reasoning' },
                { id: AiProviderType.Claude, label: 'Claude 3.5', sub: 'Best Writing' },
              ].map((prov) => (
                <button
                  key={prov.id}
                  type="button"
                  onClick={() => setProvider(prov.id)}
                  className={`p-2.5 text-left rounded-xl border text-xs transition ${
                    provider === prov.id
                      ? 'border-purple-500 bg-purple-50 text-purple-900 dark:bg-purple-500/10 dark:text-white font-semibold'
                      : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="font-semibold text-xs text-slate-900 dark:text-zinc-200">{prov.label}</div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-500 mt-0.5">{prov.sub}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <Button
          variant="primary"
          size="lg"
          onClick={handleStartGeneration}
          disabled={isGenerating}
          className="w-full h-12 text-sm font-bold gap-2 shadow-lg shadow-indigo-600/30"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Tailoring Resume & Running ATS Analysis...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Generate Tailored Resume & ATS Report</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </>
          )}
        </Button>
      </Card>

      {/* Real-time Streaming Terminal */}
      {isGenerating && (
        <Card className="p-4 bg-slate-950 border-slate-800 dark:bg-zinc-950 dark:border-zinc-800 space-y-3 font-mono">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 dark:border-zinc-900">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Live Generation Feed</span>
            </div>
            <div className="text-[11px] text-indigo-400 font-semibold">{currentProgressPercent}% Complete</div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-500 h-full transition-all duration-300 rounded-full"
              style={{ width: `${currentProgressPercent}%` }}
            />
          </div>

          {/* Terminal log window */}
          <div className="h-40 overflow-y-auto space-y-1 text-[11px] pr-2">
            {progressLogs.map((log, i) => (
              <div key={i} className="flex items-start gap-2 text-zinc-300">
                <span className="text-zinc-600 select-none">[{log.timestamp}]</span>
                <span className="text-indigo-400 font-semibold">[{log.stage}]</span>
                <span className="text-zinc-300">{log.message}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-emerald-400 animate-pulse">
              <span>❯</span>
              <span>Processing stage: {currentStage}...</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
