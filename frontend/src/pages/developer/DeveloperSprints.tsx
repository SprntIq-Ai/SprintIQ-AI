import React, { useEffect, useState } from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { Badge } from '../../components/common/Badge';
import { sprintService } from '../../services/api';
import { Sprint } from '../../types';
import { Layers, Calendar, Target, CheckCircle2 } from 'lucide-react';
import { ProgressBar } from '../../components/common/ProgressBar';

export const DeveloperSprints: React.FC = () => {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const fetchSprints = () => {
    setIsLoading(true);
    sprintService.getAll().then((data) => {
      setSprints(data);
    }).catch(err => console.error(err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchSprints();
  }, []);

  const filtered = sprints.filter(s => {
    if (filter !== 'All') {
      const derived = s.derived_status || s.status;
      if (filter.toUpperCase() !== derived) return false;
    }
    if (search.trim()) {
      return s.name.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const getBadgeVariant = (derived: string | undefined): 'healthy' | 'at_risk' | 'critical' | 'completed' | 'in_progress' | 'pending' | 'default' => {
    switch (derived) {
      case 'COMPLETED': return 'completed';
      case 'OVERDUE': return 'critical';
      case 'ACTIVE': return 'in_progress';
      case 'CANCELLED': return 'default';
      default: return 'pending';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Active Sprints View</h1>
          <p className="text-xs text-slate-500 mt-1">Monitor active sprint timelines and goal deliverables</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search Sprints..."
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 outline-none focus:border-[var(--role-primary)]"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 outline-none focus:border-[var(--role-primary)]"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          >
            <option value="All">All Sprints</option>
            <option value="Planned">Planned</option>
            <option value="Active">Active</option>
            <option value="Completed">Completed</option>
            <option value="Overdue">Overdue</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-slate-400 py-10">Loading Sprints...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-slate-400 py-10">No sprints match your criteria.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((s) => {
            const derived = s.derived_status || s.status;
            const isCompleted = derived === 'COMPLETED';
            const progress = s.progress_percentage || 0;
            const remaining = (s.total_tasks || 0) - (s.completed_tasks || 0);

            return (
              <GlassCard key={s.id} hoverEffect className="border-l-4 border-l-[var(--role-primary)] flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {isCompleted && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                    <Badge variant={getBadgeVariant(derived)}>{derived}</Badge>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">{s.start_date} → {s.end_date}</span>
                </div>

                <h3 className="text-xl font-bold text-slate-900 mb-2">{s.name}</h3>
                <p className="text-slate-600 text-xs flex items-start gap-2 mb-4">
                  <Target className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--role-primary)' }} />
                  <span>{s.goal || "No explicit goal specified."}</span>
                </p>

                <div className="mt-auto pt-4 border-t border-slate-100">
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1 font-medium">
                    <span>Progress: {progress}%</span>
                    <span>{s.completed_tasks || 0} / {s.total_tasks || 0} Tasks Completed</span>
                  </div>
                  <ProgressBar value={progress} tone="success" className="mb-2" />

                  {isCompleted ? (
                    <p className="text-[10px] text-emerald-600 font-bold flex items-center justify-end gap-1">
                      <CheckCircle2 className="w-3 h-3" /> All tasks verified by manager
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 text-right">
                      {s.total_tasks === 0 ? "No tasks assigned" : `Remaining: ${remaining} Tasks`}
                    </p>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
};
