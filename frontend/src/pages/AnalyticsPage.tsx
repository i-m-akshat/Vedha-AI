import React, { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Compass, Award, CheckCircle2 } from 'lucide-react';
import { Card, Badge } from '../components/ui';
import { analyticsApi } from '../api';
import { DashboardAnalyticsDto } from '../types/shared';

export const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<DashboardAnalyticsDto | null>(null);

  useEffect(() => {
    analyticsApi.getDashboard().then(setData).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-400" />
          Analytics & ATS Score Trends
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Metrics on application velocity, match scores, and recurring missing skill gaps.
        </p>
      </div>

      {/* Top Missing Skills Heatmap */}
      <Card className="p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Compass className="w-4 h-4 text-amber-400" />
          Top Missing Skills Across Target Roles
        </h3>
        <p className="text-xs text-zinc-400">
          These technical competencies appeared most frequently in job requirements where your current resume had gaps.
        </p>

        {data?.topMissingSkills && data.topMissingSkills.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {data.topMissingSkills.map((sk, i) => (
              <div key={i} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <div className="font-bold text-xs text-white truncate">{sk.skill}</div>
                <div className="text-[10px] text-amber-400 font-semibold">{sk.frequency} postings requested this</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-zinc-500 py-4">Tailor more resumes to populate the missing skills heatmap.</div>
        )}
      </Card>

      {/* Recent Score Progression */}
      <Card className="p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          Recent ATS Score Progression
        </h3>

        {data?.recentScoreTrends && data.recentScoreTrends.length > 0 ? (
          <div className="space-y-3">
            {data.recentScoreTrends.map((trend, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
                <div>
                  <span className="font-bold text-white">{trend.role}</span>
                  <span className="text-zinc-400"> @ {trend.company}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-zinc-900 h-2 rounded-full overflow-hidden hidden sm:block">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${trend.score}%` }} />
                  </div>
                  <Badge variant={trend.score >= 80 ? 'success' : 'warning'}>
                    {trend.score}% Match
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-zinc-500 py-4">No recent score records.</div>
        )}
      </Card>
    </div>
  );
};
