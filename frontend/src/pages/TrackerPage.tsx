import React, { useState, useEffect } from 'react';
import { 
  Kanban, 
  Plus, 
  Trash2, 
  DollarSign, 
  MapPin, 
  AlertCircle,
  ExternalLink,
  Briefcase
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

  const columns: { status: ApplicationStatus; label: string; color: string; badgeColor: string }[] = [
    { status: ApplicationStatus.Saved, label: 'Saved', color: 'border-slate-200 dark:border-[#23252b] bg-slate-100/50 dark:bg-[#111216]', badgeColor: 'bg-slate-200 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300' },
    { status: ApplicationStatus.Applied, label: 'Applied', color: 'border-indigo-200/80 dark:border-indigo-500/20 bg-indigo-50/40 dark:bg-[#12131a]', badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20' },
    { status: ApplicationStatus.Interviewing, label: 'Interviewing', color: 'border-purple-200/80 dark:border-purple-500/20 bg-purple-50/40 dark:bg-[#14121a]', badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20' },
    { status: ApplicationStatus.Offered, label: 'Offered', color: 'border-emerald-200/80 dark:border-emerald-500/20 bg-emerald-50/40 dark:bg-[#101714]', badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' },
    { status: ApplicationStatus.Rejected, label: 'Archived', color: 'border-rose-200/80 dark:border-rose-500/20 bg-rose-50/40 dark:bg-[#181113]', badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20' },
  ];

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-[#e2e4e9]">
      {error && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[#111216] border border-[#23252b]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              {applications.length} Active {applications.length === 1 ? 'Position' : 'Positions'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2 mt-1">
            <Kanban className="w-5 h-5 text-indigo-400" />
            Job Application Tracker
          </h1>
          <p className="text-xs sm:text-sm text-[#8e929b]">
            Track your recruitment stages, interview dates, and application conversion.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsAddModalOpen(true)}
          className="gap-2 text-xs self-start sm:self-auto bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl"
        >
          <Plus className="w-4 h-4" />
          <span>Add Application</span>
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
                  <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-zinc-200">{col.label}</span>
                </div>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${col.badgeColor}`}>
                  {items.length}
                </span>
              </div>

              <div className="space-y-3 flex-1">
                {items.map((app) => (
                  <Card key={app.id} bracketed={false} className="p-4 space-y-3 bg-white/90 dark:bg-[#16181f] border-slate-200/90 dark:border-[#23252b] hover:border-slate-300 dark:hover:border-[#323640] transition-all duration-200 shadow-sm rounded-xl">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="font-bold text-sm text-slate-900 dark:text-white tracking-tight">{app.jobTitle}</div>
                        <div className="text-xs text-slate-500 dark:text-[#8e929b] font-medium">{app.companyName}</div>
                      </div>
                      <button
                        onClick={() => handleDelete(app.id)}
                        className="text-slate-400 hover:text-rose-500 dark:text-zinc-500 dark:hover:text-rose-400 p-1 transition rounded-lg hover:bg-rose-500/10"
                        title="Delete application"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {(app.location || app.salaryRange) && (
                      <div className="text-xs text-slate-500 dark:text-[#8e929b] space-y-1 pt-1">
                        {app.location && <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {app.location}</div>}
                        {app.salaryRange && <div className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-emerald-400" /> {app.salaryRange}</div>}
                      </div>
                    )}

                    {/* Status Move Dropdown */}
                    <div className="pt-2.5 border-t border-slate-100 dark:border-[#23252b] flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-[#8e929b] font-medium">Stage:</span>
                      <select
                        value={app.status}
                        onChange={(e) => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                        className="bg-slate-50 dark:bg-[#1a1c24] border border-slate-200 dark:border-[#2a2d36] rounded-lg px-2 py-1 text-slate-800 dark:text-zinc-200 text-xs focus:outline-none focus:border-indigo-500"
                      >
                        {columns.map((c) => (
                          <option key={c.status} value={c.status}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  </Card>
                ))}

                {items.length === 0 && (
                  <div className="py-8 text-center text-xs text-slate-400 dark:text-zinc-600">
                    No applications
                  </div>
                )}
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
        <div className="space-y-4 pt-2 font-sans">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Company Name *</label>
            <Input value={newCompany} onChange={(e) => setNewCompany(e.target.value)} placeholder="e.g. Stripe, OpenAI, Google" className="rounded-xl" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Job Title *</label>
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Senior Software Engineer" className="rounded-xl" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Job Posting URL</label>
            <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://..." className="text-xs rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Location</label>
              <Input value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="Remote / New York" className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Salary Range</label>
              <Input value={newSalary} onChange={(e) => setNewSalary(e.target.value)} placeholder="$140k - $170k" className="rounded-xl" />
            </div>
          </div>
          <Button variant="primary" size="md" onClick={handleAdd} className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs py-2.5">
            Save Application
          </Button>
        </div>
      </Modal>
    </div>
  );
};
