import React, { useEffect, useState } from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { adminService } from '../../services/api';
import { Activity, Search, Shield, Calendar } from 'lucide-react';

export const ActivityLogs: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [filterText, setFilterText] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    adminService.getActivityLogs().then(data => {
      setLogs(data);
      setIsLoading(false);
    }).catch(err => console.error(err));
  }, []);

  const filtered = logs.filter(l =>
    l.user_name.toLowerCase().includes(filterText.toLowerCase()) ||
    l.action.toLowerCase().includes(filterText.toLowerCase()) ||
    l.entity_type.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Audit Activity Trail</h1>
          <p className="text-xs text-slate-500 mt-1">Real-time audit logging across security events, task reviews, and project updates</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter logs by user, action..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-primary)]"
          />
        </div>
      </div>

      <GlassCard>
        <div className="space-y-4">
          {filtered.map((log) => (
            <div key={log.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg border border-slate-200/40 mt-0.5" style={{ backgroundColor: 'var(--role-bg-subtle)', color: 'var(--role-primary)' }}>
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{log.user_name}</span>
                    <span className="text-slate-500">•</span>
                    <span className="font-mono font-bold" style={{ color: 'var(--role-primary)' }}>{log.action}</span>
                  </div>
                  <p className="text-slate-500 text-[11px] mt-1">
                    Entity: <span className="text-slate-600">{log.entity_type}</span> ({log.entity_id || 'N/A'})
                  </p>
                </div>
              </div>
              <div className="text-slate-500 text-[11px] font-mono shrink-0 flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                {new Date(log.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
};
