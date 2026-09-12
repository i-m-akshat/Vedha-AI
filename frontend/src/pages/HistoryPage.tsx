import React, { useEffect, useState } from 'react';
import { History, FileText, ArrowRight, Download, Award, Calendar, RefreshCw } from 'lucide-react';
import { Card, Button, Badge } from '../components/ui';
import { tailorApi } from '../api';
import { GeneratedResumeSummaryDto } from '../types/ats';
import { useTailorStore } from '../stores/useTailorStore';
import { ActivePage } from '../components/layout/AppLayout';
import { ResumeFormat } from '../types/resume';

export const HistoryPage: React.FC<{ setActivePage: (p: ActivePage) => void }> = ({ setActivePage }) => {
  const [history, setHistory] = useState<GeneratedResumeSummaryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { setTailoredResult } = useTailorStore();

  const fetchHistory = async () => {
    try {
      const data = await tailorApi.getHistory();
      setHistory(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleOpenResume = async (id: string) => {
    const fullResume = await tailorApi.getById(id);
    setTailoredResult(fullResume);
    setActivePage('result-studio');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" />
            Generated Resumes History
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Access past tailored versions, ATS score reports, and exports.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchHistory} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {history.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {history.map((item) => (
            <Card key={item.id} className="p-5 space-y-4 hover:border-zinc-700 transition flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant={item.matchScore >= 80 ? 'success' : 'warning'}>
                    ATS Score: {item.matchScore}%
                  </Badge>
                  <span className="text-[10px] text-zinc-500">
                    {new Date(item.createdAtUtc).toLocaleDateString()}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-sm text-white">{item.targetRole}</h3>
                  <p className="text-xs text-zinc-400">@ {item.targetCompany}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                <span className="text-[11px] text-zinc-500">{item.selectedTemplate}</span>
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
        <div className="text-center py-16 text-xs text-zinc-500">
          No generated resumes yet. Go to Generate Resume to tailor your first opening.
        </div>
      )}
    </div>
  );
};
