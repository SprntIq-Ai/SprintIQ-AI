import React, { useState } from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { Badge } from '../../components/common/Badge';
import { Calendar, Layers, Clock, CheckCircle2, ArrowRight } from 'lucide-react';

interface TimelineItem {
  id: string;
  name: string;
  type: 'PROJECT' | 'MILESTONE' | 'SPRINT' | 'TASK';
  startDate: string;
  endDate: string;
  progress: number;
  status: string;
  dependencies?: string[];
}

export const ProjectTimeline: React.FC = () => {
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([
    { id: '1', name: 'SprintIQ AI SaaS Platform', type: 'PROJECT', startDate: '2026-08-01', endDate: '2026-09-15', progress: 75, status: 'ACTIVE' },
    { id: '2', name: 'Milestone 1: Core Intelligence Engine', type: 'MILESTONE', startDate: '2026-08-01', endDate: '2026-08-20', progress: 90, status: 'COMPLETED' },
    { id: '3', name: 'Sprint 1 - Gemini Integration', type: 'SPRINT', startDate: '2026-08-01', endDate: '2026-08-14', progress: 100, status: 'COMPLETED' },
    { id: '4', name: 'Task: Integrate Gemini 1.5 REST API', type: 'TASK', startDate: '2026-08-02', endDate: '2026-08-08', progress: 100, status: 'COMPLETED', dependencies: ['Schema migration'] },
    { id: '5', name: 'Sprint 2 - Role Theme Engine & Gantt', type: 'SPRINT', startDate: '2026-08-15', endDate: '2026-08-28', progress: 60, status: 'ACTIVE' },
    { id: '6', name: 'Task: Role-Based Palette Styling', type: 'TASK', startDate: '2026-08-15', endDate: '2026-08-20', progress: 85, status: 'IN_PROGRESS', dependencies: ['Sprint 1'] },
    { id: '7', name: 'Task: Interactive Gantt Chart Timeline', type: 'TASK', startDate: '2026-08-18', endDate: '2026-08-25', progress: 40, status: 'IN_PROGRESS', dependencies: ['Palette Styling'] },
    { id: '8', name: 'Milestone 2: Executive PDF Exporter', type: 'MILESTONE', startDate: '2026-08-25', endDate: '2026-09-10', progress: 10, status: 'PLANNED' }
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            Interactive Project Timeline (Gantt Chart) <Badge variant="manager">Manager View</Badge>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Visual roadmap of projects, milestones, sprints, tasks, deadlines, and dependencies</p>
        </div>
      </div>

      {/* Gantt Timeline Container */}
      <GlassCard className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[var(--role-primary)]" /> Gantt Schedule Grid (August - September 2026)
          </h3>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-3 h-3 rounded bg-blue-500" /> Project
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-3 h-3 rounded bg-purple-500" /> Milestone
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-3 h-3 rounded bg-emerald-500" /> Sprint
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-3 h-3 rounded bg-amber-500" /> Task
            </span>
          </div>
        </div>

        {/* Timeline Rows */}
        <div className="space-y-4">
          {timelineItems.map((item) => {
            const getBg = () => {
              switch (item.type) {
                case 'PROJECT': return 'bg-blue-600/30 border-blue-500/50 text-blue-300';
                case 'MILESTONE': return 'bg-purple-600/30 border-purple-500/50 text-purple-300';
                case 'SPRINT': return 'bg-emerald-600/30 border-emerald-500/50 text-emerald-300';
                case 'TASK': return 'bg-amber-600/30 border-amber-500/50 text-amber-300';
              }
            };
            const getBarBg = () => {
              switch (item.type) {
                case 'PROJECT': return 'bg-blue-500';
                case 'MILESTONE': return 'bg-purple-500';
                case 'SPRINT': return 'bg-emerald-500';
                case 'TASK': return 'bg-amber-500';
              }
            };

            return (
              <div key={item.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded font-mono text-[10px] uppercase font-bold ${getBg()}`}>
                      {item.type}
                    </span>
                    <span className="font-bold text-slate-900 text-sm">{item.name}</span>
                    {item.dependencies && item.dependencies.length > 0 && (
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <ArrowRight className="w-3 h-3 text-slate-500" /> Depends on {item.dependencies.join(', ')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-slate-500 text-xs">
                    <span className="font-mono">{item.startDate} to {item.endDate}</span>
                    <span className="font-bold text-emerald-400">{item.progress}%</span>
                  </div>
                </div>

                {/* Visual Gantt Bar */}
                <div className="w-full h-3 bg-white rounded-full overflow-hidden p-0.5 border border-slate-200">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getBarBg()}`}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
};
