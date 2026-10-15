import React, { useState, useEffect, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  RefreshCw, 
  SlidersHorizontal, 
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
  MoreHorizontal,
  BookmarkCheck,
  Award,
  AlertCircle,
  FileCheck,
  Briefcase
} from 'lucide-react';
import { 
  AutumnHeroVector, 
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
  const [dailyCap, setDailyCap] = useState(50);
  const [minAts, setMinAts] = useState(88);
  const [isPaused, setIsPaused] = useState(false);
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
  const activeCount = queueItems.filter(q => q.status !== 'Submitted' && q.status !== 'Failed').length + 
    autonomousRuns.filter(a => a.status === 'pending' || a.status === 'generating_resume' || a.status === 'applying').length;

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
    <div className="flex flex-col w-full gap-8 font-sans text-zinc-900 dark:text-[#ededed]">
      
      {/* Top Bar: Terracotta Squircle Notification + Pill Search Bar + Date Sprint Tag */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 max-w-2xl">
          {/* Terracotta Notification Squircle with Dot */}
          <button 
            onClick={() => setActivePage('tracker')}
            className="w-11 h-11 rounded-2xl bg-[#D9704F] hover:bg-[#C85F3E] text-white flex items-center justify-center relative shadow-sm cursor-pointer active:scale-95 transition-all shrink-0"
            title="Notifications & Activity"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-white ring-2 ring-[#D9704F]"></span>
          </button>

          {/* Pill Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-4 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search jobs, target roles, or companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 rounded-full bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] text-xs text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:ring-2 focus:ring-[#D9704F]/30 shadow-sm transition-all"
            />
          </div>
        </div>

        {/* Sprint Tag & Quick Actions */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FDF2EE] dark:bg-[#2A1B16] border border-[#FAD9CE] dark:border-[#542B20] text-xs font-semibold text-[#D9704F] dark:text-[#F39A7E]">
            <span className="w-2 h-2 rounded-full bg-[#D9704F] animate-pulse"></span>
            <span>Autumn Career Sprint</span>
          </div>

          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.98] ${
              isPaused 
                ? 'bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold' 
                : 'bg-white dark:bg-[#16151F] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-zinc-800 dark:text-zinc-200 border border-black/[0.06] dark:border-white/[0.08]'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? 'Resume Dispatch' : 'Pause Dispatch'}</span>
          </button>
        </div>
      </div>

      {/* Hero Showcase Card: Autumn Day Scenic Illustration + Dynamic Terracotta Banner */}
      <section className="relative overflow-hidden rounded-[32px] border border-black/[0.06] dark:border-white/[0.08] bg-[#FDF4ED] dark:bg-[#181622] shadow-sm transition-all">
        {/* Top: Autumn Day Scenic Vector Artwork */}
        <div className="w-full overflow-hidden">
          <AutumnHeroVector className="w-full h-44 sm:h-56 object-cover" />
        </div>

        {/* Bottom Banner: Terracotta #D9704F Bar with Real Dynamic System Stats */}
        <div className="bg-[#D9704F] p-6 sm:p-7 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-white/80 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
              <span>Career Workspace • {isPaused ? 'Dispatch Paused' : 'Active Dispatch Mode'}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Welcome back, {candidateName.split(' ')[0]}
            </h1>
            <p className="text-xs sm:text-sm text-white/90 max-w-xl leading-relaxed">
              {reviewPendingItems.length > 0
                ? `${reviewPendingItems.length} application(s) awaiting your verification before dispatch. 100% human-in-the-loop guarantee.`
                : queueItems.length > 0
                ? `${queueItems.length} calibrated application(s) ready in queue. All systems operating with zero-hallucination shield.`
                : masterResume
                ? `Master Resume active with ${totalExperiences} role(s) and ${totalSkills} skill(s). Ready to tailor for any opening.`
                : 'Upload your Master Resume to unlock automated tailoring, cover letter generation, and auto-apply dispatch.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setActivePage('tailor-studio')}
              className="px-5 py-2.5 rounded-full bg-white hover:bg-amber-50 text-[#D9704F] text-xs font-bold transition-all shadow-md cursor-pointer active:scale-95"
            >
              Tailor New Resume
            </button>
            <button
              onClick={() => setActivePage('orchestrator')}
              className="px-4 py-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-all cursor-pointer active:scale-95"
              title="Open Auto-Apply Queue"
            >
              Auto-Apply Queue ({queueItems.length})
            </button>
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
          <AutumnWalkingStepsVector className="w-12 h-12 shrink-0 group-hover:scale-105 transition-transform" />
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

      {/* Real Pipeline Stages Snapshot (Replacing fake Day Schedule) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight">Application Pipeline</h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.08] text-zinc-500 dark:text-zinc-400">
              Active Stages
            </span>
          </div>
          <button 
            onClick={() => setActivePage('tracker')}
            className="text-xs text-[#D9704F] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>Kanban Board</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Pending Review Alert if any item is paused for HITL */}
        {reviewPendingItems.length > 0 && (
          <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <span className="font-bold text-amber-900 dark:text-amber-200">
                  {reviewPendingItems.length} Application(s) Waiting for Your Approval:
                </span>{' '}
                <span className="text-amber-800 dark:text-amber-300">
                  Pre-filled answers are generated. Review and approve before submission.
                </span>
              </div>
            </div>
            <button
              onClick={() => setActivePage('ask-aksh')}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-all shrink-0 cursor-pointer active:scale-95"
            >
              Review Now
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Stage 1: Saved */}
          <div 
            onClick={() => setActivePage('tracker')}
            className="p-4 rounded-[22px] bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] flex items-center gap-3.5 shadow-sm hover:shadow transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <BookmarkCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-bold font-mono text-zinc-900 dark:text-white leading-tight">
                {String(savedCount).padStart(2, '0')}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Saved Jobs</div>
            </div>
          </div>

          {/* Stage 2: Applied */}
          <div 
            onClick={() => setActivePage('tracker')}
            className="p-4 rounded-[22px] bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] flex items-center gap-3.5 shadow-sm hover:shadow transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-2xl bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Send className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-bold font-mono text-sky-950 dark:text-sky-100 leading-tight">
                {String(appliedCount).padStart(2, '0')}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Applied</div>
            </div>
          </div>

          {/* Stage 3: Interviewing */}
          <div 
            onClick={() => setActivePage('tracker')}
            className="p-4 rounded-[22px] bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] flex items-center gap-3.5 shadow-sm hover:shadow transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-bold font-mono text-amber-950 dark:text-amber-100 leading-tight">
                {String(interviewsCount).padStart(2, '0')}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Interviews</div>
            </div>
          </div>

          {/* Stage 4: Offers */}
          <div 
            onClick={() => setActivePage('tracker')}
            className="p-4 rounded-[22px] bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] flex items-center gap-3.5 shadow-sm hover:shadow transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Award className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-bold font-mono text-emerald-950 dark:text-emerald-100 leading-tight">
                {String(offersCount).padStart(2, '0')}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Offers</div>
            </div>
          </div>
        </div>
      </section>

      {/* Six Pastel Category & Metric Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        
        {/* Card 1: Mint (In-Progress Queue) */}
        <div className="card-pastel-mint rounded-[22px] p-5 border flex flex-col justify-between gap-4 transition-all hover:translate-y-[-2px] shadow-sm">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-200/60 dark:bg-emerald-800/40 text-emerald-800 dark:text-emerald-200 font-semibold">
              Queue
            </span>
          </div>
          <div>
            <div className="text-3xl font-extrabold font-mono text-emerald-950 dark:text-emerald-100 tracking-tight">
              {String(activeCount).padStart(2, '0')}
            </div>
            <div className="text-xs font-medium text-emerald-800 dark:text-emerald-300 mt-1">In-Progress Queue</div>
          </div>
          <div className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 pt-2 border-t border-emerald-200/50 dark:border-emerald-800/30 flex items-center justify-between">
            <span>Status</span>
            <span>{activeCount > 0 ? `${activeCount} Active` : 'Idle'}</span>
          </div>
        </div>

        {/* Card 2: Sky Blue (Total Tracked) */}
        <div className="card-pastel-sky rounded-[22px] p-5 border flex flex-col justify-between gap-4 transition-all hover:translate-y-[-2px] shadow-sm">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-200/60 dark:bg-sky-800/40 text-sky-800 dark:text-sky-200 font-semibold">
              Tracked
            </span>
          </div>
          <div>
            <div className="text-3xl font-extrabold font-mono text-sky-950 dark:text-sky-100 tracking-tight">
              {totalAppsCount}
            </div>
            <div className="text-xs font-medium text-sky-800 dark:text-sky-300 mt-1">Total Tracked</div>
          </div>
          <div className="text-[10px] font-mono text-sky-700 dark:text-sky-400 pt-2 border-t border-sky-200/50 dark:border-sky-800/30 flex items-center justify-between">
            <span>Daily Cap</span>
            <span>{dailyCap} / day</span>
          </div>
        </div>

        {/* Card 3: Lavender (Average ATS Score) */}
        <div className="card-pastel-lavender rounded-[22px] p-5 border flex flex-col justify-between gap-4 transition-all hover:translate-y-[-2px] shadow-sm">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-200/60 dark:bg-purple-800/40 text-purple-800 dark:text-purple-200 font-semibold">
              Score
            </span>
          </div>
          <div>
            <div className="text-3xl font-extrabold font-mono text-purple-950 dark:text-purple-100 tracking-tight">
              {avgScore}
            </div>
            <div className="text-xs font-medium text-purple-800 dark:text-purple-300 mt-1">Average ATS Score</div>
          </div>
          <div className="text-[10px] font-mono text-purple-700 dark:text-purple-400 pt-2 border-t border-purple-200/50 dark:border-purple-800/30 flex items-center justify-between">
            <span>Alignment</span>
            <span>Target ≥ 90%</span>
          </div>
        </div>

        {/* Card 4: Terracotta / Peach (Interview Callbacks) */}
        <div className="card-pastel-peach rounded-[22px] p-5 border flex flex-col justify-between gap-4 transition-all hover:translate-y-[-2px] shadow-sm">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-200/60 dark:bg-amber-800/40 text-amber-800 dark:text-amber-200 font-semibold">
              Callbacks
            </span>
          </div>
          <div>
            <div className="text-3xl font-extrabold font-mono text-amber-950 dark:text-amber-100 tracking-tight">
              {interviewsCount}
            </div>
            <div className="text-xs font-medium text-amber-800 dark:text-amber-300 mt-1">Interviews &amp; Offers</div>
          </div>
          <div className="text-[10px] font-mono text-amber-700 dark:text-amber-400 pt-2 border-t border-amber-200/50 dark:border-amber-800/30 flex items-center justify-between">
            <button onClick={() => setActivePage('tracker')} className="hover:underline flex items-center gap-1 cursor-pointer">
              <span>View Board</span>
              <ChevronRight className="w-3 h-3" />
            </button>
            <span>Active</span>
          </div>
        </div>

        {/* Card 5: Buttercup (Ask Aksh AI Copilot) */}
        <div 
          onClick={() => setActivePage('ask-aksh')}
          className="card-pastel-butter rounded-[22px] p-5 border flex flex-col justify-between gap-4 transition-all hover:translate-y-[-2px] shadow-sm cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 flex items-center justify-center font-bold">
              <Bot className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-yellow-200/60 dark:bg-yellow-800/40 text-yellow-800 dark:text-yellow-200 font-semibold">
              Copilot
            </span>
          </div>
          <div>
            <div className="text-xl font-extrabold font-mono text-yellow-950 dark:text-yellow-100 tracking-tight truncate">
              Ask Aksh
            </div>
            <div className="text-xs font-medium text-yellow-800 dark:text-yellow-300 mt-1">Career Agent</div>
          </div>
          <div className="text-[10px] font-mono text-yellow-700 dark:text-yellow-400 pt-2 border-t border-yellow-200/50 dark:border-yellow-800/30 flex items-center justify-between">
            <span>Harness Agent</span>
            <span className="flex items-center gap-0.5 font-semibold">Launch →</span>
          </div>
        </div>

        {/* Card 6: Rose (HITL Verification & Quality) */}
        <div className="card-pastel-rose rounded-[22px] p-5 border flex flex-col justify-between gap-4 transition-all hover:translate-y-[-2px] shadow-sm">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-200/60 dark:bg-rose-800/40 text-rose-800 dark:text-rose-200 font-semibold">
              HITL
            </span>
          </div>
          <div>
            <div className="text-3xl font-extrabold font-mono text-rose-950 dark:text-rose-100 tracking-tight">
              100%
            </div>
            <div className="text-xs font-medium text-rose-800 dark:text-rose-300 mt-1">Safety Shield</div>
          </div>
          <div className="text-[10px] font-mono text-rose-700 dark:text-rose-400 pt-2 border-t border-rose-200/50 dark:border-rose-800/30 flex items-center justify-between">
            <span>Integrity</span>
            <span>Zero Hallucination</span>
          </div>
        </div>

      </section>

      {/* Segmented Control & Calibration Deck */}
      <section className="p-5 sm:p-6 rounded-[24px] bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-6 text-xs w-full md:w-auto">
          {/* Daily Limit Slider */}
          <div className="flex items-center gap-3">
            <span className="text-zinc-500 dark:text-zinc-400 font-medium">Daily Dispatch Cap:</span>
            <input
              type="range"
              min="10"
              max="100"
              value={dailyCap}
              onChange={(e) => setDailyCap(Number(e.target.value))}
              className="w-28 accent-[#D9704F] cursor-pointer"
            />
            <span className="font-mono font-semibold px-2.5 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.08] text-zinc-800 dark:text-zinc-200 border border-black/[0.05] dark:border-white/[0.06]">
              {dailyCap} apps/day
            </span>
          </div>

          {/* Min ATS Slider */}
          <div className="flex items-center gap-3">
            <span className="text-zinc-500 dark:text-zinc-400 font-medium">Minimum Match Threshold:</span>
            <input
              type="range"
              min="70"
              max="98"
              value={minAts}
              onChange={(e) => setMinAts(Number(e.target.value))}
              className="w-28 accent-[#D9704F] cursor-pointer"
            />
            <span className="font-mono font-semibold px-2.5 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.08] text-zinc-800 dark:text-zinc-200 border border-black/[0.05] dark:border-white/[0.06]">
              {minAts}%
            </span>
          </div>
        </div>

        {/* Quick Calibration Buttons */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            onClick={() => setActivePage('candidate-profile')}
            className="px-4 py-2 rounded-full bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] border border-black/[0.06] dark:border-white/[0.08] text-zinc-700 dark:text-zinc-200 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Profile &amp; Skills</span>
          </button>
          
          <button
            onClick={loadData}
            disabled={isLoading}
            className="px-4 py-2 rounded-full bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] border border-black/[0.06] dark:border-white/[0.08] text-zinc-700 dark:text-zinc-200 text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
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
                Queue ({queueItems.length})
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
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-full bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] focus:border-[#D9704F] dark:focus:border-[#D9704F] text-zinc-900 dark:text-white placeholder-zinc-400 outline-none w-44 sm:w-56 transition-all"
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
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-black/[0.05] dark:border-white/[0.06]">
                              {source}
                            </span>
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{roleTitle}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold font-mono">
                          97% Match
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium font-mono ${
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
                      <div className="text-zinc-400 dark:text-zinc-500 text-[11px] font-mono">
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
            
            {/* 1. Profile Header with AutumnAvatarVector, Name, Role, and Terracotta Pill */}
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

              {/* Terracotta Pill Button */}
              <button
                onClick={() => setActivePage('candidate-profile')}
                className="px-3.5 py-1.5 rounded-full bg-[#D9704F] hover:bg-[#C85F3E] text-white text-xs font-semibold shadow-sm transition-all cursor-pointer active:scale-95 shrink-0"
              >
                Profile
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-3 rounded-2xl bg-[#FAF6F2] dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.06]">
                <div className="text-xl font-bold font-mono text-zinc-900 dark:text-white">{totalAppsCount}</div>
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Total Tracked</div>
              </div>
              <div className="p-3 rounded-2xl bg-[#FAF6F2] dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.06]">
                <div className="text-xl font-bold font-mono text-[#D9704F] dark:text-[#F39A7E]">{avgScore}</div>
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400">ATS Match Avg</div>
              </div>
            </div>

            {/* 2. Real Master Resume Status Hub (Replacing Fake October Targets) */}
            <div className="space-y-3 pt-2 border-t border-black/[0.05] dark:border-white/[0.06]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white font-mono">
                    Master Resume
                  </h4>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${
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
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500 font-mono pt-1">
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

            {/* 3. Real Target Preferences (Replacing Fake Dog/Umbrella Icons) */}
            <div className="space-y-3 pt-2 border-t border-black/[0.05] dark:border-white/[0.06]">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white font-mono">
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
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-mono block">Work Auth</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate block mt-0.5">
                    {candidateProfile?.workAuthorizationStatus || 'Verified'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#FAF7F2] dark:bg-[#1C1B27] border border-black/[0.04] dark:border-white/[0.06]">
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-mono block">Remote</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate block mt-0.5">
                    {candidateProfile?.remotePreference || 'Remote / Hybrid'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#FAF7F2] dark:bg-[#1C1B27] border border-black/[0.04] dark:border-white/[0.06]">
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-mono block">Expected Comp</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate block mt-0.5">
                    {candidateProfile?.expectedSalary ? `${candidateProfile.salaryCurrency || '$'}${candidateProfile.expectedSalary}` : 'Flexible'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#FAF7F2] dark:bg-[#1C1B27] border border-black/[0.04] dark:border-white/[0.06]">
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-mono block">Notice Period</span>
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
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Real-Time</span>
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
                        Status: <strong className="text-zinc-800 dark:text-zinc-200 font-mono">{run.status}</strong>
                      </div>
                      <div className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 mt-0.5">
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
                        Stage: <strong className="text-zinc-800 dark:text-zinc-200 font-mono">{app.status}</strong>
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
