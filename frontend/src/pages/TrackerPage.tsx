import React, { useState, useEffect } from 'react';
import { 
  Kanban, 
  Plus, 
  Trash2, 
  DollarSign, 
  MapPin, 
  AlertCircle
} from 'lucide-react';
import { Button, Card, Badge, Input, Modal, CornerBrackets } from '../components/ui';
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

  const columns: { status: ApplicationStatus; index: string; label: string; color: string }[] = [
    { status: ApplicationStatus.Saved, index: '01', label: 'SAVED', color: 'border-slate-200 dark:border-white/[0.08] bg-slate-100/50 dark:bg-zinc-950/40' },
    { status: ApplicationStatus.Applied, index: '02', label: 'APPLIED', color: 'border-indigo-200/80 dark:border-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-950/10' },
    { status: ApplicationStatus.Interviewing, index: '03', label: 'INTERVIEWING', color: 'border-purple-200/80 dark:border-purple-500/20 bg-purple-50/40 dark:bg-purple-950/10' },
    { status: ApplicationStatus.Offered, index: '04', label: 'OFFERED', color: 'border-emerald-200/80 dark:border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/10' },
    { status: ApplicationStatus.Rejected, index: '05', label: 'ARCHIVED', color: 'border-rose-200/80 dark:border-rose-500/20 bg-rose-50/40 dark:bg-rose-950/10' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {error && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300 font-mono">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-white/[0.08]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              PIPELINE // 07
            </span>
            <span className="font-mono text-[10px] text-slate-400 dark:text-zinc-600 tracking-wider">
              [ {applications.length} POSITIONS ACTIVE ]
            </span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Kanban className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            Job Application Tracker
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Control recruitment pipeline stages, monitor application conversion, and organize interview stages.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsAddModalOpen(true)}
          className="gap-2 font-mono text-xs self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>ADD APPLICATION</span>
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
        {columns.map((col) => {
          const items = applications.filter((a) => a.status === col.status);
          return (
            <div key={col.status} className={`rounded-2xl border ${col.color} p-4 space-y-3 min-h-[520px] flex flex-col backdrop-blur-xl`}>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">{col.index}</span>
                  <span className="text-xs font-mono font-bold tracking-wider text-slate-900 dark:text-zinc-200">{col.label}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/80 dark:bg-zinc-900 text-slate-700 dark:text-zinc-400 font-bold font-mono border border-slate-200 dark:border-white/[0.08]">
                  {items.length}
                </span>
              </div>

              <div className="space-y-3 flex-1">
                {items.map((app) => (
                  <Card key={app.id} bracketed={true} className="p-4 space-y-3 bg-white/90 dark:bg-zinc-950/70 border-slate-200/90 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.18] transition-all duration-200 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="font-bold text-xs text-slate-900 dark:text-white tracking-tight">{app.jobTitle}</div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">{app.companyName}</div>
                      </div>
                      <button
                        onClick={() => handleDelete(app.id)}
                        className="text-slate-400 hover:text-rose-500 dark:text-zinc-600 dark:hover:text-rose-400 p-0.5 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {(app.location || app.salaryRange) && (
                      <div className="text-[10px] font-mono text-slate-500 dark:text-zinc-400 space-y-0.5 pt-1">
                        {app.location && <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-slate-400" /> {app.location}</div>}
                        {app.salaryRange && <div className="flex items-center gap-1.5"><DollarSign className="w-3 h-3 text-emerald-500" /> {app.salaryRange}</div>}
                      </div>
                    )}

                    {/* Status Move Dropdown */}
                    <div className="pt-2.5 border-t border-slate-100 dark:border-white/[0.04] flex items-center justify-between text-[10px] font-mono">
                      <span className="text-slate-400 dark:text-zinc-500">STAGE:</span>
                      <select
                        value={app.status}
                        onChange={(e) => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                        className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/[0.08] rounded-lg px-2 py-0.5 text-slate-800 dark:text-zinc-200 text-[10px] font-mono focus:outline-none"
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
        description="Add a target company and role to your recruitment pipeline."
      >
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-zinc-300">Company Name *</label>
            <Input value={newCompany} onChange={(e) => setNewCompany(e.target.value)} placeholder="e.g. Stripe, OpenAI, Taazaa" className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-zinc-300">Job Title *</label>
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Senior Dot Net Developer" className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-zinc-300">Job Posting URL</label>
            <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://..." className="mt-1 font-mono text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-zinc-300">Location</label>
              <Input value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="Remote / New York" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-zinc-300">Salary Range</label>
              <Input value={newSalary} onChange={(e) => setNewSalary(e.target.value)} placeholder="$140k - $170k" className="mt-1 font-mono" />
            </div>
          </div>
          <Button variant="primary" size="md" onClick={handleAdd} className="w-full mt-3 font-mono text-xs uppercase tracking-wider">
            SAVE APPLICATION TO PIPELINE
          </Button>
        </div>
      </Modal>
    </div>
  );
};
