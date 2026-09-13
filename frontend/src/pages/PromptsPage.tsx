import React, { useEffect, useState } from 'react';
import { Sliders, Save, RotateCcw, Check, Sparkles, AlertCircle } from 'lucide-react';
import { Card, Button, Input, Textarea, Badge } from '../components/ui';
import { promptsApi } from '../api';
import { PromptTemplateDto } from '../types/shared';

export const PromptsPage: React.FC = () => {
  const [prompts, setPrompts] = useState<PromptTemplateDto[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('ResumeTailor');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrompts = async () => {
    try {
      const data = await promptsApi.list();
      setPrompts(data);
      const active = data.find((p) => p.templateKey === selectedKey) || data[0];
      if (active) {
        setSelectedKey(active.templateKey);
        setName(active.name);
        setDesc(active.description);
        setSystemPrompt(active.systemPrompt);
        setUserPrompt(active.userPromptTemplate);
      }
    } catch {
      setError('Prompt templates could not be loaded. Please try again.');
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  const handleSelectPrompt = (tpl: PromptTemplateDto) => {
    setSelectedKey(tpl.templateKey);
    setName(tpl.name);
    setDesc(tpl.description);
    setSystemPrompt(tpl.systemPrompt);
    setUserPrompt(tpl.userPromptTemplate);
  };

  const handleSave = async () => {
    try {
      setError(null);
      await promptsApi.save({
        templateKey: selectedKey,
        name,
        description: desc,
        systemPrompt,
        userPromptTemplate: userPrompt,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
      fetchPrompts();
    } catch {
      setError('Prompt could not be saved. Please try again.');
    }
  };

  const handleReset = async () => {
    if (confirm('Reset prompt to system default?')) {
      try {
        setError(null);
        await promptsApi.reset(selectedKey);
        fetchPrompts();
      } catch {
        setError('Prompt could not be reset. Please try again.');
      }
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="pb-4 border-b border-slate-200 dark:border-zinc-800">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Sliders className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          AI Prompt Template Studio
        </h2>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
          Customize system prompts, role guidelines, and variable tokens used across LLM execution stages.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Template List */}
        <div className="space-y-2">
          {prompts.map((p) => (
            <button
              key={p.templateKey}
              onClick={() => handleSelectPrompt(p)}
              className={`w-full text-left p-3.5 rounded-xl border text-xs transition ${
                selectedKey === p.templateKey
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-900 dark:bg-indigo-500/10 dark:text-white font-semibold shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400 dark:hover:border-zinc-700'
              }`}
            >
              <div className="font-bold text-xs text-slate-900 dark:text-zinc-200">{p.name}</div>
              <div className="text-[10px] text-slate-500 dark:text-zinc-500 mt-0.5">{p.templateKey}</div>
            </button>
          ))}
        </div>

        {/* Prompt Editor */}
        <Card className="md:col-span-3 p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{name}</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">{desc}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleReset} className="text-xs gap-1">
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </Button>
              <Button variant="primary" size="sm" onClick={handleSave} className="text-xs gap-1">
                {savedSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span>{savedSuccess ? 'Saved' : 'Save'}</span>
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">System Prompt</label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={6}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">User Prompt Template</label>
            <Textarea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              rows={6}
              className="font-mono text-xs"
            />
          </div>
        </Card>
      </div>
    </div>
  );
};
