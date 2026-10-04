import React, { useEffect, useState } from 'react';
import { History, ArrowRight, RefreshCw, AlertCircle, FileText } from 'lucide-react';
import { Card, Button, Badge, CornerBrackets } from '../components/ui';
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
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-white/[0.08]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              LEDGER // 08
            </span>
            <span className="font-mono text-[10px] text-slate-400 dark:text-zinc-600 tracking-wider">
              [ {history.length} EDITIONS ARCHIVED ]
            </span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            Resume History & Archives
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Audit past tailored generations, ATS evaluation reports, and template exports.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchHistory} className="gap-2 font-mono text-xs self-start sm:self-auto">
          <RefreshCw className="w-3.5 h-3.5" /> REFRESH
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300 font-mono">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {history.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {history.map((item, idx) => (
            <Card key={item.id} bracketed={true} className="p-6 space-y-5 hover:border-slate-300 dark:hover:border-white/[0.18] transition-all duration-200 flex flex-col justify-between group">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] tracking-wider text-slate-400 dark:text-zinc-500">
                    {String(idx + 1).padStart(2, '0')} // ARCHIVE
                  </span>
                  <Badge variant="tech" className={item.matchScore >= 80 ? 'text-emerald-500 border-emerald-500/30' : 'text-amber-500 border-amber-500/30'}>
                    [ × ATS {item.matchScore}% ]
                  </Badge>
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white tracking-tight line-clamp-1">
                    {item.targetRole}
                  </h3>
                  <p className="text-xs font-mono text-slate-500 dark:text-zinc-400">
                    @ {item.targetCompany}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-white/[0.04] flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  {new Date(item.createdAtUtc).toLocaleDateString()}
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleOpenResume(item.id)}
                  className="gap-1.5 text-xs font-mono"
                >
                  <span>INSPECT</span>
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-xs font-mono text-slate-400 dark:text-zinc-500 border border-dashed border-slate-200 dark:border-white/[0.08] rounded-2xl">
          NO ARCHIVED RESUMES FOUND // TAILOR A NEW RESUME TO GENERATE YOUR FIRST RECORD
        </div>
      )}
    </div>
  );
};
