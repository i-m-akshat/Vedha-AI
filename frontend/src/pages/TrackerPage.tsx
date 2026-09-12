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
  MoreVertical
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

  const fetchApps = async () => {
    try {
      const list = await applicationsApi.list();
      setApplications(list);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const handleStatusChange = async (id: string, newStatus: ApplicationStatus) => {
    await applicationsApi.updateStatus(id, newStatus);
    fetchApps();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this application record?')) {
      await applicationsApi.delete(id);
      fetchApps();
    }
  };

  const handleAdd = async () => {
    if (!newCompany.trim() || !newTitle.trim()) return;
    await applicationsApi.create({
      companyName: newCompany.trim(),
      jobTitle: newTitle.trim(),
      jobUrl: newUrl.trim() || undefined,
      location: newLocation.trim() || undefined,
      salaryRange: newSalary.trim() || undefined,
      status: ApplicationStatus.Saved,
    });
    setNewCompany('');
    setNewTitle('');
    setNewUrl('');
    setNewLocation('');
    setNewSalary('');
    setIsAddModalOpen(false);
    fetchApps();
  };

  const columns: { status: ApplicationStatus; label: string; color: string }[] = [
    { status: ApplicationStatus.Saved, label: 'Saved', color: 'border-zinc-700 bg-zinc-900/40' },
    { status: ApplicationStatus.Applied, label: 'Applied', color: 'border-indigo-500/30 bg-indigo-950/20' },
    { status: ApplicationStatus.Interviewing, label: 'Interviewing', color: 'border-purple-500/30 bg-purple-950/20' },
    { status: ApplicationStatus.Offered, label: 'Offered', color: 'border-emerald-500/30 bg-emerald-950/20' },
    { status: ApplicationStatus.Rejected, label: 'Rejected', color: 'border-rose-500/30 bg-rose-950/20' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Kanban className="w-5 h-5 text-indigo-400" />
            Job Application Tracker
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
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
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <span className="text-xs font-bold text-zinc-200">{col.label}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-semibold font-mono">
                  {items.length}
                </span>
              </div>

              <div className="space-y-3 flex-1">
                {items.map((app) => (
                  <Card key={app.id} className="p-3.5 space-y-2.5 bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-xs text-white">{app.jobTitle}</div>
                        <div className="text-[11px] text-zinc-400">{app.companyName}</div>
                      </div>
                      <button
                        onClick={() => handleDelete(app.id)}
                        className="text-zinc-600 hover:text-rose-400 p-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {(app.location || app.salaryRange) && (
                      <div className="text-[10px] text-zinc-500 space-y-0.5">
                        {app.location && <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {app.location}</div>}
                        {app.salaryRange && <div className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> {app.salaryRange}</div>}
                      </div>
                    )}

                    {/* Status Move Dropdown */}
                    <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px]">
                      <span className="text-zinc-500">Move to:</span>
                      <select
                        value={app.status}
                        onChange={(e) => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                        className="bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-300 text-[10px] focus:outline-none"
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
            <label className="text-xs font-medium text-zinc-400">Company Name *</label>
            <Input value={newCompany} onChange={(e) => setNewCompany(e.target.value)} placeholder="e.g. Stripe" />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400">Job Title *</label>
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Senior Backend Engineer" />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400">Job Posting URL</label>
            <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-400">Location</label>
              <Input value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="San Francisco / Remote" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-400">Salary Range</label>
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
