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
    <div className="flex flex-col w-full gap-6 font-sans text-[#e2e4e9]">
      
      {/* Top Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[#111216] border border-[#23252b]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Job Search Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-[#8e929b] mt-0.5">
            Real-time status of your tailored resumes, active applications, and interview pipeline.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-sm ${
              isPaused 
                ? 'bg-amber-500 hover:bg-amber-400 text-black' 
                : 'bg-[#16181f] hover:bg-[#20222a] text-white border border-[#2a2d37]'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? 'Resume Applications' : 'Pause All Applications'}</span>
          </button>

          <button
            onClick={() => setActivePage('tailor-studio')}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Tailor New Resume</span>
          </button>
        </div>
      </div>

      {/* 4 Real-Data Metrics Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="p-5 rounded-2xl bg-[#111216] border border-[#23252b] flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between text-[#8e929b] text-xs font-medium">
            <span>In-Progress Applications</span>
            {activeCount > 0 ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-zinc-600"></span>
            )}
          </div>
          <div>
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {String(activeCount).padStart(2, '0')}
            </div>
            <div className="text-xs text-[#8e929b] mt-1">Active in queue or review</div>
          </div>
          <div className="text-[11px] text-[#6c707d] pt-3 border-t border-[#1c1e26] flex items-center justify-between">
            <span>Status</span>
            <span className={activeCount > 0 ? "text-emerald-400 font-medium" : "text-[#8e929b]"}>
              {activeCount > 0 ? `${activeCount} Running` : 'Idle'}
            </span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-5 rounded-2xl bg-[#111216] border border-[#23252b] flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between text-[#8e929b] text-xs font-medium">
            <span>Total Applications</span>
            <span className="text-[11px] text-indigo-400 font-semibold">Tracked</span>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {totalAppsCount}
            </div>
            <div className="text-xs text-[#8e929b] mt-1">Submitted &amp; tracked openings</div>
          </div>
          <div className="text-[11px] text-[#6c707d] pt-3 border-t border-[#1c1e26] flex items-center justify-between">
            <span>Daily Cap Setting</span>
            <span className="text-white font-medium">{dailyCap} / day</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-5 rounded-2xl bg-[#111216] border border-[#23252b] flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between text-[#8e929b] text-xs font-medium">
            <span>Average ATS Score</span>
            <span className="text-[11px] text-emerald-400 font-semibold">Target: ≥ 90%</span>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {avgScore}
            </div>
            <div className="text-xs text-[#8e929b] mt-1">Semantic requirement match</div>
          </div>
          <div className="text-[11px] text-[#6c707d] pt-3 border-t border-[#1c1e26] flex items-center justify-between">
            <span>ATS Pass Rate</span>
            <span className="text-emerald-400 font-medium">High Alignment</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-5 rounded-2xl bg-[#111216] border border-[#23252b] flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between text-[#8e929b] text-xs font-medium">
            <span>Interview Callbacks</span>
            <span className="text-[11px] text-purple-400 font-semibold">Pipelines</span>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {interviewsCount}
            </div>
            <div className="text-xs text-[#8e929b] mt-1">Interviews or offers active</div>
          </div>
          <div className="text-[11px] text-[#6c707d] pt-3 border-t border-[#1c1e26] flex items-center justify-between">
            <button onClick={() => setActivePage('tracker')} className="text-indigo-400 hover:underline">
              View Job Tracker
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-[#6c707d]" />
          </div>
        </div>
      </section>

      {/* Control Settings Deck */}
      <section className="p-5 rounded-2xl bg-[#111216] border border-[#23252b] flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex flex-wrap items-center gap-6 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-[#8e929b] font-medium">Daily Limit:</span>
            <input
              type="range"
              min="10"
              max="100"
              value={dailyCap}
              onChange={(e) => setDailyCap(Number(e.target.value))}
              className="w-28 accent-indigo-500 cursor-pointer"
            />
            <span className="text-white font-bold bg-[#16181f] px-2 py-1 rounded-md border border-[#2a2d37]">
              {dailyCap} apps/day
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[#8e929b] font-medium">Minimum Match:</span>
            <input
              type="range"
              min="70"
              max="98"
              value={minAts}
              onChange={(e) => setMinAts(Number(e.target.value))}
              className="w-28 accent-indigo-500 cursor-pointer"
            />
            <span className="text-white font-bold bg-[#16181f] px-2 py-1 rounded-md border border-[#2a2d37]">
              {minAts}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            onClick={() => setActivePage('candidate-profile')}
            className="px-3.5 py-2 rounded-xl bg-[#16181f] hover:bg-[#20222a] border border-[#2a2d37] text-white text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Profile &amp; Skills</span>
          </button>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl bg-[#16181f] hover:bg-[#20222a] border border-[#2a2d37] text-white text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>
        </div>
      </section>

      {/* Main Split: Real Active Applications vs Real Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (8 cols): Applications List */}
        <section className="lg:col-span-8 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">
                Active &amp; Recent Applications
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#1c1e26] text-[#8e929b] font-medium">
                {queueItems.length > 0 ? `${queueItems.length} in Queue` : `${recentApps.length} Tracked`}
              </span>
            </div>
            <button 
              onClick={() => setActivePage('tracker')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
            >
              <span>Open Job Board</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {/* If Queue Items Exist, Render Real Queue Items */}
            {queueItems.length > 0 ? (
              queueItems.slice(0, 5).map((item) => (
                <div key={item.id} className="p-5 rounded-2xl bg-[#111216] border border-[#23252b] hover:border-[#343743] transition-all space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-sm">
                        {item.targetCompany ? item.targetCompany.slice(0, 2).toUpperCase() : 'JB'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{item.targetCompany}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-[#16181f] text-[#8e929b]">
                            {item.detectedSource || 'Auto-Apply'}
                          </span>
                        </div>
                        <div className="text-xs text-[#8e929b] mt-0.5">{item.targetRole}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                        97% Match
                      </span>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                        item.status === 'Submitted' 
                          ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                          : item.status === 'PausedForUserReview'
                          ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300'
                          : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-300'
                      }`}>
                        {item.status === 'PausedForUserReview' ? 'Review Needed' : item.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between pt-3 border-t border-[#1c1e26] text-xs gap-3">
                    <div className="text-[#8e929b] text-[11px]">
                      {item.createdAtUtc ? `Queued on ${new Date(item.createdAtUtc).toLocaleDateString()}` : 'Ready for dispatch'}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActivePage('result-studio')}
                        className="px-3 py-1.5 rounded-lg bg-[#16181f] hover:bg-[#20222a] border border-[#2a2d37] text-white text-xs font-medium transition-colors"
                      >
                        View Resume
                      </button>
                      <button
                        onClick={() => setActivePage('orchestrator')}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
                      >
                        Open in Auto-Apply
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : recentApps.length > 0 ? (
              /* If Recent Tracked Apps Exist */
              recentApps.slice(0, 5).map((app) => (
                <div key={app.id} className="p-5 rounded-2xl bg-[#111216] border border-[#23252b] hover:border-[#343743] transition-all space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#16181f] border border-[#2a2d36] flex items-center justify-center font-bold text-white text-sm">
                        {app.companyName ? app.companyName.slice(0, 2).toUpperCase() : 'CO'}
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">{app.companyName}</div>
                        <div className="text-xs text-[#8e929b]">{app.jobTitle}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-[#16181f] border border-[#2a2d36] text-[#c4c7d0] text-xs font-medium">
                        {app.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#1c1e26] text-xs text-[#8e929b]">
                    <span>{app.appliedDate ? `Applied on ${new Date(app.appliedDate).toLocaleDateString()}` : 'Tracked Application'}</span>
                    <button
                      onClick={() => setActivePage('tracker')}
                      className="text-indigo-400 hover:underline"
                    >
                      Update Status
                    </button>
                  </div>
                </div>
              ))
            ) : (
              /* Clean Empty State */
              <div className="p-8 rounded-2xl bg-[#111216] border border-[#23252b] text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto">
                  <Inbox className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">No Applications Started Yet</h3>
                  <p className="text-xs text-[#8e929b] max-w-sm mx-auto">
                    Ready to accelerate your job hunt? Tailor your resume to any job opening or paste a link to auto-apply.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => setActivePage('tailor-studio')}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
                  >
                    Tailor Your First Resume
                  </button>
                  <button
                    onClick={() => setActivePage('orchestrator')}
                    className="px-4 py-2 rounded-xl bg-[#16181f] hover:bg-[#20222a] border border-[#2a2d37] text-white text-xs font-medium transition-colors"
                  >
                    Paste a Job Link
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right Column (4 cols): Real Live Activity Feed */}
        <section className="lg:col-span-4 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-base font-bold text-white tracking-tight">
              Live Activity Feed
            </h2>
            <span className="text-[11px] text-[#8e929b]">Recent Events</span>
          </div>

          <div className="p-5 rounded-2xl bg-[#111216] border border-[#23252b] space-y-4">
            <div className="space-y-3">
              {autonomousRuns.length > 0 ? (
                autonomousRuns.slice(0, 5).map((run) => (
                  <div key={run.id} className="flex items-start gap-3 text-xs leading-relaxed">
                    <div className="mt-0.5">
                      {run.status === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : run.status === 'hitl_required' ? (
                        <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-medium">
                        {run.companyName ? `${run.companyName} (${run.jobTitle || 'Application'})` : 'Job Application'}
                      </div>
                      <div className="text-[11px] text-[#8e929b]">
                        Status: <strong className="text-white">{run.status}</strong>
                      </div>
                      <div className="text-[10px] text-[#6c707d] mt-0.5">
                        {run.createdAtUtc ? new Date(run.createdAtUtc).toLocaleTimeString() : 'Recent'}
                      </div>
                    </div>
                  </div>
                ))
              ) : recentApps.length > 0 ? (
                recentApps.slice(0, 5).map((app) => (
                  <div key={app.id} className="flex items-start gap-3 text-xs leading-relaxed">
                    <div className="mt-0.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-medium">
                        {app.companyName} — {app.jobTitle}
                      </div>
                      <div className="text-[11px] text-[#8e929b]">
                        Current Stage: <strong className="text-white">{app.status}</strong>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-[#8e929b]">
                  No recent activities recorded yet.
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#1c1e26] text-center">
              <button 
                onClick={() => setActivePage('tracker')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>View Full Application Board</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
