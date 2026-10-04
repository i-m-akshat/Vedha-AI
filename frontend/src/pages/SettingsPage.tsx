import React, { useState } from 'react';
import { Settings, Key, Cpu, ShieldCheck, Check, Save, AlertCircle } from 'lucide-react';
import { Card, Button, Input, Badge } from '../components/ui';
import { useAuthStore } from '../stores/useAuthStore';
import { AiProviderType } from '../types/shared';

export const SettingsPage: React.FC = () => {
  const { user, updateKeys } = useAuthStore();
  const [provider, setProvider] = useState<AiProviderType>(user?.preferredAiProvider || AiProviderType.Gemini);
  const [model, setModel] = useState<string>(user?.preferredModel || 'gemini-flash-lite-latest');
  const [openAiKey, setOpenAiKey] = useState('');
  const [claudeKey, setClaudeKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setError(null);
      await updateKeys({
        preferredProvider: provider,
        preferredModel: model,
        openAiKey: openAiKey.trim() || undefined,
        claudeKey: claudeKey.trim() || undefined,
        geminiKey: geminiKey.trim() || undefined,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch {
      setError('Settings could not be saved. Please check the API connection and try again.');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="pb-4 border-b border-slate-200 dark:border-zinc-800">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Settings & AI Configuration
        </h2>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
          Manage your AI provider keys, fallback models, and user profile preferences.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* AI Provider Config */}
      <Card className="p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-600 dark:text-purple-400" /> Default AI Provider
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">Choose your primary LLM engine for tailoring and ATS analysis.</p>
          </div>
          <Badge variant="purple">Multi-Provider</Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: AiProviderType.Gemini, label: 'Google Gemini', defaultModel: 'gemini-flash-lite-latest' },
            { id: AiProviderType.OpenAi, label: 'OpenAI GPT-4o', defaultModel: 'gpt-4o-mini' },
            { id: AiProviderType.Claude, label: 'Anthropic Claude', defaultModel: 'claude-3-5-sonnet-20241022' },
          ].map((prov) => (
            <button
              key={prov.id}
              type="button"
              onClick={() => {
                setProvider(prov.id);
                setModel(prov.defaultModel);
              }}
              className={`p-4 rounded-xl border text-left transition ${
                provider === prov.id
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-900 dark:bg-indigo-500/10 dark:text-white font-semibold shadow-sm'
                  : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-700'
              }`}
            >
              <div className="font-bold text-xs text-slate-900 dark:text-zinc-200">{prov.label}</div>
              <div className="text-[10px] text-slate-500 dark:text-zinc-500 mt-1">Default: {prov.defaultModel}</div>
            </button>
          ))}
        </div>

        {/* API Keys Configuration */}
        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-zinc-200">
            <Key className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Custom API Keys (Encrypted at Rest)
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-slate-700 dark:text-zinc-400 font-medium">Google Gemini API Key</label>
                {user?.hasCustomGeminiKey && <Badge variant="success" className="text-[10px]">Saved</Badge>}
              </div>
              <Input
                type="password"
                placeholder={user?.hasCustomGeminiKey ? '••••••••••••••••••••••••' : 'AIzaSy...'}
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-slate-700 dark:text-zinc-400 font-medium">OpenAI API Key</label>
                {user?.hasCustomOpenAiKey && <Badge variant="success" className="text-[10px]">Saved</Badge>}
              </div>
              <Input
                type="password"
                placeholder={user?.hasCustomOpenAiKey ? '••••••••••••••••••••••••' : 'sk-...'}
                value={openAiKey}
                onChange={(e) => setOpenAiKey(e.target.value)}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-slate-700 dark:text-zinc-400 font-medium">Anthropic Claude API Key</label>
                {user?.hasCustomClaudeKey && <Badge variant="success" className="text-[10px]">Saved</Badge>}
              </div>
              <Input
                type="password"
                placeholder={user?.hasCustomClaudeKey ? '••••••••••••••••••••••••' : 'sk-ant-...'}
                value={claudeKey}
                onChange={(e) => setClaudeKey(e.target.value)}
              />
            </div>
          </div>
        </div>

        <Button variant="primary" size="md" onClick={handleSave} className="gap-2">
          {savedSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          <span>{savedSuccess ? 'Settings Saved!' : 'Save AI Configuration'}</span>
        </Button>
      </Card>
    </div>
  );
};
