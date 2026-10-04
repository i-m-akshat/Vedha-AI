import React, { useEffect, useState } from 'react';
import { 
  Sparkles, 
  UploadCloud, 
  FileCheck, 
  FileText,
  Award, 
  Briefcase, 
  ArrowUpRight, 
  TrendingUp, 
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Cpu
} from 'lucide-react';
import { 
  Card, 
  Button, 
  Badge, 
  CornerBrackets, 
  StudioCanvas3D, 
  GsapTextReveal,
  useTilt3D
} from '../components/ui';
import { analyticsApi, applicationsApi } from '../api';
import { DashboardAnalyticsDto } from '../types/shared';
import { ApplicationRecordDto, ApplicationStatus } from '../types/application';
import { ActivePage } from '../components/layout/AppLayout';
import { useResumeStore } from '../stores/useTailorStore';

// Individual Tilt Card Component for Tactile 3D Depth
const MetricTiltCard: React.FC<{
  stat: {
    index: string;
    title: string;
    value: string | number;
    change: string;
    icon: React.ReactNode;
  };
}> = ({ stat }) => {
  const tiltRef = useTilt3D<HTMLDivElement>({ maxTilt: 7, scale: 1.02 });

  return (
    <div ref={tiltRef} className="will-change-transform">
      <Card bracketed={true} className="p-5 flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-white/[0.2] transition-colors duration-200 group h-full">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-wider text-slate-400 dark:text-zinc-500">
            {stat.index} // METRIC
          </span>
          <div className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-zinc-900/90 border border-slate-200 dark:border-white/[0.08] flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
            {stat.icon}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-mono tracking-wider uppercase text-slate-500 dark:text-zinc-400 mb-1">
            {stat.title}
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {stat.value}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-white/[0.04] flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
            <span>[ ×</span>
            <span>{stat.change}</span>
            <span>]</span>
          </span>
        </div>
      </Card>
    </div>
  );
};

export const DashboardPage: React.FC<{ setActivePage: (p: ActivePage) => void }> = ({ setActivePage }) => {
  const [analytics, setAnalytics] = useState<DashboardAnalyticsDto | null>(null);
  const [recentApps, setRecentApps] = useState<ApplicationRecordDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { masterResume, fetchMasterResume } = useResumeStore();

  useEffect(() => {
    fetchMasterResume();
    Promise.allSettled([
      analyticsApi.getDashboard(),
      applicationsApi.list(),
    ]).then(([analyticsResult, appsResult]) => {
      if (analyticsResult.status === 'fulfilled') setAnalytics(analyticsResult.value);
      if (appsResult.status === 'fulfilled') setRecentApps(appsResult.value.slice(0, 5));
      if (analyticsResult.status === 'rejected' || appsResult.status === 'rejected') {
        setLoadError('Some dashboard data could not be loaded. Please refresh and try again.');
      }
      setIsLoading(false);
    });
  }, []);

  const stats = [
    {
      index: '01',
      title: 'TOTAL APPLICATIONS',
      value: analytics?.totalApplications || recentApps.length,
      change: '+12% THIS CYCLE',
      icon: <Briefcase className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />,
    },
    {
      index: '02',
      title: 'RESUMES TAILORED',
      value: analytics?.resumesGenerated || 0,
      change: 'TRUTH-PRESERVED',
      icon: <FileCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />,
    },
    {
      index: '03',
      title: 'AVERAGE ATS SCORE',
      value: analytics ? `${analytics.averageAtsScore}%` : '85%',
      change: 'TOP 5% APPLICANTS',
      icon: <TrendingUp className="w-4 h-4 text-purple-500 dark:text-purple-400" />,
    },
    {
      index: '04',
      title: 'INTERVIEWS & OFFERS',
      value: (analytics?.interviewsScheduled || 0) + (analytics?.offersReceived || 0),
      change: 'HIGH CONVERSION',
      icon: <Award className="w-4 h-4 text-amber-500 dark:text-amber-400" />,
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {loadError && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300 font-mono">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {/* Hero Studio Banner with Interactive 3D Canvas & GSAP Reveal */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 dark:border-white/[0.08] bg-white/80 dark:bg-gradient-to-b dark:from-zinc-950 dark:via-[#08080e] dark:to-zinc-950 p-6 sm:p-8 shadow-sm backdrop-blur-2xl">
        <CornerBrackets size="w-3 h-3" className="border-indigo-400/50 dark:border-indigo-400/30" />
        
        {/* Specular Glow Bar */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Text & Actions */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>
                <span>SYSTEM // 3D REAL-TIME STUDIO</span>
              </span>
              <span className="font-mono text-[10px] text-slate-400 dark:text-zinc-600 tracking-wider">
                [ EDITION 01 ]
              </span>
            </div>

            {/* GSAP Line-Masked Kinetic Title */}
            <GsapTextReveal
              text="Every tailored resume begins with precision."
              className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight"
            />

            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed max-w-xl">
              Parse any job description, extract semantic requirements, and engineer heavily-differentiated, truth-preserved resumes optimized for ATS parsers and hiring managers.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                variant="primary"
                size="lg"
                onClick={() => setActivePage('tailor-studio')}
                className="gap-2.5 shadow-lg shadow-indigo-600/20 font-semibold px-6 font-mono text-xs uppercase tracking-wider"
              >
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>LAUNCH TAILOR STUDIO</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1 opacity-70" />
              </Button>
              {!masterResume && (
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setActivePage('master-resume')}
                  className="gap-2 text-xs font-mono"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>UPLOAD MASTER RESUME</span>
                </Button>
              )}
            </div>
          </div>

          {/* Right: Interactive 3D WebGL Studio Canvas (Depth.fyi Inspired) */}
          <div className="lg:col-span-5 w-full">
            <StudioCanvas3D defaultForm="gem" className="w-full h-56 sm:h-64 shadow-2xl" />
          </div>
        </div>
      </div>

      {/* Stats Grid with 3D Tilt Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <MetricTiltCard key={i} stat={stat} />
        ))}
      </div>

      {/* Main Studio Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Master Resume Status */}
        <Card bracketed={true} className="lg:col-span-1 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/[0.08]">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="font-bold text-xs uppercase font-mono tracking-wider text-slate-900 dark:text-zinc-100">
                Master Resume Core
              </h3>
            </div>
            {masterResume ? (
              <Badge variant="tech" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/10">
                v{masterResume.versionNumber} // ACTIVE
              </Badge>
            ) : (
              <Badge variant="tech" className="text-amber-600 dark:text-amber-400 border-amber-500/20 bg-amber-500/10">
                NOT UPLOADED
              </Badge>
            )}
          </div>

          {masterResume ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-zinc-950/70 border border-slate-200/90 dark:border-white/[0.08] space-y-2">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate font-mono">
                  {masterResume.title}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-zinc-400 font-mono">
                  {masterResume.schema.experience.length} ROLES • {masterResume.schema.skills.reduce((acc, c) => acc + c.skills.length, 0)} SKILLS • {masterResume.schema.projects.length} PROJECTS
                </div>
                <div className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                  UPDATED {new Date(masterResume.createdAtUtc).toLocaleDateString()}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button variant="outline" size="sm" className="w-full text-xs font-mono" onClick={() => setActivePage('master-resume')}>
                  EDIT SCHEMA
                </Button>
                <Button variant="primary" size="sm" className="w-full text-xs font-mono" onClick={() => setActivePage('tailor-studio')}>
                  TAILOR NOW
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-zinc-900/80 border border-slate-200 dark:border-white/[0.08] flex items-center justify-center mx-auto text-slate-500 dark:text-zinc-400">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-800 dark:text-zinc-300 font-mono uppercase tracking-wider">
                  No Master Profile Found
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-500 max-w-xs mx-auto">
                  Upload your master resume in PDF, DOCX, or JSON once to activate tailoring.
                </div>
              </div>
              <Button variant="primary" size="sm" className="font-mono text-xs" onClick={() => setActivePage('master-resume')}>
                UPLOAD MASTER RESUME
              </Button>
            </div>
          )}
        </Card>

        {/* Recent Applications Activity Ledger */}
        <Card bracketed={true} className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/[0.08]">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="font-bold text-xs uppercase font-mono tracking-wider text-slate-900 dark:text-zinc-100">
                Application Ledger
              </h3>
            </div>
            <Button variant="ghost" size="sm" className="text-xs font-mono tracking-wider" onClick={() => setActivePage('tracker')}>
              OPEN TRACKER <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>

          {recentApps.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-white/[0.04]">
              {recentApps.map((app, idx) => (
                <div key={app.id} className="py-3 flex items-center justify-between group">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-600">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="font-semibold text-xs text-slate-900 dark:text-zinc-100 tracking-tight">
                        {app.jobTitle}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 pl-5">
                      {app.companyName} • {app.location || 'Remote'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="tech" className={
                      app.status === ApplicationStatus.Offered ? 'text-emerald-500 border-emerald-500/30' :
                      app.status === ApplicationStatus.Interviewing ? 'text-purple-400 border-purple-500/30' :
                      app.status === ApplicationStatus.Applied ? 'text-sky-400 border-sky-500/30' : 'text-zinc-400 border-zinc-700'
                    }>
                      {app.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-xs font-mono text-slate-500 dark:text-zinc-500">
              LEDGER IS EMPTY // TAILORED RESUMES WILL AUTOMATICALLY REGISTER HERE
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
