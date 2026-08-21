import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GlassCard } from '../../components/common/GlassCard';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { managerService } from '../../services/api';
import { FolderKanban, Users, ArrowRight, AlertCircle } from 'lucide-react';

export const ManagerProjects: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await managerService.getProjects();
        setProjects(res || []);
      } catch (e: any) {
        console.error(e);
        setError(e.response?.data?.detail || 'Failed to load assigned projects');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 role-skeleton" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <div key={i} className="h-40 role-skeleton rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            Assigned Projects <Badge variant="manager">Project Manager</Badge>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Projects assigned to you by the Admin appear here.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {!error && projects.length === 0 && (
        <GlassCard className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 rounded-2xl bg-slate-100 mb-4">
            <FolderKanban className="w-10 h-10" style={{ color: 'var(--role-primary)' }} />
          </div>
          <h3 className="text-xl font-bold text-slate-900">No projects assigned yet</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-md">
            Projects assigned by the Admin will appear here.
          </p>
        </GlassCard>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((p) => (
          <GlassCard key={p.id} hoverEffect className="flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-xs font-mono font-bold px-2 py-1 rounded bg-[rgba(var(--role-primary-rgb),0.10)] text-[var(--role-primary)] border border-[rgba(var(--role-primary-rgb),0.20)]"
                >
                  {p.key}
                </span>
                <Badge variant={p.status.toLowerCase() as any}>{p.status}</Badge>
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-2">{p.name}</h3>
              <p className="text-slate-500 text-xs line-clamp-2 mb-4">{p.description || 'No description provided.'}</p>

              <div className="space-y-2 text-xs border-t border-slate-200 pt-4 mb-4">
                <div className="flex justify-between text-slate-600">
                  <span className="text-slate-500">Project ID:</span>
                  <span className="font-mono font-semibold text-slate-900">{p.id}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span className="text-slate-500">Manager:</span>
                  <span className="font-semibold text-slate-900">{p.manager_name || 'Unassigned'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-500">Status:</span>
                  <Badge variant={p.status.toLowerCase() as any}>{p.status}</Badge>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-500 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Developers:</span>
                  <span className="font-semibold text-slate-900">{p.developers_count ?? 0}</span>
                </div>
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span style={{ color: 'var(--role-text-muted)' }}>Progress</span>
                    <span className="font-semibold" style={{ color: 'var(--role-primary)' }}>{p.total_tasks ? Math.round(((p.completed_tasks || 0) / p.total_tasks) * 100) : 0}%</span>
                  </div>
                  <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${p.total_tasks ? Math.round(((p.completed_tasks || 0) / p.total_tasks) * 100) : 0}%`,
                        backgroundColor: 'var(--role-primary)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
              <Link to={`/manager/projects/${p.id}/team`} className="flex-1">
                <Button variant="manager" className="w-full" icon={<ArrowRight className="w-4 h-4" />}>
                  Open Project
                </Button>
              </Link>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
};