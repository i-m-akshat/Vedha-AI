import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Link2, 
  FileText, 
  Terminal, 
  Loader2, 
  ArrowRight, 
  Cpu, 
  LayoutTemplate,
  AlertTriangle
} from 'lucide-react';
import { Button, Card, Input, Textarea, Badge, CornerBrackets, LiquidProgress } from '../components/ui';
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
    { 
      id: TemplateStyle.ClassicAts, 
      index: '01',
      name: 'Classic ATS', 
      desc: 'Single-column structure, 100% parser indexability' 
    },
    { 
      id: TemplateStyle.ModernMinimalist, 
      index: '02',
      name: 'Modern Minimalist', 
      desc: 'Obsidian hairline dividers with generous whitespace' 
    },
    { 
      id: TemplateStyle.ExecutiveClean, 
      index: '03',
      name: 'Executive Clean', 
      desc: 'Editorial hierarchy for principal & leadership roles' 
    },
    { 
      id: TemplateStyle.TechnicalPro, 
      index: '04',
      name: 'Technical Pro', 
      desc: 'Stack-prioritized telemetry for engineering candidates' 
    },
  ];

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Editorial Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            WORKBENCH // 04
          </span>
          <span className="font-mono text-[10px] text-slate-400 dark:text-zinc-600 tracking-wider">
            [ × ZERO-LIE ENFORCED ]
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Resume Tailor Studio
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 max-w-2xl leading-relaxed">
          Ingest target job specifications, compute semantic skill coverage, and re-engineer role highlights to maximize recruiter keyword match without fabricating credentials.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2.5 font-mono">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Studio Workbench */}
      <Card bracketed={true} className="space-y-6 p-6 sm:p-8">
        {/* Source Mode Switcher - Segmented Pill */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200/80 dark:border-white/[0.08]">
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-zinc-900/90 border border-slate-200 dark:border-white/[0.08]">
            <button
              onClick={() => setInputMode('url')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-all duration-200 ${
                inputMode === 'url' 
                  ? 'bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-950 font-bold' 
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" /> Job URL
            </button>
            <button
              onClick={() => setInputMode('text')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-all duration-200 ${
                inputMode === 'text' 
                  ? 'bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-950 font-bold' 
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Paste Raw JD
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              AUDIT STATUS:
            </span>
            <Badge variant="tech" className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10">
              [ × TRUTH-PRESERVED ]
            </Badge>
          </div>
        </div>

        {/* Inputs */}
        {inputMode === 'url' ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                Target Job Posting URL
              </label>
              <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">HTTP / HTTPS</span>
            </div>
            <Input
              placeholder="e.g. https://jobs.lever.co/company/role or LinkedIn, Greenhouse, Ashby, Workday..."
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              disabled={isGenerating}
              className="h-11 font-mono text-xs"
            />
            <p className="text-[11px] font-mono text-slate-500 dark:text-zinc-500">
              The scraper extracts company, role, requirements, and keywords while discarding tracker pixels and scripts.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                Job Description Document
              </label>
              <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">RAW TEXT</span>
            </div>
            <Textarea
              placeholder="Paste the full job posting text including responsibilities, required qualifications, and tech stack..."
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              disabled={isGenerating}
              rows={8}
              className="text-xs font-mono leading-relaxed"
            />
          </div>
        )}

        {/* Studio Selectors: Template & AI Engine */}
        <div className="space-y-6 pt-2">
          {/* Template Style Selector - Depth Form Study Edition Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                <LayoutTemplate className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                <span>Resume Layout Edition</span>
              </label>
              <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">4 EDITIONS</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {templates.map((tpl) => {
                const isSelected = selectedTemplate === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setSelectedTemplate(tpl.id)}
                    className={`relative p-3.5 text-left rounded-xl border transition-all duration-200 group ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/80 text-indigo-900 dark:border-indigo-500/80 dark:bg-zinc-900/90 dark:text-white shadow-sm'
                        : 'border-slate-200 bg-white/50 text-slate-700 hover:border-slate-300 dark:border-white/[0.08] dark:bg-zinc-950/60 dark:text-zinc-400 dark:hover:border-white/[0.18]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-mono tracking-wider ${isSelected ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400 dark:text-zinc-600'}`}>
                        {tpl.index} // STYLE
                      </span>
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-pulse" />
                      )}
                    </div>
                    <div className="font-bold text-xs text-slate-900 dark:text-zinc-200 tracking-tight">
                      {tpl.name}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                      {tpl.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI Engine Selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                <span>Intelligence Provider</span>
              </label>
              <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">LLM CORE</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: AiProviderType.Gemini, label: 'Gemini Flash Lite', code: 'FLASH-LITE', sub: 'Fast & High-Accuracy' },
                { id: AiProviderType.OpenAi, label: 'OpenAI GPT-4o', code: 'GPT-4O', sub: 'Complex Multi-Reasoning' },
                { id: AiProviderType.Claude, label: 'Claude 3.5 Sonnet', code: 'CLAUDE-3.5', sub: 'Executive Articulation' },
              ].map((prov) => {
                const isSelected = provider === prov.id;
                return (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => setProvider(prov.id)}
                    className={`relative p-3.5 text-left rounded-xl border transition-all duration-200 ${
                      isSelected
                        ? 'border-purple-500 bg-purple-50/80 text-purple-900 dark:border-purple-500/80 dark:bg-zinc-900/90 dark:text-white shadow-sm'
                        : 'border-slate-200 bg-white/50 text-slate-700 hover:border-slate-300 dark:border-white/[0.08] dark:bg-zinc-950/60 dark:text-zinc-400 dark:hover:border-white/[0.18]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-mono tracking-wider ${isSelected ? 'text-purple-600 dark:text-purple-400 font-bold' : 'text-slate-400 dark:text-zinc-600'}`}>
                        {prov.code}
                      </span>
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 dark:bg-purple-400" />
                      )}
                    </div>
                    <div className="font-bold text-xs text-slate-900 dark:text-zinc-200">
                      {prov.label}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-500 mt-0.5">
                      {prov.sub}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Generate Button - High Contrast Tactile Studio Button */}
        <Button
          variant="primary"
          size="lg"
          onClick={handleStartGeneration}
          disabled={isGenerating}
          className="w-full h-12 text-xs sm:text-sm font-mono uppercase tracking-wider gap-2.5 shadow-lg shadow-indigo-600/20"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>SYNTHESIZING TAILORED RESUME & ATS METRICS...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>GENERATE TAILORED RESUME & AUDIT REPORT</span>
              <ArrowRight className="w-4 h-4 ml-1 opacity-70" />
            </>
          )}
        </Button>
      </Card>

      {/* Real-time Streaming Studio Feed with Liquid Progress */}
      {isGenerating && (
        <Card bracketed={true} className="p-6 bg-[#050508] border-white/[0.1] text-zinc-100 space-y-5 font-mono">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
            <div className="flex items-center gap-2.5 text-xs font-semibold text-zinc-200">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>LIVE TELEMETRY STREAM</span>
            </div>
            <div className="text-[11px] text-indigo-400 font-semibold tracking-wider">
              {currentProgressPercent}% // EXECUTING
            </div>
          </div>

          {/* Liquid Glowing Progress Bar */}
          <LiquidProgress 
            progress={currentProgressPercent} 
            label={`PHASE // ${currentStage}`} 
            showPercent={false} 
          />

          {/* Terminal log window with obsidian backdrop */}
          <div className="h-44 overflow-y-auto space-y-1.5 text-[11px] pr-2 pt-2 border-t border-white/[0.04]">
            {progressLogs.map((log, i) => (
              <div key={i} className="flex items-start gap-2 text-zinc-300">
                <span className="text-zinc-600 select-none">[{log.timestamp}]</span>
                <span className="text-indigo-400 font-semibold">[{log.stage}]</span>
                <span className="text-zinc-300">{log.message}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-emerald-400 animate-pulse pt-1">
              <span>❯</span>
              <span>Running: {currentStage}...</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
