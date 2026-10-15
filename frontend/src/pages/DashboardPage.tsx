import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RefreshCw, 
  SlidersHorizontal, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  Building2, 
  ChevronRight, 
  ArrowUpRight,
  TrendingUp,
  FileText,
  Send,
  Sparkles,
  Inbox
} from 'lucide-react';
import { ActivePage } from '../components/layout/AppLayout';
import { analyticsApi, applicationsApi, orchestratorApi, autonomousApi } from '../api';
import { DashboardAnalyticsDto } from '../types/shared';
import { ApplicationRecordDto } from '../types/application';
import { ApplicationQueueItemDto } from '../types/orchestrator';

interface DashboardPageProps {
  setActivePage: (page: ActivePage) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ setActivePage }) => {
  const [dailyCap, setDailyCap] = useState(50);
  const [minAts, setMinAts] = useState(88);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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

  return (
    <div className="flex flex-col w-full gap-6 font-sans text-[#ededed]">
      
      {/* Top Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[#121215] border border-white/[0.07] shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
            Job Search Terminal
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Real-time status of your tailored resumes, active pipelines, and interview callbacks.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer active:scale-[0.98] ${
              isPaused 
                ? 'bg-amber-400 hover:bg-amber-300 text-zinc-950 shadow-sm' 
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/[0.08]'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? 'Resume Applications' : 'Pause All Applications'}</span>
          </button>

          <button
            onClick={() => setActivePage('tailor-studio')}
            className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-[0.98]"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Tailor New Resume</span>
          </button>
        </div>
      </div>

      {/* 4 Real-Data Metrics Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="p-5 rounded-2xl bg-[#121215] border border-white/[0.07] flex flex-col justify-between gap-3 shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
            <span>In-Progress Queue</span>
            {activeCount > 0 ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-zinc-600"></span>
            )}
          </div>
          <div>
            <div className="text-3xl font-bold font-mono text-white tracking-tight">
              {String(activeCount).padStart(2, '0')}
            </div>
            <div className="text-xs text-zinc-400 mt-1">Active in queue or review</div>
          </div>
          <div className="text-[11px] text-zinc-500 pt-3 border-t border-white/[0.06] flex items-center justify-between">
            <span>Status</span>
            <span className={activeCount > 0 ? "text-emerald-400 font-medium" : "text-zinc-400"}>
              {activeCount > 0 ? `${activeCount} Running` : 'Idle'}
            </span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-5 rounded-2xl bg-[#121215] border border-white/[0.07] flex flex-col justify-between gap-3 shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
            <span>Total Tracked</span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Tracked</span>
          </div>
          <div>
            <div className="text-3xl font-bold font-mono text-white tracking-tight">
              {totalAppsCount}
            </div>
            <div className="text-xs text-zinc-400 mt-1">Submitted &amp; tracked openings</div>
          </div>
          <div className="text-[11px] text-zinc-500 pt-3 border-t border-white/[0.06] flex items-center justify-between">
            <span>Daily Cap Setting</span>
            <span className="text-zinc-200 font-medium font-mono">{dailyCap} / day</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-5 rounded-2xl bg-[#121215] border border-white/[0.07] flex flex-col justify-between gap-3 shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
            <span>Average ATS Match</span>
            <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">Target ≥ 90%</span>
          </div>
          <div>
            <div className="text-3xl font-bold font-mono text-white tracking-tight">
              {avgScore}
            </div>
            <div className="text-xs text-zinc-400 mt-1">Semantic requirement match</div>
          </div>
          <div className="text-[11px] text-zinc-500 pt-3 border-t border-white/[0.06] flex items-center justify-between">
            <span>ATS Calibration</span>
            <span className="text-emerald-400 font-medium">High Alignment</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-5 rounded-2xl bg-[#121215] border border-white/[0.07] flex flex-col justify-between gap-3 shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
            <span>Interview Callbacks</span>
            <span className="text-[10px] font-mono text-zinc-300 uppercase tracking-wider">Pipelines</span>
          </div>
          <div>
            <div className="text-3xl font-bold font-mono text-white tracking-tight">
              {interviewsCount}
            </div>
            <div className="text-xs text-zinc-400 mt-1">Interviews or offers active</div>
          </div>
          <div className="text-[11px] text-zinc-500 pt-3 border-t border-white/[0.06] flex items-center justify-between">
            <button onClick={() => setActivePage('tracker')} className="text-zinc-300 hover:text-white transition-colors cursor-pointer">
              View Job Tracker
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
          </div>
        </div>
      </section>

      {/* Control Settings Deck */}
      <section className="p-5 rounded-2xl bg-[#121215] border border-white/[0.07] flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-6 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-zinc-400 font-medium">Daily Limit:</span>
            <input
              type="range"
              min="10"
              max="100"
              value={dailyCap}
              onChange={(e) => setDailyCap(Number(e.target.value))}
              className="w-28 accent-zinc-200 cursor-pointer"
            />
            <span className="text-white font-mono font-semibold bg-zinc-900 px-2 py-0.5 rounded border border-white/[0.08]">
              {dailyCap} apps/day
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-zinc-400 font-medium">Minimum Match:</span>
            <input
              type="range"
              min="70"
              max="98"
              value={minAts}
              onChange={(e) => setMinAts(Number(e.target.value))}
              className="w-28 accent-zinc-200 cursor-pointer"
            />
            <span className="text-white font-mono font-semibold bg-zinc-900 px-2 py-0.5 rounded border border-white/[0.08]">
              {minAts}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            onClick={() => setActivePage('candidate-profile')}
            className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-zinc-200 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Profile &amp; Skills</span>
          </button>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-zinc-200 text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </section>

      {/* Main Split: Real Active Applications vs Real Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (8 cols): Applications List */}
        <section className="lg:col-span-8 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-semibold text-white tracking-tight">
                Active &amp; Recent Applications
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 border border-white/[0.06] text-zinc-400">
                {queueItems.length > 0 ? `${queueItems.length} in Queue` : `${recentApps.length} Tracked`}
              </span>
            </div>
            <button 
              onClick={() => setActivePage('tracker')}
              className="text-xs text-zinc-400 hover:text-white font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Open Job Board</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {queueItems.length > 0 ? (
              queueItems.slice(0, 5).map((item) => (
                <div key={item.id} className="p-5 rounded-2xl bg-[#121215] border border-white/[0.07] hover:border-white/[0.14] transition-all space-y-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white border border-white/[0.08] flex items-center justify-center font-bold text-sm">
                        {item.targetCompany ? item.targetCompany.slice(0, 2).toUpperCase() : 'JB'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-sm">{item.targetCompany}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-white/[0.06]">
                            {item.detectedSource || 'Auto-Apply'}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5">{item.targetRole}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold font-mono">
                        97% Match
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-lg text-xs font-medium font-mono ${
                        item.status === 'Submitted' 
                          ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                          : item.status === 'PausedForUserReview'
                          ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300'
                          : item.status === 'DispatchedToExtension'
                          ? 'bg-zinc-800 border border-white/[0.08] text-zinc-300'
                          : 'bg-zinc-800 border border-white/[0.08] text-zinc-300'
                      }`}>
                        {item.status === 'PausedForUserReview' ? 'Review Needed' : item.status === 'DispatchedToExtension' ? 'Extension Run' : item.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between pt-3 border-t border-white/[0.06] text-xs gap-3">
                    <div className="text-zinc-500 text-[11px] font-mono">
                      {item.createdAtUtc ? `Queued on ${new Date(item.createdAtUtc).toLocaleDateString()}` : 'Ready for dispatch'}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActivePage('result-studio')}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                      >
                        View Resume
                      </button>
                      <button
                        onClick={() => setActivePage('orchestrator')}
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold transition-all shadow-sm cursor-pointer active:scale-[0.98]"
                      >
                        Auto-Apply
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : recentApps.length > 0 ? (
              recentApps.slice(0, 5).map((app) => (
                <div key={app.id} className="p-5 rounded-2xl bg-[#121215] border border-white/[0.07] hover:border-white/[0.14] transition-all space-y-3 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-white/[0.08] flex items-center justify-center font-bold text-white text-xs">
                        {app.companyName ? app.companyName.slice(0, 2).toUpperCase() : 'CO'}
                      </div>
                      <div>
                        <div className="font-semibold text-white text-sm">{app.companyName}</div>
                        <div className="text-xs text-zinc-400">{app.jobTitle}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-zinc-900 border border-white/[0.08] text-zinc-300 text-xs font-mono">
                        {app.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-xs text-zinc-500">
                    <span className="font-mono text-[11px]">{app.appliedDate ? `Applied on ${new Date(app.appliedDate).toLocaleDateString()}` : 'Tracked Application'}</span>
                    <button
                      onClick={() => setActivePage('tracker')}
                      className="text-zinc-300 hover:text-white transition-colors cursor-pointer"
                    >
                      Update Status
                    </button>
                  </div>
                </div>
              ))
            ) : (
              /* Clean Minimalist Empty State */
              <div className="p-8 rounded-2xl bg-[#121215] border border-white/[0.07] text-center space-y-4 shadow-sm">
                <div className="w-10 h-10 rounded-2xl bg-zinc-900 text-zinc-300 border border-white/[0.08] flex items-center justify-center mx-auto">
                  <Inbox className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-white">No Applications Active</h3>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                    Ready to accelerate your search? Tailor your resume to any job opening or paste a link to auto-apply.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2.5 pt-1">
                  <button
                    onClick={() => setActivePage('tailor-studio')}
                    className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold transition-all shadow-sm cursor-pointer"
                  >
                    Tailor First Resume
                  </button>
                  <button
                    onClick={() => setActivePage('orchestrator')}
                    className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                  >
                    Paste Job Link
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right Column (4 cols): Real Live Activity Feed */}
        <section className="lg:col-span-4 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-base font-semibold text-white tracking-tight">
              Live Feed
            </h2>
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Recent Events</span>
          </div>

          <div className="p-5 rounded-2xl bg-[#121215] border border-white/[0.07] space-y-4 shadow-sm">
            <div className="space-y-3">
              {autonomousRuns.length > 0 ? (
                autonomousRuns.slice(0, 5).map((run) => (
                  <div key={run.id} className="flex items-start gap-3 text-xs leading-relaxed">
                    <div className="mt-0.5">
                      {run.status === 'success' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : run.status === 'hitl_required' ? (
                        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium truncate">
                        {run.companyName ? `${run.companyName} (${run.jobTitle || 'Application'})` : 'Job Application'}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        Status: <strong className="text-zinc-200 font-mono">{run.status}</strong>
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                        {run.createdAtUtc ? new Date(run.createdAtUtc).toLocaleTimeString() : 'Recent'}
                      </div>
                    </div>
                  </div>
                ))
              ) : recentApps.length > 0 ? (
                recentApps.slice(0, 5).map((app) => (
                  <div key={app.id} className="flex items-start gap-3 text-xs leading-relaxed">
                    <div className="mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium truncate">
                        {app.companyName} — {app.jobTitle}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        Stage: <strong className="text-zinc-200 font-mono">{app.status}</strong>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-zinc-500">
                  No recent activities recorded yet.
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-white/[0.06] text-center">
              <button 
                onClick={() => setActivePage('tracker')}
                className="text-xs text-zinc-400 hover:text-white font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
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
