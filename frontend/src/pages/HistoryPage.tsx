import React, { useEffect, useState } from 'react';
import { History, FileText, ArrowRight, Download, Award, Calendar, RefreshCw, AlertCircle } from 'lucide-react';
import { Card, Button, Badge } from '../components/ui';
import { tailorApi } from '../api';
import { GeneratedResumeSummaryDto } from '../types/ats';
import { useTailorStore } from '../stores/useTailorStore';
import { ActivePage } from '../components/layout/AppLayout';
import { ResumeFormat } from '../types/resume';

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
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Generated Resumes History
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Access past tailored versions, ATS score reports, and exports.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchHistory} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {history.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {history.map((item) => (
            <Card key={item.id} className="p-5 space-y-4 hover:border-indigo-300 dark:hover:border-zinc-700 transition flex flex-col justify-between shadow-sm">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant={item.matchScore >= 80 ? 'success' : 'warning'}>
                    ATS Score: {item.matchScore}%
                  </Badge>
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                    {new Date(item.createdAtUtc).toLocaleDateString()}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">{item.targetRole}</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">@ {item.targetCompany}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 dark:text-zinc-500 font-medium">{item.selectedTemplate}</span>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleOpenResume(item.id)}
                  className="gap-1 text-xs"
                >
                  <span>Open Studio</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-xs text-slate-400 dark:text-zinc-500">
          No generated resumes yet. Go to Generate Resume to tailor your first opening.
        </div>
      )}
    </div>
  );
};
