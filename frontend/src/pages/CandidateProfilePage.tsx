import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { candidateProfileApi } from '../api';
import { CandidateProfileDto, ScreeningQuestionMemoryDto } from '../types/orchestrator';
import { 
  UserCheck, 
  Briefcase, 
  ShieldCheck, 
  Clock, 
  DollarSign, 
  MapPin, 
  Globe, 
  Linkedin, 
  Github, 
  ExternalLink, 
  Plus, 
  Trash2, 
  Save, 
  Database, 
  HelpCircle,
  CheckCircle2,
  BrainCircuit,
  Building
} from 'lucide-react';
import { Button, Card, Input, Badge } from '../components/ui';

export const CandidateProfilePage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'preferences' | 'evidence' | 'memory'>('preferences');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form State
  const [formData, setFormData] = useState<CandidateProfileDto>({
    phoneNumber: '',
    currentCity: '',
    currentCountry: '',
    workAuthorizationStatus: 'Authorized to work in current country',
    requiresVisaSponsorship: false,
    noticePeriodDays: 30,
    currentSalary: '',
    expectedSalary: '',
    salaryCurrency: 'INR',
    willingToRelocate: false,
    remotePreference: 'Remote or Hybrid',
    linkedInUrl: '',
    githubUrl: '',
    portfolioUrl: '',
    equalEmploymentGender: 'Decline to Self Identify',
    equalEmploymentRace: 'Decline to Self Identify',
    equalEmploymentVeteran: 'No',
    equalEmploymentDisability: 'No',
    evidenceKnowledgeBase: {}
  });

  // Evidence Base state
  const [newEvidenceKey, setNewEvidenceKey] = useState('');
  const [newEvidenceVal, setNewEvidenceVal] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');

  // Fetch Candidate Profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ['candidateProfile'],
    queryFn: candidateProfileApi.get,
  });

  // Fetch Screening Memories
  const { data: screeningMemories } = useQuery({
    queryKey: ['screeningMemories', companyFilter],
    queryFn: () => candidateProfileApi.getScreeningMemories(companyFilter || undefined),
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        ...profile,
        evidenceKnowledgeBase: profile.evidenceKnowledgeBase || {},
        salaryCurrency: profile.salaryCurrency || 'INR',
      });
    }
  }, [profile]);

  // Mutation to update profile
  const updateMutation = useMutation({
    mutationFn: candidateProfileApi.update,
    onSuccess: (updated) => {
      queryClient.setQueryData(['candidateProfile'], updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const addEvidence = () => {
    if (!newEvidenceKey.trim() || !newEvidenceVal.trim()) return;
    setFormData(prev => ({
      ...prev,
      evidenceKnowledgeBase: {
        ...prev.evidenceKnowledgeBase,
        [newEvidenceKey.trim()]: newEvidenceVal.trim()
      }
    }));
    setNewEvidenceKey('');
    setNewEvidenceVal('');
  };

  const removeEvidence = (key: string) => {
    setFormData(prev => {
      const copy = { ...prev.evidenceKnowledgeBase };
      delete copy[key];
      return { ...prev, evidenceKnowledgeBase: copy };
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <UserCheck className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Candidate Master Profile & Memory
          </h1>
          <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1">
            Store your work authorization, salary expectations, notice period, and verified evidence once. Used by AI to answer application questionnaires with 0 hallucination.
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          variant="primary"
          size="md"
          className="gap-2 shadow-sm"
        >
          {updateMutation.isPending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : saveSuccess ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saveSuccess ? 'Saved Successfully!' : 'Save Profile'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800 gap-6">
        <button
          onClick={() => setActiveTab('preferences')}
          className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
            activeTab === 'preferences'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Work & Preferences
        </button>

        <button
          onClick={() => setActiveTab('evidence')}
          className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
            activeTab === 'evidence'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Evidence Base ({Object.keys(formData.evidenceKnowledgeBase || {}).length})
        </button>

        <button
          onClick={() => setActiveTab('memory')}
          className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
            activeTab === 'memory'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          <BrainCircuit className="w-4 h-4" />
          Browser Agent Memory ({screeningMemories?.length || 0})
        </button>
      </div>

      {/* Tab 1: Work & Preferences */}
      {activeTab === 'preferences' && (
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Work Authorization & Visa */}
          <Card className="p-5 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Work Authorization & Visa
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                Work Authorization Status
              </label>
              <Input
                type="text"
                value={formData.workAuthorizationStatus}
                onChange={e => setFormData({ ...formData, workAuthorizationStatus: e.target.value })}
                placeholder="e.g. US Citizen, Green Card, Authorized for India / UK"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-zinc-950/60 rounded-xl border border-slate-200 dark:border-zinc-800">
              <div>
                <span className="text-sm font-medium text-slate-900 dark:text-zinc-100 block">Requires Visa Sponsorship?</span>
                <span className="text-xs text-slate-500 dark:text-zinc-400">Do you now or in the future need visa sponsorship?</span>
              </div>
              <input
                type="checkbox"
                checked={formData.requiresVisaSponsorship}
                onChange={e => setFormData({ ...formData, requiresVisaSponsorship: e.target.checked })}
                className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                Notice Period (Days)
              </label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min="0"
                  max="180"
                  value={formData.noticePeriodDays}
                  onChange={e => setFormData({ ...formData, noticePeriodDays: parseInt(e.target.value) || 0 })}
                  className="w-32"
                />
                <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                  {formData.noticePeriodDays === 0 ? 'Immediately Available' : `${formData.noticePeriodDays} days notice`}
                </span>
              </div>
            </div>
          </Card>

          {/* Compensation & Location */}
          <Card className="p-5 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              Compensation & Location
            </h2>

            {/* Currency Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">Salary Currency</label>
              <div className="flex gap-2">
                {(['INR', 'USD', 'GBP', 'EUR'] as const).map(currency => (
                  <button
                    key={currency}
                    type="button"
                    onClick={() => setFormData({ ...formData, salaryCurrency: currency })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      formData.salaryCurrency === currency
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 border-slate-300 dark:border-zinc-700 hover:border-indigo-400'
                    }`}
                  >
                    {currency === 'INR' ? '₹ INR' : currency === 'USD' ? '$ USD' : currency === 'GBP' ? '£ GBP' : '€ EUR'}
                  </button>
                ))}
              </div>
              {formData.salaryCurrency === 'INR' && (
                <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-1">
                  For foreign companies, salary will be auto-converted to USD (1 LPA ≈ $1,200 USD annually)
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Current Salary / CTC {formData.salaryCurrency === 'INR' ? '(LPA)' : `(${formData.salaryCurrency}/yr)`}
                </label>
                <Input
                  type="text"
                  value={formData.currentSalary}
                  onChange={e => setFormData({ ...formData, currentSalary: e.target.value })}
                  placeholder={formData.salaryCurrency === 'INR' ? 'e.g. 22 LPA or ₹22,00,000' : 'e.g. $130,000'}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Expected Salary / CTC {formData.salaryCurrency === 'INR' ? '(LPA)' : `(${formData.salaryCurrency}/yr)`}
                </label>
                <Input
                  type="text"
                  value={formData.expectedSalary}
                  onChange={e => setFormData({ ...formData, expectedSalary: e.target.value })}
                  placeholder={formData.salaryCurrency === 'INR' ? 'e.g. 30 LPA or ₹30,00,000' : 'e.g. $160,000'}
                />
              </div>
            </div>


            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">Current City</label>
                <Input
                  type="text"
                  value={formData.currentCity}
                  onChange={e => setFormData({ ...formData, currentCity: e.target.value })}
                  placeholder="e.g. Seattle, WA"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">Current Country</label>
                <Input
                  type="text"
                  value={formData.currentCountry}
                  onChange={e => setFormData({ ...formData, currentCountry: e.target.value })}
                  placeholder="e.g. United States"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">Remote Preference</label>
                <select
                  value={formData.remotePreference}
                  onChange={e => setFormData({ ...formData, remotePreference: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  <option value="Remote Only">Remote Only</option>
                  <option value="Remote or Hybrid">Remote or Hybrid</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="On-site">On-site</option>
                  <option value="Any">Any Work Model</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="relocate"
                  checked={formData.willingToRelocate}
                  onChange={e => setFormData({ ...formData, willingToRelocate: e.target.checked })}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
                <label htmlFor="relocate" className="text-xs font-medium text-slate-700 dark:text-zinc-300 cursor-pointer">
                  Willing to Relocate
                </label>
              </div>
            </div>
          </Card>

          {/* Contact & Social Handles */}
          <Card className="p-5 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Contact & Social Profiles
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">Phone Number</label>
              <Input
                type="text"
                value={formData.phoneNumber}
                onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                placeholder="+1 (555) 000-0000"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                <Linkedin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                LinkedIn Profile URL
              </label>
              <Input
                type="url"
                value={formData.linkedInUrl}
                onChange={e => setFormData({ ...formData, linkedInUrl: e.target.value })}
                placeholder="https://linkedin.com/in/username"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                <Github className="w-3.5 h-3.5 text-slate-800 dark:text-zinc-200" />
                GitHub Profile URL
              </label>
              <Input
                type="url"
                value={formData.githubUrl}
                onChange={e => setFormData({ ...formData, githubUrl: e.target.value })}
                placeholder="https://github.com/username"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Portfolio / Personal Website
              </label>
              <Input
                type="url"
                value={formData.portfolioUrl}
                onChange={e => setFormData({ ...formData, portfolioUrl: e.target.value })}
                placeholder="https://yourportfolio.dev"
              />
            </div>
          </Card>

          {/* Equal Opportunity (EEO) Standard Fields */}
          <Card className="p-5 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Standard EEO / OFCCP Auto-Fill
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">Optional: Used to auto-fill mandatory US/global equal opportunity disclosure questions on Greenhouse, Lever, and Workday.</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">Gender</label>
                <select
                  value={formData.equalEmploymentGender || 'Decline to Self Identify'}
                  onChange={e => setFormData({ ...formData, equalEmploymentGender: e.target.value })}
                  className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-Binary">Non-Binary</option>
                  <option value="Decline to Self Identify">Decline to Self Identify</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">Veteran Status</label>
                <select
                  value={formData.equalEmploymentVeteran || 'No'}
                  onChange={e => setFormData({ ...formData, equalEmploymentVeteran: e.target.value })}
                  className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  <option value="I am not a protected veteran">I am not a protected veteran</option>
                  <option value="I identify as a protected veteran">I identify as a protected veteran</option>
                  <option value="Decline to Self Identify">Decline to Self Identify</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">Disability Status</label>
              <select
                value={formData.equalEmploymentDisability || 'No'}
                onChange={e => setFormData({ ...formData, equalEmploymentDisability: e.target.value })}
                className="flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="No, I do not have a disability">No, I do not have a disability</option>
                <option value="Yes, I have a disability">Yes, I have a disability</option>
                <option value="Decline to Self Identify">Decline to Self Identify</option>
              </select>
            </div>
          </Card>
        </form>
      )}

      {/* Tab 2: Evidence Knowledge Base */}
      {activeTab === 'evidence' && (
        <Card className="p-6 space-y-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Verified Evidence Knowledge Base
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Add specific evidence snippets for skills and leadership topics. When answering complex open-ended screening questions (e.g. &quot;Describe a time you solved a performance bottleneck&quot;), the AI will strictly cite these factual points.
            </p>
          </div>

          {/* Add New Evidence Form */}
          <div className="p-4 bg-slate-50 dark:bg-zinc-950/70 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-3">
            <h3 className="text-xs font-semibold uppercase text-slate-700 dark:text-zinc-300 tracking-wider">Add Evidence Entry</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Input
                  type="text"
                  placeholder="Topic / Skill (e.g. Kubernetes, Mentorship)"
                  value={newEvidenceKey}
                  onChange={e => setNewEvidenceKey(e.target.value)}
                />
              </div>
              <div className="md:col-span-2 flex gap-2">
                <Input
                  type="text"
                  placeholder="Verified Evidence & Metrics (e.g. Led migration to AWS EKS with zero downtime across 40 services)"
                  value={newEvidenceVal}
                  onChange={e => setNewEvidenceVal(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={addEvidence}
                  className="gap-1 px-4"
                >
                  <Plus className="w-4 h-4" /> Add
                </Button>
              </div>
            </div>
          </div>

          {/* Evidence List */}
          <div className="space-y-3">
            {Object.keys(formData.evidenceKnowledgeBase || {}).length === 0 ? (
              <div className="text-center py-8 text-slate-400 dark:text-zinc-500 text-xs">
                No custom evidence entries yet. Add skills or achievement topics above.
              </div>
            ) : (
              Object.entries(formData.evidenceKnowledgeBase).map(([key, val]) => (
                <div
                  key={key}
                  className="flex items-start justify-between p-4 bg-slate-50 dark:bg-zinc-950/70 rounded-xl border border-slate-200 dark:border-zinc-800 gap-4"
                >
                  <div className="space-y-1">
                    <span className="inline-block px-2.5 py-0.5 text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-md">
                      {key}
                    </span>
                    <p className="text-sm text-slate-800 dark:text-zinc-200">{val}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeEvidence(key)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 dark:text-zinc-500 dark:hover:text-rose-400 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* Tab 3: Browser Agent Memory */}
      {activeTab === 'memory' && (
        <Card className="p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Company Screening Memory Engine
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Saved question-and-answer pairs learned from past applications. When applying to the same company again, Vedha AI immediately reuses matching answers.
              </p>
            </div>

            <div className="w-full md:w-64">
              <Input
                type="text"
                placeholder="Filter by company..."
                value={companyFilter}
                onChange={e => setCompanyFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-zinc-800">
            {(!screeningMemories || screeningMemories.length === 0) ? (
              <div className="text-center py-12 text-slate-400 dark:text-zinc-500 text-sm">
                No past screening questions memorized yet. As you run application pipelines, answers will be cached here.
              </div>
            ) : (
              screeningMemories.map((mem) => (
                <div key={mem.id} className="py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                        <Building className="w-3 h-3" />
                        {mem.company}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-zinc-500">
                        Used {mem.successCount}x • Last {new Date(mem.lastUsedAtUtc).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40">
                      {mem.fieldType}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Q: {mem.questionText}
                  </p>
                  <p className="text-xs text-slate-700 dark:text-zinc-300 bg-slate-50 dark:bg-zinc-950/70 p-3 rounded-lg border border-slate-200 dark:border-zinc-800 leading-relaxed font-sans">
                    A: {mem.answerText}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
