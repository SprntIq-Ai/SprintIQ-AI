import React, { useState } from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { Badge } from '../../components/common/Badge';
import { Calendar as CalendarIcon, Clock, Layers, Users, Flag, ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'SPRINT' | 'DEADLINE' | 'MEETING' | 'MILESTONE' | 'LEAVE';
  assignee?: string;
}

export const ProjectCalendar: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState('August 2026');
  const [events] = useState<CalendarEvent[]>([
    { id: '1', title: 'Sprint 1 Review Meeting', date: '2026-08-07', type: 'MEETING', assignee: 'All Team' },
    { id: '2', title: 'Sprint 2 Kickoff', date: '2026-08-15', type: 'SPRINT', assignee: 'Engineering Team' },
    { id: '3', title: 'Gemini Copilot API Deadline', date: '2026-08-18', type: 'DEADLINE', assignee: 'Michael Chen' },
    { id: '4', title: 'Executive Architecture Milestone', date: '2026-08-22', type: 'MILESTONE', assignee: 'Alex Vance' },
    { id: '5', title: 'Sarah Jenkins Planned Leave', date: '2026-08-26', type: 'LEAVE', assignee: 'Sarah Jenkins' }
  ]);

  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'SPRINT': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'DEADLINE': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'MEETING': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'MILESTONE': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'LEAVE': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            Project Calendar Schedule <Badge variant="manager">Full Schedule</Badge>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Sprint dates, task deadlines, team meetings, milestones, and developer leave calendar</p>
        </div>

        <div className="flex items-center gap-3">
          <button className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-bold text-slate-900 text-sm">{currentMonth}</span>
          <button className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <GlassCard className="space-y-4">
        {/* Days Header */}
        <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-500 border-b border-slate-200 pb-3">
          <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
        </div>

        {/* Days Cells */}
        <div className="grid grid-cols-7 gap-2">
          {daysInMonth.map((d) => {
            const dayEvents = events.filter(e => parseInt(e.date.split('-')[2]) === d);
            return (
              <div
                key={d}
                className={`min-h-[90px] p-2 rounded-xl border text-xs flex flex-col justify-between transition-all ${
                  d === 15 ? 'bg-[rgba(var(--role-primary-rgb),0.10)] border-[rgba(var(--role-primary-rgb),0.40)] ring-1 ring-[rgba(var(--role-primary-rgb),0.50)]' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className={`font-mono text-xs font-bold ${d === 15 ? 'text-[var(--role-primary)]' : 'text-slate-600'}`}>{d}</span>
                  {d === 15 && <span className="text-[9px] px-1 rounded bg-[var(--role-primary)] text-slate-950 font-bold">TODAY</span>}
                </div>

                <div className="space-y-1">
                  {dayEvents.map((ev) => (
                    <div key={ev.id} className={`p-1 rounded text-[10px] truncate border ${getEventBadge(ev.type)}`}>
                      {ev.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
};
