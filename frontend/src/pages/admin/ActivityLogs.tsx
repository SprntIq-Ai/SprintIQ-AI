import React, { useEffect, useState, useCallback } from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { Badge } from '../../components/common/Badge';
import { adminService } from '../../services/api';
import { Activity, Search, Calendar, RefreshCw } from 'lucide-react';
import { Button } from '../../components/common/Button';

export const ActivityLogs: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [filterText, setFilterText] = useState('');
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await adminService.getActivityLogs();
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load activity logs:", err);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    const handleMutation = () => fetchLogs();
    window.addEventListener('sprintiq:mutation', handleMutation);
    return () => window.removeEventListener('sprintiq:mutation', handleMutation);
  }, [fetchLogs]);

  const filtered = logs.filter(l => {
    const matchesSearch = (
      (l.user_name || '').toLowerCase().includes(filterText.toLowerCase()) ||
      (l.action || '').toLowerCase().includes(filterText.toLowerCase()) ||
      (l.entity_type || '').toLowerCase().includes(filterText.toLowerCase()) ||
      (l.user_email || '').toLowerCase().includes(filterText.toLowerCase())
    );
    const matchesAction = selectedAction === 'ALL' || (l.action || '').toUpperCase() === selectedAction.toUpperCase();
    return matchesSearch && matchesAction;
  });

  const uniqueActions = ['ALL', ...Array.from(new Set(logs.map(l => (l.action || '').toUpperCase()).filter(Boolean)))];

  const getRoleVariant = (role: string) => {
    const r = (role || '').toUpperCase();
    if (r === 'ADMIN') return 'admin';
    if (r === 'MANAGER') return 'manager';
    if (r === 'DEVELOPER') return 'developer';
    return 'neutral';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Audit Activity Trail</h1>
          <p className="text-xs text-slate-500 mt-1">Real-time audit logging across security events, task reviews, and project updates</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter by user, action..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-primary)]"
            />
          </div>

          <div className="relative w-full sm:w-44">
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-primary)] cursor-pointer"
            >
              {uniqueActions.map(action => (
                <option key={action} value={action}>{action === 'ALL' ? 'All Actions' : action}</option>
              ))}
            </select>
          </div>

          <Button variant="outline" size="sm" icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />} onClick={fetchLogs}>
            Refresh
          </Button>
        </div>
      </div>

      <GlassCard>
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-[var(--role-primary)]" />
            <p className="text-xs font-medium">Loading real-time audit logs...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-slate-700">No activity logs found</p>
            <p className="text-xs mt-1">No system events match your current search or filter criteria.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((log) => (
              <div key={log.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:border-slate-300 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg border border-slate-200/40 mt-0.5" style={{ backgroundColor: 'var(--role-bg-subtle)', color: 'var(--role-primary)' }}>
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{log.user_name}</span>
                      {log.user_role && (
                        <Badge variant={getRoleVariant(log.user_role) as any}>
                          {log.user_role}
                        </Badge>
                      )}
                      <span className="text-slate-400">•</span>
                      <span className="font-mono font-bold" style={{ color: 'var(--role-primary)' }}>{log.action}</span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-1">
                      Target: <span className="text-slate-700 font-medium">{log.entity_type}</span> ({log.entity_id || 'Global'})
                      {log.details && typeof log.details === 'object' && Object.keys(log.details).length > 0 && (
                        <span className="ml-2 text-slate-400 font-mono text-[10px]">
                          {JSON.stringify(log.details).slice(0, 80)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-slate-500 text-[11px] font-mono shrink-0 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {log.created_at ? new Date(log.created_at).toLocaleString() : 'Recent'}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
};
