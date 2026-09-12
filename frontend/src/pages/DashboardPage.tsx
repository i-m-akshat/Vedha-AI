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
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { Card, Button, Badge } from '../components/ui';
import { analyticsApi, applicationsApi } from '../api';
import { DashboardAnalyticsDto } from '../types/shared';
import { ApplicationRecordDto, ApplicationStatus } from '../types/application';
import { ActivePage } from '../components/layout/AppLayout';
import { useResumeStore } from '../stores/useTailorStore';

export const DashboardPage: React.FC<{ setActivePage: (p: ActivePage) => void }> = ({ setActivePage }) => {
  const [analytics, setAnalytics] = useState<DashboardAnalyticsDto | null>(null);
  const [recentApps, setRecentApps] = useState<ApplicationRecordDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { masterResume, fetchMasterResume } = useResumeStore();

  useEffect(() => {
    fetchMasterResume();
    Promise.all([
      analyticsApi.getDashboard().catch(() => null),
      applicationsApi.list().catch(() => []),
    ]).then(([analyticsData, apps]) => {
      if (analyticsData) setAnalytics(analyticsData);
      if (apps) setRecentApps(apps.slice(0, 5));
      setIsLoading(false);
    });
  }, []);

  const stats = [
    {
      title: 'Total Applications',
      value: analytics?.totalApplications || recentApps.length,
      change: '+12% this week',
      icon: <Briefcase className="w-5 h-5 text-indigo-400" />,
      bg: 'bg-indigo-500/10 border-indigo-500/20',
    },
    {
      title: 'Resumes Tailored',
      value: analytics?.resumesGenerated || 0,
      change: 'Truth Preserved',
      icon: <FileCheck className="w-5 h-5 text-emerald-400" />,
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      title: 'Average ATS Score',
      value: `${analytics?.averageAtsScore || 86}%`,
      change: 'ATS Optimized',
      icon: <TrendingUp className="w-5 h-5 text-purple-400" />,
      bg: 'bg-purple-500/10 border-purple-500/20',
    },
    {
      title: 'Interviews & Offers',
      value: (analytics?.interviewsScheduled || 0) + (analytics?.offersReceived || 0),
      change: 'High Conversion',
      icon: <Award className="w-5 h-5 text-amber-400" />,
      bg: 'bg-amber-500/10 border-amber-500/20',
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/70 via-zinc-900 to-violet-950/50 p-7 shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <Badge variant="purple" className="mb-1">Enterprise Resume Engine</Badge>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              Tailor your resume for any job opening in seconds
            </h2>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Paste a job URL or description. ResuMate AI performs ATS keyword gap analysis and generates a truth-preserved, ATS-optimized resume.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 shrink-0">
            <Button
              variant="primary"
              size="lg"
              onClick={() => setActivePage('tailor-studio')}
              className="gap-2 shadow-indigo-600/30 shadow-lg"
            >
              <Sparkles className="w-4 h-4" />
              <span>Tailor New Resume</span>
            </Button>
            {!masterResume && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => setActivePage('master-resume')}
                className="gap-2"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload Master Resume</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className={`p-5 flex items-center justify-between border ${stat.bg}`}>
            <div className="space-y-1">
              <span className="text-xs font-medium text-zinc-400">{stat.title}</span>
              <div className="text-2xl font-black text-white tracking-tight">{stat.value}</div>
              <span className="text-[11px] text-zinc-400 font-medium flex items-center gap-1">
                {stat.change}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800">
              {stat.icon}
            </div>
          </Card>
        ))}
      </div>

      {/* Main Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Master Resume Status */}
        <Card className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              Master Resume Profile
            </h3>
            {masterResume ? (
              <Badge variant="success">Active (v{masterResume.versionNumber})</Badge>
            ) : (
              <Badge variant="warning">Not Uploaded</Badge>
            )}
          </div>

          {masterResume ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-2">
                <div className="text-sm font-semibold text-white">{masterResume.title}</div>
                <div className="text-xs text-zinc-400">
                  {masterResume.schema.experience.length} Experience items • {masterResume.schema.skills.reduce((acc, c) => acc + c.skills.length, 0)} Skills • {masterResume.schema.projects.length} Projects
                </div>
                <div className="text-[11px] text-zinc-500">
                  Last updated {new Date(masterResume.createdAtUtc).toLocaleDateString()}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setActivePage('master-resume')}>
                  Edit Schema
                </Button>
                <Button variant="primary" size="sm" className="flex-1" onClick={() => setActivePage('tailor-studio')}>
                  Use in Tailoring
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 space-y-3">
              <div className="h-12 w-12 rounded-full bg-zinc-800/80 border border-zinc-700 flex items-center justify-center mx-auto text-zinc-400">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-zinc-300">No master resume uploaded</div>
                <div className="text-xs text-zinc-500 max-w-xs mx-auto">
                  Upload your comprehensive resume in PDF, DOCX, or Markdown once to begin tailoring.
                </div>
              </div>
              <Button variant="primary" size="sm" onClick={() => setActivePage('master-resume')}>
                Upload Master Resume
              </Button>
            </div>
          )}
        </Card>

        {/* Recent Applications Tracker */}
        <Card className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-emerald-400" />
              Recent Applications
            </h3>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setActivePage('tracker')}>
              View Kanban <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>

          {recentApps.length > 0 ? (
            <div className="divide-y divide-zinc-800/60">
              {recentApps.map((app) => (
                <div key={app.id} className="py-3 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="font-semibold text-xs text-zinc-100">{app.jobTitle}</div>
                    <div className="text-[11px] text-zinc-400">{app.companyName} • {app.location || 'Remote'}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={
                      app.status === ApplicationStatus.Offered ? 'success' :
                      app.status === ApplicationStatus.Interviewing ? 'purple' :
                      app.status === ApplicationStatus.Applied ? 'default' : 'warning'
                    }>
                      {app.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-xs text-zinc-500">
              No tracked applications yet. Tailored resumes will automatically appear here.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
