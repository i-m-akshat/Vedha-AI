import React, { useEffect, useState } from 'react';
import { History, ArrowRight, RefreshCw, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { Card, Button, Badge } from '../components/ui';
import { tailorApi } from '../api';
import { GeneratedResumeSummaryDto } from '../types/ats';
import { useTailorStore } from '../stores/useTailorStore';
import { ActivePage } from '../components/layout/AppLayout';

export const HistoryPage: React.FC<{ setActivePage: (p: ActivePage) => void }> = ({ setActivePage }) => {
  const [history, setHistory] = useState<GeneratedResumeSummaryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setTailoredResult } = useTailorStore();

  const fetchHistory = async () => {
    try {
      setError(null);
      const data = await tailorApi.getHistory();
      setHistory(data);
    } catch {
      setError('Resume history could not be loaded. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleOpenResume = async (id: string) => {
    try {
      const fullResume = await tailorApi.getById(id);
      setTailoredResult(fullResume);
      setActivePage('result-studio');
    } catch {
      setError('That tailored resume could not be opened. Please try again.');
    }
  };

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-[#e2e4e9]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[#111216] border border-[#23252b]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              {history.length} {history.length === 1 ? 'Version' : 'Versions'} Saved
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2 mt-1">
            <History className="w-5 h-5 text-indigo-400" />
            Resume History &amp; Versions
          </h1>
          <p className="text-xs sm:text-sm text-[#8e929b]">
            Access past tailored resumes, review ATS match scores, and re-export documents.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchHistory}
          className="gap-2 text-xs self-start sm:self-auto border-[#2a2d36] text-white hover:bg-[#1a1c24] rounded-xl"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {history.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {history.map((item, idx) => (
            <Card key={item.id} bracketed={false} className="p-6 space-y-5 bg-[#111216] border-[#23252b] hover:border-[#323640] transition-all duration-200 flex flex-col justify-between rounded-2xl group shadow-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#8e929b] font-medium">
                    {new Date(item.createdAtUtc).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                    item.matchScore >= 85 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {item.matchScore}% Match
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-base text-white tracking-tight line-clamp-1">
                    {item.targetRole}
                  </h3>
                  <p className="text-xs text-[#8e929b]">
                    {item.targetCompany ? `@ ${item.targetCompany}` : 'General Target'}
                  </p>
                </div>

                <div className="text-xs text-[#6c707d]">
                  Template: <span className="text-[#a0a4b0]">{item.selectedTemplate || 'Classic ATS'}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-[#23252b] flex items-center justify-between">
                <span className="text-xs text-[#8e929b]">
                  Ready to view
                </span>
                <button
                  onClick={() => handleOpenResume(item.id)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <span>Open Resume</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      ) : !isLoading ? (
        <div className="p-12 text-center rounded-2xl bg-[#111216] border border-[#23252b] space-y-3">
          <FileText className="w-8 h-8 text-[#555866] mx-auto" />
          <h3 className="text-sm font-semibold text-white">No Tailored Resumes Yet</h3>
          <p className="text-xs text-[#8e929b] max-w-sm mx-auto">
            Once you tailor your resume for a job posting, all generated versions and match reports will be archived here.
          </p>
          <button
            onClick={() => setActivePage('tailor-studio')}
            className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
          >
            <span>Create Your First Tailored Resume</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="p-12 text-center text-[#8e929b] text-xs">
          Loading resume history...
        </div>
      )}
    </div>
  );
};
