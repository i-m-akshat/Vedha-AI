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
        evidenceKnowledgeBase: profile.evidenceKnowledgeBase || {}
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-dark-700 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
            <UserCheck className="w-7 h-7 text-primary-600 dark:text-primary-400" />
            Candidate Master Profile & Memory
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Store your work authorization, salary expectations, notice period, and verified evidence once. Used by AI to answer application questionnaires with 0 hallucination.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg shadow-sm transition disabled:opacity-50"
        >
          {updateMutation.isPending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : saveSuccess ? (
            <CheckCircle2 className="w-4 h-4 text-white" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saveSuccess ? 'Saved Successfully!' : 'Save Profile'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-dark-700 gap-6">
        <button
          onClick={() => setActiveTab('preferences')}
          className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
            activeTab === 'preferences'
              ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Work & Preferences
        </button>

        <button
          onClick={() => setActiveTab('evidence')}
          className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
            activeTab === 'evidence'
              ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Evidence Base ({Object.keys(formData.evidenceKnowledgeBase || {}).length})
        </button>

        <button
          onClick={() => setActiveTab('memory')}
          className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
            activeTab === 'memory'
              ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
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
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5 space-y-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Work Authorization & Visa
            </h2>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Work Authorization Status
              </label>
              <input
                type="text"
                value={formData.workAuthorizationStatus}
                onChange={e => setFormData({ ...formData, workAuthorizationStatus: e.target.value })}
                placeholder="e.g. US Citizen, Green Card, Authorized for India / UK"
                className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-dark-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-900/50 rounded-lg border border-gray-200 dark:border-dark-700">
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white block">Requires Visa Sponsorship?</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">Do you now or in future need visa sponsorship?</span>
              </div>
              <input
                type="checkbox"
                checked={formData.requiresVisaSponsorship}
                onChange={e => setFormData({ ...formData, requiresVisaSponsorship: e.target.checked })}
                className="w-5 h-5 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-500" />
                Notice Period (Days)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={formData.noticePeriodDays}
                  onChange={e => setFormData({ ...formData, noticePeriodDays: parseInt(e.target.value) || 0 })}
                  className="w-32 px-3.5 py-2 text-sm bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-dark-600 rounded-lg text-gray-900 dark:text-white"
                />
                <span className="text-xs text-gray-500">
                  {formData.noticePeriodDays === 0 ? 'Immediately Available' : `${formData.noticePeriodDays} days notice`}
                </span>
              </div>
            </div>
          </div>

          {/* Compensation & Location */}
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5 space-y-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-600" />
              Compensation & Location
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Current Salary / CTC</label>
                <input
                  type="text"
                  value={formData.currentSalary}
                  onChange={e => setFormData({ ...formData, currentSalary: e.target.value })}
                  placeholder="e.g. $130,000 / ₹22 LPA"
                  className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-dark-600 rounded-lg text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Expected Salary / CTC</label>
                <input
                  type="text"
                  value={formData.expectedSalary}
                  onChange={e => setFormData({ ...formData, expectedSalary: e.target.value })}
                  placeholder="e.g. $160,000 / ₹30 LPA"
                  className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-dark-600 rounded-lg text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Current City</label>
                <input
                  type="text"
                  value={formData.currentCity}
                  onChange={e => setFormData({ ...formData, currentCity: e.target.value })}
                  placeholder="e.g. Seattle, WA"
                  className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-dark-600 rounded-lg text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Current Country</label>
                <input
                  type="text"
                  value={formData.currentCountry}
                  onChange={e => setFormData({ ...formData, currentCountry: e.target.value })}
                  placeholder="e.g. United States"
                  className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-dark-600 rounded-lg text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Remote Preference</label>
                <select
                  value={formData.remotePreference}
                  onChange={e => setFormData({ ...formData, remotePreference: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-dark-600 rounded-lg text-gray-900 dark:text-white"
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
                  className="w-4 h-4 text-primary-600 rounded border-gray-300"
                />
                <label htmlFor="relocate" className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Willing to Relocate
                </label>
              </div>
            </div>
          </div>

          {/* Contact & Social Handles */}
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5 space-y-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-600" />
              Contact & Social Profiles
            </h2>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
              <input
                type="text"
                value={formData.phoneNumber}
                onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                placeholder="+1 (555) 000-0000"
                className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-dark-600 rounded-lg text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                <Linkedin className="w-3.5 h-3.5 text-blue-600" />
                LinkedIn Profile URL
              </label>
              <input
                type="url"
                value={formData.linkedInUrl}
                onChange={e => setFormData({ ...formData, linkedInUrl: e.target.value })}
                placeholder="https://linkedin.com/in/username"
                className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-dark-600 rounded-lg text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                <Github className="w-3.5 h-3.5 text-gray-800 dark:text-gray-200" />
                GitHub Profile URL
              </label>
              <input
                type="url"
                value={formData.githubUrl}
                onChange={e => setFormData({ ...formData, githubUrl: e.target.value })}
                placeholder="https://github.com/username"
                className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-dark-600 rounded-lg text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                Portfolio / Personal Website
              </label>
              <input
                type="url"
                value={formData.portfolioUrl}
                onChange={e => setFormData({ ...formData, portfolioUrl: e.target.value })}
                placeholder="https://yourportfolio.dev"
                className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-dark-600 rounded-lg text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Equal Opportunity (EEO) Standard Fields */}
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5 space-y-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-purple-600" />
              Standard EEO / OFCCP Auto-Fill
            </h2>
            <p className="text-xs text-gray-500">Optional: Used to auto-fill mandatory US/global equal opportunity disclosure questions on Greenhouse, Lever, and Workday.</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Gender</label>
                <select
                  value={formData.equalEmploymentGender || 'Decline to Self Identify'}
                  onChange={e => setFormData({ ...formData, equalEmploymentGender: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-dark-600 rounded-lg text-gray-900 dark:text-white"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-Binary">Non-Binary</option>
                  <option value="Decline to Self Identify">Decline to Self Identify</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Veteran Status</label>
                <select
                  value={formData.equalEmploymentVeteran || 'No'}
                  onChange={e => setFormData({ ...formData, equalEmploymentVeteran: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-dark-600 rounded-lg text-gray-900 dark:text-white"
                >
                  <option value="I am not a protected veteran">I am not a protected veteran</option>
                  <option value="I identify as a protected veteran">I identify as a protected veteran</option>
                  <option value="Decline to Self Identify">Decline to Self Identify</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Disability Status</label>
              <select
                value={formData.equalEmploymentDisability || 'No'}
                onChange={e => setFormData({ ...formData, equalEmploymentDisability: e.target.value })}
                className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-dark-600 rounded-lg text-gray-900 dark:text-white"
              >
                <option value="No, I do not have a disability">No, I do not have a disability</option>
                <option value="Yes, I have a disability">Yes, I have a disability</option>
                <option value="Decline to Self Identify">Decline to Self Identify</option>
              </select>
            </div>
          </div>
        </form>
      )}

      {/* Tab 2: Evidence Knowledge Base */}
      {activeTab === 'evidence' && (
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-6 space-y-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary-600" />
              Verified Evidence Knowledge Base
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Add specific evidence snippets for skills and leadership topics. When answering complex open-ended screening questions (e.g. &quot;Describe a time you solved a performance bottleneck&quot;), the AI will strictly cite these factual points.
            </p>
          </div>

          {/* Add New Evidence Form */}
          <div className="p-4 bg-gray-50 dark:bg-dark-900/60 rounded-xl border border-gray-200 dark:border-dark-700 space-y-3">
            <h3 className="text-xs font-semibold uppercase text-gray-700 dark:text-gray-300">Add Evidence Entry</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <input
                  type="text"
                  placeholder="Topic / Skill (e.g. Kubernetes, Mentorship)"
                  value={newEvidenceKey}
                  onChange={e => setNewEvidenceKey(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-dark-800 border border-gray-300 dark:border-dark-600 rounded-lg text-gray-900 dark:text-white"
                />
              </div>
              <div className="md:col-span-2 flex gap-2">
                <input
                  type="text"
                  placeholder="Verified Evidence & Metrics (e.g. Led migration to AWS EKS with zero downtime across 40 services)"
                  value={newEvidenceVal}
                  onChange={e => setNewEvidenceVal(e.target.value)}
                  className="flex-1 px-3.5 py-2 text-sm bg-white dark:bg-dark-800 border border-gray-300 dark:border-dark-600 rounded-lg text-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={addEvidence}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-lg transition"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </div>
          </div>

          {/* Evidence List */}
          <div className="space-y-3">
            {Object.keys(formData.evidenceKnowledgeBase || {}).length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">
                No custom evidence entries yet. Add skills or achievement topics above.
              </div>
            ) : (
              Object.entries(formData.evidenceKnowledgeBase).map(([key, val]) => (
                <div
                  key={key}
                  className="flex items-start justify-between p-4 bg-gray-50 dark:bg-dark-900 rounded-lg border border-gray-200 dark:border-dark-700 gap-4"
                >
                  <div className="space-y-1">
                    <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 rounded">
                      {key}
                    </span>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{val}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeEvidence(key)}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-md transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Browser Agent Memory */}
      {activeTab === 'memory' && (
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-indigo-600" />
                Company Screening Memory Engine
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Saved question-and-answer pairs learned from past applications. When applying to the same company again, ResuMate immediately reuses matching answers.
              </p>
            </div>

            <div className="w-full md:w-64">
              <input
                type="text"
                placeholder="Filter by company..."
                value={companyFilter}
                onChange={e => setCompanyFilter(e.target.value)}
                className="w-full px-3.5 py-1.5 text-xs bg-gray-50 dark:bg-dark-900 border border-gray-300 dark:border-dark-600 rounded-lg text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-dark-700">
            {(!screeningMemories || screeningMemories.length === 0) ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                No past screening questions memorized yet. As you run application pipelines, answers will be cached here.
              </div>
            ) : (
              screeningMemories.map((mem) => (
                <div key={mem.id} className="py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300">
                        <Building className="w-3 h-3" />
                        {mem.company}
                      </span>
                      <span className="text-xs text-gray-400">
                        Used {mem.successCount}x • Last {new Date(mem.lastUsedAtUtc).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                      {mem.fieldType}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Q: {mem.questionText}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-dark-900/60 p-2.5 rounded-lg border border-gray-100 dark:border-dark-700">
                    A: {mem.answerText}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
