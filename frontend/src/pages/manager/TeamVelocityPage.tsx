import React, { useEffect, useState } from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { Badge } from '../../components/common/Badge';
import { analyticsService } from '../../services/api';
import { TeamVelocity } from '../../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, CartesianGrid } from 'recharts';
import { LineChart as ChartIcon, Zap, TrendingUp, Layers, CheckCircle2 } from 'lucide-react';

export const TeamVelocityPage: React.FC = () => {
  const [velocityData, setVelocityData] = useState<TeamVelocity | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    analyticsService.getTeamVelocity().then(res => {
      setVelocityData(res);
      setIsLoading(false);
    }).catch(e => {
      console.error(e);
      setIsLoading(false);
    });
  }, []);

  if (isLoading || !velocityData) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-slate-100 rounded animate-pulse" />
        <div className="h-96 bg-slate-50 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          Team Velocity & Sprint Burndown <Badge variant="manager">Manager Portal</Badge>
        </h1>
        <p className="text-xs text-slate-500 mt-1">Sprint story points velocity, burndown trajectory, and historical velocity trends</p>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <GlassCard hoverEffect>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase">Sprint Velocity</p>
              <h3 className="text-3xl font-bold text-emerald-400 mt-1">{velocityData.sprint_velocity} SP</h3>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
              <Zap className="w-6 h-6" />
            </div>
          </div>
        </GlassCard>

        <GlassCard hoverEffect>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase">Average Story Points</p>
              <h3 className="text-3xl font-bold text-teal-400 mt-1">{velocityData.average_story_points} SP</h3>
            </div>
            <div className="p-3 bg-teal-500/10 text-teal-400 rounded-2xl border border-teal-500/20">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </GlassCard>

        <GlassCard hoverEffect>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase">Completed Story Points</p>
              <h3 className="text-3xl font-bold mt-1" style={{ color: 'var(--role-action)' }}>{velocityData.completed_story_points} SP</h3>
            </div>
            <div className="p-3 rounded-2xl border bg-[rgba(var(--role-action-rgb),0.10)] text-[var(--role-action)] border-[rgba(var(--role-action-rgb),0.20)]">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        </GlassCard>

        <GlassCard hoverEffect>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase">Remaining Story Points</p>
              <h3 className="text-3xl font-bold mt-1" style={{ color: 'var(--role-accent)' }}>{velocityData.remaining_story_points} SP</h3>
            </div>
            <div className="p-3 rounded-2xl border bg-[rgba(var(--role-accent-rgb),0.10)] text-[var(--role-accent)] border-[rgba(var(--role-accent-rgb),0.20)]">
              <Layers className="w-6 h-6" />
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Sprint Burndown Chart */}
      <GlassCard>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ChartIcon className="w-5 h-5 text-emerald-400" /> Active Sprint Burndown Chart
            </h3>
            <p className="text-xs text-slate-500">Ideal vs Actual burndown trajectory of remaining story points</p>
          </div>
          <Badge variant="healthy">Sprint Completion: 80%</Badge>
        </div>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={velocityData.burndown_chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ background: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
              <Legend />
              <Line type="monotone" dataKey="ideal" stroke="#64748b" strokeDasharray="5 5" name="Ideal Burndown" />
              <Line type="monotone" dataKey="actual" stroke="#22C55E" strokeWidth={3} name="Actual Burndown" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      {/* Historical Velocity Trends */}
      <GlassCard>
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-teal-400" /> Historical Velocity Trends
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={velocityData.historical_trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="sprint" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ background: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
              <Legend />
              <Bar dataKey="planned" fill="#64748b" name="Planned SP" radius={[6, 6, 0, 0]} />
              <Bar dataKey="completed" fill="#22C55E" name="Completed SP" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </div>
  );
};
