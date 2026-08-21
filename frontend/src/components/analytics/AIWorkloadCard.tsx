import React, { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { Card } from '../common/Card';
import { InitialsAvatar } from '../common/InitialsAvatar';
import { analyticsService } from '../../services/api';

interface AIWorkloadCardProps {
  projectId?: string;
  className?: string;
  limit?: number;
}

interface WorkloadItem {
  developer_id?: string;
  developer_name: string;
  assigned_tasks: number;
  estimated_hours: number;
  completed_hours?: number;
  remaining_hours?: number;
  workload_status: 'LOW' | 'MEDIUM' | 'HIGH';
}

const statusPct: Record<string, number> = { LOW: 40, MEDIUM: 70, HIGH: 90 };
const statusTone: Record<string, 'role' | 'success' | 'warning' | 'danger' | 'info'> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'danger',
};

const statusLabel: Record<string, string> = {
  LOW: 'Available',
  MEDIUM: 'Moderate',
  HIGH: 'Heavy',
};

export const AIWorkloadCard: React.FC<AIWorkloadCardProps> = ({ projectId, className = '', limit = 5 }) => {
  const [data, setData] = useState<WorkloadItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    analyticsService.getWorkloadHeatmap(projectId)
      .then((res) => { if (!cancelled) setData(res || []); })
      .catch(() => { if (!cancelled) setData([]); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  if (isLoading) {
    return (
      <Card title="Developer Workload" icon={<Activity className="w-4 h-4" />} className={className}>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 role-skeleton rounded-xl" />)}
        </div>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card title="Developer Workload" icon={<Activity className="w-4 h-4" />} className={className}>
        <p className="text-xs" style={{ color: 'var(--role-text-muted)' }}>No workload data available.</p>
      </Card>
    );
  }

  const sorted = [...data].sort((a, b) => b.estimated_hours - a.estimated_hours);
  const maxHrs = Math.max(...sorted.map((d) => d.estimated_hours), 1);

  return (
    <Card
      title="Developer Workload"
      icon={<Activity className="w-4 h-4" />}
      action={<span className="role-muted">{data.length} developers</span>}
      className={className}
    >
      <div className="space-y-4">
        {sorted.slice(0, limit).map((dev) => {
          const pct = statusPct[dev.workload_status] || 60;
          const tone = statusTone[dev.workload_status] || 'role';
          return (
            <div key={dev.developer_id || dev.developer_name}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <InitialsAvatar
                    name={dev.developer_name}
                    role="developer"
                    size={28}
                    style={{ boxShadow: '0 0 0 1.5px var(--role-border-subtle)' }}
                  />
                  <span className="text-xs font-semibold truncate" style={{ color: 'var(--role-text-heading)' }}>
                    {dev.developer_name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] tabular-nums" style={{ color: 'var(--role-text-muted)' }}>
                    {dev.assigned_tasks} tasks · {dev.estimated_hours}h
                  </span>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border"
                    style={{
                      backgroundColor: tone === 'role' ? 'var(--role-bg-subtle)' : `rgba(${tone === 'success' ? '34,197,94' : tone === 'warning' ? '245,158,11' : '239,68,68'},0.10)`,
                      borderColor: tone === 'role' ? 'var(--role-border-subtle)' : `rgba(${tone === 'success' ? '34,197,94' : tone === 'warning' ? '245,158,11' : '239,68,68'},0.25)`,
                      color: tone === 'role' ? 'var(--role-primary)' : tone === 'success' ? '#22C55E' : tone === 'warning' ? '#F59E0B' : '#EF4444',
                    }}
                  >
                    {statusLabel[dev.workload_status] || dev.workload_status}
                  </span>
                </div>
              </div>
              <div className="role-progress-track h-2 w-full">
                <div
                  className={`role-progress-bar ${tone !== 'role' ? `is-${tone}` : ''}`}
                  style={{ width: `${pct}%`, opacity: 0.9 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};