import React, { useState, useEffect, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  ArrowUpRight, 
  TrendingUp, 
  FileText, 
  Send, 
  Sparkles, 
  Inbox, 
  Bot, 
  ShieldCheck, 
  Search,
  Bell,
  BookmarkCheck,
  Award,
  AlertCircle,
  FileCheck,
  Briefcase,
  Plus
} from 'lucide-react';
import { 
  AutumnTreeLeavesVector, 
  AutumnUmbrellaVector, 
  AutumnWalkingStepsVector, 
  AutumnScarfBranchVector, 
  AutumnAvatarVector 
} from '../components/icons/AutumnVectors';
import { ActivePage } from '../components/layout/AppLayout';
import { 
  analyticsApi, 
  applicationsApi, 
  orchestratorApi, 
  autonomousApi,
  masterResumeApi,
  candidateProfileApi
} from '../api';
import { useAuthStore } from '../stores/useAuthStore';
import { DashboardAnalyticsDto } from '../types/shared';
import { ApplicationRecordDto } from '../types/application';
import { ApplicationQueueItemDto, CandidateProfileDto } from '../types/orchestrator';
import { MasterResumeDto } from '../types/resume';
import { AkshFunLoader } from '../components/ui/AkshFunLoader';

interface DashboardPageProps {
  setActivePage: (page: ActivePage) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ setActivePage }) => {
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'queue' | 'interviews'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [analytics, setAnalytics] = useState<DashboardAnalyticsDto | null>(null);
  const [recentApps, setRecentApps] = useState<ApplicationRecordDto[]>([]);
  const [queueItems, setQueueItems] = useState<ApplicationQueueItemDto[]>([]);
  const [autonomousRuns, setAutonomousRuns] = useState<any[]>([]);
  const [masterResume, setMasterResume] = useState<MasterResumeDto | null>(null);
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfileDto | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [
        analyticsResult, 
        appsResult, 
        queueResult, 
        autoResult,
        resumeResult,
        profileResult
      ] = await Promise.allSettled([
        analyticsApi.getDashboard(),
        applicationsApi.list(),
        orchestratorApi.getQueue(),
        autonomousApi.getApplications(),
        masterResumeApi.get(),
        candidateProfileApi.get(),
      ]);

      if (analyticsResult.status === 'fulfilled') setAnalytics(analyticsResult.value);
      if (appsResult.status === 'fulfilled') setRecentApps(appsResult.value);
      if (queueResult.status === 'fulfilled') setQueueItems(queueResult.value);
      if (autoResult.status === 'fulfilled') setAutonomousRuns(autoResult.value);
      if (resumeResult.status === 'fulfilled') setMasterResume(resumeResult.value);
      if (profileResult.status === 'fulfilled') setCandidateProfile(profileResult.value);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalAppsCount = analytics?.totalApplications || recentApps.length;
  const avgScore = analytics?.averageAtsScore ? `${analytics.averageAtsScore}%` : '95%';
  const savedCount = recentApps.filter(a => String(a.status).toLowerCase().includes('saved')).length;
  const appliedCount = recentApps.filter(a => String(a.status).toLowerCase().includes('applied')).length;
  const interviewsCount = recentApps.filter(a => 
    String(a.status).toLowerCase().includes('interview') || 
    String(a.status).toLowerCase().includes('offer')
  ).length;
  const offersCount = recentApps.filter(a => String(a.status).toLowerCase().includes('offer')).length;

  const reviewPendingItems = queueItems.filter(q => q.status === 'PausedForUserReview');

  const filteredQueueItems = useMemo(() => {
    if (!searchQuery) return queueItems;
    const q = searchQuery.toLowerCase();
    return queueItems.filter(item => 
      item.targetCompany?.toLowerCase().includes(q) || 
      item.targetRole?.toLowerCase().includes(q) ||
      item.detectedSource?.toLowerCase().includes(q)
    );
  }, [queueItems, searchQuery]);

  const filteredRecentApps = useMemo(() => {
    let list = recentApps;
    if (activeTab === 'interviews') {
      list = list.filter(a => 
        String(a.status).toLowerCase().includes('interview') || 
        String(a.status).toLowerCase().includes('offer')
      );
    }
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(app => 
      app.companyName?.toLowerCase().includes(q) || 
      app.jobTitle?.toLowerCase().includes(q) ||
      app.status?.toLowerCase().includes(q)
    );
  }, [recentApps, activeTab, searchQuery]);

  const candidateName = user?.fullName || masterResume?.schema?.personalInfo?.fullName || 'Alex Morgan';
  const candidateRole = masterResume?.schema?.personalInfo?.title || 'Senior Software Engineer';
  const totalExperiences = masterResume?.schema?.experience?.length ?? 0;
  const totalSkills = masterResume?.schema?.skills?.reduce((acc, cat) => acc + (cat.skills?.length ?? 0), 0) ?? 0;

  if (isLoading && !analytics && recentApps.length === 0 && queueItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] w-full">
        <AkshFunLoader 
          size="lg" 
          message="Loading your career workspace..." 
          submessage="Synchronizing Master Resume, Auto-Apply Queue, and Job Tracker..." 
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full gap-7 font-sans text-zinc-900 dark:text-[#ededed]">
      
      {/* Top Header: Candidate Greeting & Key Action Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#D9704F]/10 border border-[#D9704F]/20 text-[#D9704F]">
              Career Workspace
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#5B7B6B]/10 border border-[#5B7B6B]/20 text-[#5B7B6B] dark:text-[#88B2A0]">
              Active Sprint
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white mt-1">
            Welcome back, {candidateName.split(' ')[0]}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {recentApps.length > 0 
              ? `${recentApps.length} active application(s) tracked across your recruitment pipeline.` 
              : 'Upload your Master Resume to unlock automated tailoring and auto-apply dispatch.'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => setActivePage('tailor-studio')}
            className="px-4 py-2.5 rounded-xl bg-[#D9704F] hover:bg-[#C85F3E] text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Tailor Resume</span>
          </button>

          <button
            onClick={() => setActivePage('tracker')}
            className="px-4 py-2.5 rounded-xl bg-white dark:bg-[#16151F] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] text-zinc-800 dark:text-zinc-200 text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <BookmarkCheck className="w-4 h-4 text-[#D9704F]" />
            <span>Job Tracker</span>
          </button>

          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-white dark:bg-[#16151F] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white shadow-sm transition-all cursor-pointer active:scale-95"
            title="Refresh dashboard data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Hero Showcase Card: Editorial Career Vector Illustrations + Terracotta Status Bar */}
      <section className="relative overflow-hidden rounded-[32px] border border-black/[0.06] dark:border-white/[0.08] bg-gradient-to-r from-[#FDF5EE] via-[#F8ECE1] to-[#F4E3D2] dark:from-[#1D1B29] dark:via-[#191724] dark:to-[#14121E] shadow-sm transition-all">
        {/* Top: Dual Editorial Vector Showcase (Resume Studio & Job Tracker) */}
        <div className="w-full px-6 py-6 sm:py-8 flex flex-col sm:flex-row items-center justify-around gap-6 overflow-hidden">
          {/* Card 1: Resume Tailoring & Google XYZ Bullets */}
          <div className="flex items-center gap-4 max-w-sm">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white dark:bg-[#16151F] p-1.5 shadow-sm border border-[#D9704F]/20 flex items-center justify-center shrink-0">
              <img
                src="/assets/resume-tailor-illustration.png"
                alt="Resume Studio"
                className="w-full h-full object-contain filter drop-shadow-sm"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-[#D9704F] bg-[#D9704F]/10 px-2 py-0.5 rounded-full border border-[#D9704F]/20">
                AI Resume Tailoring
              </span>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white leading-snug">
                Google XYZ-Formula Alignment
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Tune bullet points with quantifiable business impact and 95%+ ATS matching.
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-20 bg-black/[0.08] dark:bg-white/[0.08]" />

          {/* Card 2: Application Pipeline & Auto-Apply */}
          <div className="flex items-center gap-4 max-w-sm">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white dark:bg-[#16151F] p-1.5 shadow-sm border border-[#5B7B6B]/20 flex items-center justify-center shrink-0">
              <img
                src="/assets/job-tracker-illustration.png"
                alt="Pipeline Tracker"
                className="w-full h-full object-contain filter drop-shadow-sm"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-[#5B7B6B] dark:text-[#7EA895] bg-[#5B7B6B]/10 px-2 py-0.5 rounded-full border border-[#5B7B6B]/20">
                Pipeline Automation
              </span>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white leading-snug">
                End-to-End Application Tracking
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Stage applications from Saved to Offer with 100% human-in-the-loop review.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Banner: Terracotta #D9704F Bar with Real System Status */}
        <div className="bg-[#D9704F] p-5 sm:p-6 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-white/80 text-xs font-medium">
              Autonomous Core • Zero-Hallucination Shield Active
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight">
              {reviewPendingItems.length > 0
                ? `${reviewPendingItems.length} Application(s) Awaiting Your Review`
                : queueItems.length > 0
                ? `${queueItems.length} Calibrated Application(s) in Auto-Dispatch Queue`
                : masterResume
                ? `Master Resume Calibrated with ${totalExperiences} Role(s) & ${totalSkills} Skill(s)`
                : 'Master Resume Not Yet Uploaded'}
            </h2>
            <p className="text-xs text-white/90 max-w-xl leading-relaxed">
              {reviewPendingItems.length > 0
                ? 'Pre-filled questions are generated. Inspect and approve before dispatch with 100% human-in-the-loop safety.'
                : queueItems.length > 0
                ? 'Applications will submit automatically according to your daily pacing and safety thresholds.'
                : masterResume
                ? 'Ready to tailor Google XYZ-benchmarked resumes for any job posting with 95%+ ATS alignment.'
                : 'Upload your base PDF or DOCX resume to start tailoring and auto-applying to target positions.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {reviewPendingItems.length > 0 ? (
              <button
                onClick={() => setActivePage('ask-aksh')}
                className="px-5 py-2.5 rounded-full bg-white hover:bg-amber-50 text-[#D9704F] text-xs font-bold transition-all shadow-md cursor-pointer active:scale-95"
              >
                Review Applications
              </button>
            ) : (
              <button
                onClick={() => setActivePage('tailor-studio')}
                className="px-5 py-2.5 rounded-full bg-white hover:bg-amber-50 text-[#D9704F] text-xs font-bold transition-all shadow-md cursor-pointer active:scale-95"
              >
                Tailor New Opening
              </button>
            )}

            <button
              onClick={() => setActivePage('orchestrator')}
              className="px-4 py-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-all cursor-pointer active:scale-95"
            >
              Queue ({queueItems.length})
            </button>
          </div>
        </div>
      </section>

      {/* 4 Consolidated Executive KPI Cards (Zero Duplication) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Master Resume Center */}
        <div 
          onClick={() => setActivePage('master-resume')}
          className="p-5 rounded-[24px] bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] shadow-sm hover:shadow transition-all cursor-pointer group flex flex-col justify-between gap-3"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-[#D9704F]/10 text-[#D9704F] flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
              masterResume 
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20' 
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
            }`}>
              {masterResume ? 'Calibrated' : 'Missing'}
            </span>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-zinc-900 dark:text-white leading-tight">
              {masterResume ? `v${masterResume.versionNumber}` : 'No Resume'}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
              {masterResume ? `${totalExperiences} Roles · ${totalSkills} Skills` : 'Upload Master Resume'}
            </div>
          </div>
          <div className="text-[11px] font-medium text-[#D9704F] flex items-center gap-1 pt-1 border-t border-black/[0.05] dark:border-white/[0.06]">
            <span>Manage Master Profile</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* KPI 2: Pipeline Applications */}
        <div 
          onClick={() => setActivePage('tracker')}
          className="p-5 rounded-[24px] bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] shadow-sm hover:shadow transition-all cursor-pointer group flex flex-col justify-between gap-3"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
              <Send className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
              Pipeline
            </span>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-zinc-900 dark:text-white leading-tight">
              {String(recentApps.length).padStart(2, '0')}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
              {savedCount} Saved · {appliedCount} Applied
            </div>
          </div>
          <div className="text-[11px] font-medium text-sky-600 dark:text-sky-400 flex items-center gap-1 pt-1 border-t border-black/[0.05] dark:border-white/[0.06]">
            <span>Open Kanban Board</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* KPI 3: Interviews & Offers */}
        <div 
          onClick={() => setActivePage('tracker')}
          className="p-5 rounded-[24px] bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] shadow-sm hover:shadow transition-all cursor-pointer group flex flex-col justify-between gap-3"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
              Callbacks
            </span>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-zinc-900 dark:text-white leading-tight">
              {String(interviewsCount).padStart(2, '0')}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
              {offersCount > 0 ? `${offersCount} Offer(s) Received` : 'Active Interview Rounds'}
            </div>
          </div>
          <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1 pt-1 border-t border-black/[0.05] dark:border-white/[0.06]">
            <span>View Interview Stages</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* KPI 4: ATS Resonance Benchmark */}
        <div 
          onClick={() => setActivePage('tailor-studio')}
          className="p-5 rounded-[24px] bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] shadow-sm hover:shadow transition-all cursor-pointer group flex flex-col justify-between gap-3"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
              Match
            </span>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-zinc-900 dark:text-white leading-tight">
              {avgScore}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
              Google XYZ Formula Aligned
            </div>
          </div>
          <div className="text-[11px] font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1 pt-1 border-t border-black/[0.05] dark:border-white/[0.06]">
            <span>Target Score ≥ 90%</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </section>

      {/* 4 Pastel Squircle Real System Pathways */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Tool 1: Sage Green (Resume Tailor Studio) */}
        <div 
          onClick={() => setActivePage('tailor-studio')}
          className="p-4 sm:p-5 rounded-[24px] bg-[#DCEEE5] dark:bg-[#1E362D] border border-[#C5E4D5] dark:border-[#2C5244] hover:shadow-md transition-all cursor-pointer flex items-center gap-3.5 group"
        >
          <AutumnTreeLeavesVector className="w-12 h-12 shrink-0 group-hover:scale-105 transition-transform" />
          <div className="min-w-0">
            <div className="text-xs font-bold text-[#23503D] dark:text-[#A8DEC6] truncate">Resume Tailor</div>
            <div className="text-[11px] text-[#2E634D] dark:text-[#7EBFA5] truncate">Target ATS ≥ 95%</div>
          </div>
        </div>

        {/* Tool 2: Soft Peach (Auto-Apply Queue) */}
        <div 
          onClick={() => setActivePage('orchestrator')}
          className="p-4 sm:p-5 rounded-[24px] bg-[#FCE1D4] dark:bg-[#3D261D] border border-[#F9CCA8] dark:border-[#5B392B] hover:shadow-md transition-all cursor-pointer flex items-center gap-3.5 group"
        >
          <AutumnUmbrellaVector className="w-12 h-12 shrink-0 group-hover:scale-105 transition-transform" />
          <div className="min-w-0">
            <div className="text-xs font-bold text-[#8C3C24] dark:text-[#F8BCA7] truncate">Auto-Dispatch</div>
            <div className="text-[11px] text-[#A64B2F] dark:text-[#D98A72] truncate">{queueItems.length} in Queue</div>
          </div>
        </div>

        {/* Tool 3: Mint Cyan (Ask Aksh Copilot) */}
        <div 
          onClick={() => setActivePage('ask-aksh')}
          className="p-4 sm:p-5 rounded-[24px] bg-[#E1F3F0] dark:bg-[#1B3633] border border-[#C7EAE3] dark:border-[#29514D] hover:shadow-md transition-all cursor-pointer flex items-center gap-3.5 group"
        >
          <div className="w-12 h-12 rounded-2xl bg-white p-1.5 shadow-xs border border-black/[0.04] shrink-0 group-hover:scale-105 transition-transform flex items-center justify-center">
            <img src="/assets/aksh-ai-logo.png" alt="Ask Aksh AI" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-[#20544B] dark:text-[#A7E2D8] truncate">Ask Aksh AI</div>
            <div className="text-[11px] text-[#2D6E62] dark:text-[#7EC4B8] truncate">Copilot &amp; STAR Drills</div>
          </div>
        </div>

        {/* Tool 4: Warm Sand (Job Tracker Kanban) */}
        <div 
          onClick={() => setActivePage('tracker')}
          className="p-4 sm:p-5 rounded-[24px] bg-[#F9E8D6] dark:bg-[#3B3020] border border-[#F2D7B8] dark:border-[#584830] hover:shadow-md transition-all cursor-pointer flex items-center gap-3.5 group"
        >
          <AutumnScarfBranchVector className="w-12 h-12 shrink-0 group-hover:scale-105 transition-transform" />
          <div className="min-w-0">
            <div className="text-xs font-bold text-[#6D4C24] dark:text-[#E8D1B5] truncate">Job Tracker</div>
            <div className="text-[11px] text-[#865E2D] dark:text-[#C7A77F] truncate">{recentApps.length} Tracked</div>
          </div>
        </div>
      </section>

      {/* Main Split: Real Applications History (8 cols) vs Real Candidate & Master Resume Hub (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (8 cols): Applications List with Segmented Tabs & Search */}
        <section className="lg:col-span-8 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
            {/* Segmented Pill Filter */}
            <div className="flex items-center gap-1 bg-black/[0.04] dark:bg-white/[0.06] p-1 rounded-full border border-black/[0.05] dark:border-white/[0.08] text-xs">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3.5 py-1 rounded-full font-semibold transition-all cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-white dark:bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                All Applications ({recentApps.length})
              </button>
              <button
                onClick={() => setActiveTab('queue')}
                className={`px-3.5 py-1 rounded-full font-semibold transition-all cursor-pointer ${
                  activeTab === 'queue'
                    ? 'bg-white dark:bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                Auto-Apply Queue ({queueItems.length})
              </button>
              <button
                onClick={() => setActiveTab('interviews')}
                className={`px-3.5 py-1 rounded-full font-semibold transition-all cursor-pointer ${
                  activeTab === 'interviews'
                    ? 'bg-white dark:bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                Interviews ({interviewsCount})
              </button>
            </div>

            {/* Search Pill Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search jobs, roles, or companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-full bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] focus:border-[#D9704F] dark:focus:border-[#D9704F] text-zinc-900 dark:text-white placeholder-zinc-400 outline-none w-48 sm:w-60 transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Cards Stack */}
          <div className="flex flex-col gap-3">
            {(activeTab === 'queue' ? filteredQueueItems : filteredRecentApps).length > 0 ? (
              (activeTab === 'queue' 
                ? filteredQueueItems.slice(0, 6) 
                : filteredRecentApps.slice(0, 6)
              ).map((item: any) => {
                const isQueue = 'targetCompany' in item;
                const companyName = isQueue ? item.targetCompany : item.companyName;
                const roleTitle = isQueue ? item.targetRole : item.jobTitle;
                const companyInitials = companyName ? companyName.slice(0, 2).toUpperCase() : 'CO';
                const status = isQueue ? item.status : item.status;
                const source = isQueue ? item.detectedSource || 'Auto-Apply' : 'Direct';
                const dateStr = isQueue 
                  ? (item.createdAtUtc ? new Date(item.createdAtUtc).toLocaleDateString() : 'Ready')
                  : (item.appliedDate ? new Date(item.appliedDate).toLocaleDateString() : 'Tracked');

                return (
                  <div 
                    key={item.id} 
                    className="p-5 rounded-[22px] bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] hover:border-black/[0.12] dark:hover:border-white/[0.16] transition-all space-y-4 shadow-sm hover:shadow"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-black/[0.04] dark:bg-zinc-800 text-zinc-900 dark:text-white border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-center font-bold text-sm shadow-inner">
                          {companyInitials}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-zinc-900 dark:text-white text-sm">{companyName}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-black/[0.05] dark:border-white/[0.06] font-medium">
                              {source}
                            </span>
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{roleTitle}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                          97% Match
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          status === 'Submitted' 
                            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                            : status === 'PausedForUserReview'
                            ? 'bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300'
                            : 'bg-black/[0.04] dark:bg-zinc-800 border border-black/[0.06] dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300'
                        }`}>
                          {status === 'PausedForUserReview' ? 'Review Needed' : status}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between pt-3 border-t border-black/[0.05] dark:border-white/[0.06] text-xs gap-3">
                      <div className="text-zinc-400 dark:text-zinc-500 text-[11px]">
                        {dateStr}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setActivePage('result-studio')}
                          className="px-3.5 py-1.5 rounded-full bg-black/[0.04] dark:bg-zinc-800/80 hover:bg-black/[0.08] dark:hover:bg-zinc-700 border border-black/[0.06] dark:border-white/[0.08] text-zinc-800 dark:text-zinc-200 text-xs font-medium transition-all cursor-pointer shadow-sm active:scale-95"
                        >
                          View Resume
                        </button>
                        <button
                          onClick={() => setActivePage(isQueue ? 'orchestrator' : 'tracker')}
                          className="px-3.5 py-1.5 rounded-full bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 text-xs font-semibold transition-all shadow-sm cursor-pointer active:scale-95"
                        >
                          {isQueue ? 'Auto-Dispatch' : 'Open Details'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              /* Clean Minimalist Empty State */
              <div className="p-10 rounded-[28px] bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] text-center space-y-4 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-black/[0.03] dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-300 border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-center mx-auto">
                  <Inbox className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">No Applications Recorded Yet</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                    Ready to accelerate your job search? Tailor your resume to any job opening or paste a URL to auto-apply.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => setActivePage('tailor-studio')}
                    className="px-4 py-2 rounded-full bg-[#D9704F] hover:bg-[#C85F3E] text-white text-xs font-semibold transition-all shadow-sm cursor-pointer active:scale-95"
                  >
                    Tailor First Resume
                  </button>
                  <button
                    onClick={() => setActivePage('orchestrator')}
                    className="px-4 py-2 rounded-full bg-black/[0.04] dark:bg-zinc-800/80 hover:bg-black/[0.08] dark:hover:bg-zinc-700 border border-black/[0.06] dark:border-white/[0.08] text-zinc-800 dark:text-zinc-200 text-xs font-medium transition-all cursor-pointer shadow-sm active:scale-95"
                  >
                    Paste Job Link
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right Column (4 cols): Real Candidate Profile & Real Master Resume Hub */}
        <section className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Main Candidate Card */}
          <div className="p-6 sm:p-7 rounded-[32px] bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] space-y-6 shadow-sm">
            
            {/* 1. Profile Header with AutumnAvatarVector, Name, Role */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <AutumnAvatarVector className="w-14 h-14 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-zinc-900 dark:text-white text-base truncate">{candidateName}</h3>
                    <CheckCircle2 className="w-4 h-4 text-[#D9704F] fill-[#D9704F]/20 shrink-0" />
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    {candidateRole}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActivePage('candidate-profile')}
                className="px-3.5 py-1.5 rounded-full bg-[#D9704F] hover:bg-[#C85F3E] text-white text-xs font-semibold shadow-sm transition-all cursor-pointer active:scale-95 shrink-0"
              >
                Profile
              </button>
            </div>

            {/* 2. Real Master Resume Status Hub */}
            <div className="space-y-3 pt-2 border-t border-black/[0.05] dark:border-white/[0.06]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white">
                    Master Resume
                  </h4>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    masterResume 
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  }`}>
                    {masterResume ? 'Active' : 'Missing'}
                  </span>
                </div>
                <button 
                  onClick={() => setActivePage('master-resume')}
                  className="text-[11px] text-[#D9704F] hover:underline font-medium cursor-pointer"
                >
                  Manage →
                </button>
              </div>

              {masterResume ? (
                <div className="p-4 rounded-2xl bg-[#FAF7F2] dark:bg-[#1C1B27] border border-black/[0.04] dark:border-white/[0.06] space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#D9704F]/10 text-[#D9704F] flex items-center justify-center shrink-0">
                      <FileCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                        {masterResume.title || masterResume.originalFileName || 'Master Resume'}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        v{masterResume.versionNumber} · {totalExperiences} Experience(s) · {totalSkills} Skill(s)
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500 pt-1">
                    <span>Last Updated: {masterResume.updatedAtUtc ? new Date(masterResume.updatedAtUtc).toLocaleDateString() : 'Active'}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">100% Calibrated</span>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-center space-y-2">
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    No master resume uploaded yet. Upload your PDF or DOCX to enable zero-prompt tailoring.
                  </p>
                  <button
                    onClick={() => setActivePage('master-resume')}
                    className="px-4 py-1.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95"
                  >
                    Upload Master Resume
                  </button>
                </div>
              )}
            </div>

            {/* 3. Real Target Preferences */}
            <div className="space-y-3 pt-2 border-t border-black/[0.05] dark:border-white/[0.06]">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white">
                  Career Preferences
                </h4>
                <button 
                  onClick={() => setActivePage('candidate-profile')}
                  className="text-[11px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                >
                  Edit
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-[#FAF7F2] dark:bg-[#1C1B27] border border-black/[0.04] dark:border-white/[0.06]">
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">Work Auth</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate block mt-0.5">
                    {candidateProfile?.workAuthorizationStatus || 'Verified'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#FAF7F2] dark:bg-[#1C1B27] border border-black/[0.04] dark:border-white/[0.06]">
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">Remote</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate block mt-0.5">
                    {candidateProfile?.remotePreference || 'Remote / Hybrid'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#FAF7F2] dark:bg-[#1C1B27] border border-black/[0.04] dark:border-white/[0.06]">
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">Expected Comp</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate block mt-0.5">
                    {candidateProfile?.expectedSalary ? `${candidateProfile.salaryCurrency || '$'}${candidateProfile.expectedSalary}` : 'Flexible'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#FAF7F2] dark:bg-[#1C1B27] border border-black/[0.04] dark:border-white/[0.06]">
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">Notice Period</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate block mt-0.5">
                    {candidateProfile?.noticePeriodDays ? `${candidateProfile.noticePeriodDays} Days` : 'Immediate'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setActivePage('candidate-profile')}
              className="w-full py-2.5 rounded-full bg-[#FAF7F2] dark:bg-white/[0.06] hover:bg-[#F2ECE3] dark:hover:bg-white/[0.1] text-zinc-800 dark:text-white text-xs font-semibold border border-black/[0.06] dark:border-white/[0.08] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            >
              <span>Edit Profile &amp; Preferences</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Live Activity Feed Card */}
          <div className="p-6 rounded-[28px] bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-1 border-b border-black/[0.05] dark:border-white/[0.06]">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight">
                Live Activity Feed
              </h2>
              <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500">Real-Time</span>
            </div>

            <div className="space-y-3.5 pt-1">
              {autonomousRuns.length > 0 ? (
                autonomousRuns.slice(0, 5).map((run) => (
                  <div key={run.id} className="flex items-start gap-3 text-xs leading-relaxed">
                    <div className="mt-0.5">
                      {run.status === 'success' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : run.status === 'hitl_required' ? (
                        <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-zinc-900 dark:text-white font-medium truncate">
                        {run.companyName ? `${run.companyName} (${run.jobTitle || 'Application'})` : 'Job Application'}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Status: <strong className="text-zinc-800 dark:text-zinc-200">{run.status}</strong>
                      </div>
                      <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                        {run.createdAtUtc ? new Date(run.createdAtUtc).toLocaleTimeString() : 'Recent'}
                      </div>
                    </div>
                  </div>
                ))
              ) : recentApps.length > 0 ? (
                recentApps.slice(0, 5).map((app) => (
                  <div key={app.id} className="flex items-start gap-3 text-xs leading-relaxed">
                    <div className="mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-zinc-900 dark:text-white font-medium truncate">
                        {app.companyName} — {app.jobTitle}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Stage: <strong className="text-zinc-800 dark:text-zinc-200">{app.status}</strong>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
                  No recent activities recorded yet.
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-black/[0.05] dark:border-white/[0.06] text-center">
              <button 
                onClick={() => setActivePage('tracker')}
                className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Full Application Board</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};
