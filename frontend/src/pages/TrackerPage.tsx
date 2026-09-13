import React, { useState, useEffect } from 'react';
import { 
  Kanban, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Calendar, 
  DollarSign, 
  MapPin, 
  FileText,
  ChevronRight,
  MoreVertical,
  AlertCircle
} from 'lucide-react';
import { Button, Card, Badge, Input, Modal } from '../components/ui';
import { applicationsApi } from '../api';
import { ApplicationRecordDto, ApplicationStatus } from '../types/application';

export const TrackerPage: React.FC = () => {
  const [applications, setApplications] = useState<ApplicationRecordDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCompany, setNewCompany] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newSalary, setNewSalary] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchApps = async () => {
    try {
      const list = await applicationsApi.list();
      setApplications(list);
    } catch {
      setError('Applications could not be loaded. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const handleStatusChange = async (id: string, newStatus: ApplicationStatus) => {
    try {
      setError(null);
      await applicationsApi.updateStatus(id, newStatus);
      fetchApps();
    } catch {
      setError('Application status could not be updated. Please try again.');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this application record?')) {
      try {
        setError(null);
        await applicationsApi.delete(id);
        fetchApps();
      } catch {
        setError('Application could not be deleted. Please try again.');
      }
    }
  };

  const handleAdd = async () => {
    if (!newCompany.trim() || !newTitle.trim()) return;
    try {
      setError(null);
      await applicationsApi.create({
        companyName: newCompany.trim(),
        jobTitle: newTitle.trim(),
        jobUrl: newUrl.trim() || undefined,
        location: newLocation.trim() || undefined,
        salaryRange: newSalary.trim() || undefined,
        status: ApplicationStatus.Saved,
      });
    } catch {
      setError('Application could not be added. Please try again.');
      return;
    }
    setNewCompany('');
    setNewTitle('');
    setNewUrl('');
    setNewLocation('');
    setNewSalary('');
    setIsAddModalOpen(false);
    fetchApps();
  };

  const columns: { status: ApplicationStatus; label: string; color: string }[] = [
    { status: ApplicationStatus.Saved, label: 'Saved', color: 'border-slate-200 dark:border-zinc-800 bg-slate-100/60 dark:bg-zinc-900/40' },
    { status: ApplicationStatus.Applied, label: 'Applied', color: 'border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/20' },
    { status: ApplicationStatus.Interviewing, label: 'Interviewing', color: 'border-purple-200 dark:border-purple-500/30 bg-purple-50/50 dark:bg-purple-950/20' },
    { status: ApplicationStatus.Offered, label: 'Offered', color: 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20' },
    { status: ApplicationStatus.Rejected, label: 'Rejected', color: 'border-rose-200 dark:border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20' },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Kanban className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Job Application Tracker
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Manage your interview pipeline, track applied tailored resumes, and record recruitment progress.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsAddModalOpen(true)}
          className="gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Application</span>
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
        {columns.map((col) => {
          const items = applications.filter((a) => a.status === col.status);
          return (
            <div key={col.status} className={`rounded-2xl border ${col.color} p-3.5 space-y-3 min-h-[500px] flex flex-col`}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800">
                <span className="text-xs font-bold text-slate-900 dark:text-zinc-200">{col.label}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-400 font-semibold font-mono border border-slate-200 dark:border-zinc-700">
                  {items.length}
                </span>
              </div>

              <div className="space-y-3 flex-1">
                {items.map((app) => (
                  <Card key={app.id} className="p-3.5 space-y-2.5 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-zinc-700 transition shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-xs text-slate-900 dark:text-white">{app.jobTitle}</div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400">{app.companyName}</div>
                      </div>
                      <button
                        onClick={() => handleDelete(app.id)}
                        className="text-slate-400 hover:text-rose-500 dark:text-zinc-600 dark:hover:text-rose-400 p-0.5 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {(app.location || app.salaryRange) && (
                      <div className="text-[10px] text-slate-500 dark:text-zinc-400 space-y-0.5">
                        {app.location && <div className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400" /> {app.location}</div>}
                        {app.salaryRange && <div className="flex items-center gap-1"><DollarSign className="w-3 h-3 text-emerald-500" /> {app.salaryRange}</div>}
                      </div>
                    )}

                    {/* Status Move Dropdown */}
                    <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-[10px]">
                      <span className="text-slate-500 dark:text-zinc-500">Move to:</span>
                      <select
                        value={app.status}
                        onChange={(e) => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                        className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded px-1.5 py-0.5 text-slate-800 dark:text-zinc-300 text-[10px] focus:outline-none"
                      >
                        {columns.map((c) => (
                          <option key={c.status} value={c.status}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Track New Job Application"
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-700 dark:text-zinc-400">Company Name *</label>
            <Input value={newCompany} onChange={(e) => setNewCompany(e.target.value)} placeholder="e.g. Stripe" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 dark:text-zinc-400">Job Title *</label>
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Senior Backend Engineer" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 dark:text-zinc-400">Job Posting URL</label>
            <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-zinc-400">Location</label>
              <Input value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="San Francisco / Remote" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-zinc-400">Salary Range</label>
              <Input value={newSalary} onChange={(e) => setNewSalary(e.target.value)} placeholder="$180k - $220k" />
            </div>
          </div>
          <Button variant="primary" size="md" onClick={handleAdd} className="w-full mt-2">
            Save Application
          </Button>
        </div>
      </Modal>
    </div>
  );
};
