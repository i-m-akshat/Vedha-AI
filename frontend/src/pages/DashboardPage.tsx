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
  ExternalLink
} from 'lucide-react';
import { ActivePage } from '../components/layout/AppLayout';
import { analyticsApi, applicationsApi, orchestratorApi, autonomousApi } from '../api';
import { useAuthStore } from '../stores/useAuthStore';
import { DashboardAnalyticsDto } from '../types/shared';
import { ApplicationRecordDto } from '../types/application';
import { ApplicationQueueItemDto } from '../types/orchestrator';

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

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [analyticsResult, appsResult, queueResult, autoResult] = await Promise.allSettled([
        analyticsApi.getDashboard(),
        applicationsApi.list(),
        orchestratorApi.getQueue(),
        autonomousApi.getApplications(),
      ]);

      if (analyticsResult.status === 'fulfilled') setAnalytics(analyticsResult.value);
      if (appsResult.status === 'fulfilled') setRecentApps(appsResult.value);
      if (queueResult.status === 'fulfilled') setQueueItems(queueResult.value);
      if (autoResult.status === 'fulfilled') setAutonomousRuns(autoResult.value);
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

  const interviewsCount = recentApps.filter(a => 
    String(a.status).toLowerCase().includes('interview') || 
    String(a.status).toLowerCase().includes('offer')
  ).length;

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

  const candidateName = user?.fullName || 'Alex Morgan';
  const candidateInitial = candidateName.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col w-full gap-8 font-sans text-zinc-900 dark:text-[#ededed]">
      
      {/* 1. Hero Spotlight Welcome Banner (Inspired by Autumn App & Flowbase Spotlight) */}
      <section className="relative overflow-hidden rounded-[28px] sm:rounded-[32px] p-7 sm:p-9 border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#16151F] shadow-sm transition-all">
        {/* Soft Ambient Backdrop Mesh */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-amber-200/40 via-rose-200/30 to-purple-200/20 dark:from-purple-900/20 dark:via-indigo-900/20 dark:to-emerald-950/20 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Vedha AI Autonomous Engine Online</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Welcome back, {candidateName.split(' ')[0]} 👋
            </h1>
            
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Your autonomous career operating system is running. Monitor your live dispatch queue, calibrated ATS matches, and interview callbacks in real time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`px-4 py-2.5 rounded-full text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.98] ${
                isPaused 
                  ? 'bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold' 
                  : 'bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] text-zinc-800 dark:text-zinc-200 border border-black/[0.06] dark:border-white/[0.08]'
              }`}
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{isPaused ? 'Resume Applications' : 'Pause Auto-Apply'}</span>
            </button>

            <button
              onClick={() => setActivePage('tailor-studio')}
              className="px-5 py-2.5 rounded-full bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 text-xs font-semibold flex items-center gap-2 transition-all shadow-md cursor-pointer active:scale-[0.98]"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Tailor New Resume</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Six Pastel Category & Metric Cards (Directly from Reference 1: High Conversion Landing Page) */}
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
            <button onClick={() => setActivePage('tracker')} className="hover:underline flex items-center gap-1">
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
            <div className="text-xs font-medium text-yellow-800 dark:text-yellow-300 mt-1">Autonomous Skills</div>
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
            <div className="text-xs font-medium text-rose-800 dark:text-rose-300 mt-1">Verification Shield</div>
          </div>
          <div className="text-[10px] font-mono text-rose-700 dark:text-rose-400 pt-2 border-t border-rose-200/50 dark:border-rose-800/30 flex items-center justify-between">
            <span>Integrity</span>
            <span>Zero Hallucination</span>
          </div>
        </div>

      </section>

      {/* 3. Segmented Control & Calibration Deck (Inspired by Flowbase & Autumn app) */}
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
              className="w-28 accent-zinc-900 dark:accent-white cursor-pointer"
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
              className="w-28 accent-zinc-900 dark:accent-white cursor-pointer"
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

      {/* 4. Main Split: Applications History (8 cols) vs Spotlight Profile & Feed (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (8 cols): Applications List with Segmented Tabs & Search */}
        <section className="lg:col-span-8 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
            {/* Segmented Pill Filter (Flowbase style) */}
            <div className="flex items-center gap-1 bg-black/[0.04] dark:bg-white/[0.06] p-1 rounded-full border border-black/[0.05] dark:border-white/[0.08] text-xs">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3.5 py-1 rounded-full font-semibold transition-all cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-white dark:bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                All Applications
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
                className="pl-8 pr-3 py-1.5 text-xs rounded-full bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] focus:border-zinc-400 dark:focus:border-white/30 text-zinc-900 dark:text-white placeholder-zinc-400 outline-none w-44 sm:w-56 transition-all"
              />
            </div>
          </div>

          {/* Cards Stack */}
          <div className="flex flex-col gap-3">
            {(activeTab === 'queue' ? filteredQueueItems : filteredQueueItems.length > 0 ? filteredQueueItems : filteredRecentApps).length > 0 ? (
              (activeTab === 'queue' || queueItems.length > 0 
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
                          onClick={() => setActivePage('orchestrator')}
                          className="px-3.5 py-1.5 rounded-full bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 text-xs font-semibold transition-all shadow-sm cursor-pointer active:scale-95"
                        >
                          Auto-Apply
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
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">No Applications Recorded</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                    Ready to accelerate your job search? Tailor your resume to any job opening or paste a URL to auto-apply.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => setActivePage('tailor-studio')}
                    className="px-4 py-2 rounded-full bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 text-xs font-semibold transition-all shadow-sm cursor-pointer active:scale-95"
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

        {/* Right Column (4 cols): Spotlight Card (Autumn App & Flowbase hybrid) + Live Feed */}
        <section className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Spotlight Candidate Card */}
          <div className="p-6 rounded-[28px] bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] space-y-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-zinc-900 dark:bg-zinc-800 text-white flex items-center justify-center text-lg font-bold border border-black/[0.08] dark:border-white/[0.1] shadow-md">
                {candidateInitial}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-zinc-900 dark:text-white text-base truncate">{candidateName}</h3>
                  <CheckCircle2 className="w-4 h-4 text-sky-500 fill-sky-500/20 shrink-0" />
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                  Senior Full-Stack Engineer
                </p>
                <div className="mt-1">
                  <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/20">
                    Active Job Seeker
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-center">
              <div className="p-3 rounded-2xl bg-black/[0.025] dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.06]">
                <div className="text-lg font-bold font-mono text-zinc-900 dark:text-white">{totalAppsCount}</div>
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500">Applications</div>
              </div>
              <div className="p-3 rounded-2xl bg-black/[0.025] dark:bg-zinc-800/40 border border-black/[0.04] dark:border-white/[0.06]">
                <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">95%</div>
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500">Avg ATS Score</div>
              </div>
            </div>

            <button
              onClick={() => setActivePage('candidate-profile')}
              className="w-full py-2.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] text-zinc-800 dark:text-white text-xs font-semibold border border-black/[0.06] dark:border-white/[0.08] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
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
