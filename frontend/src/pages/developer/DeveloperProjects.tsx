import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { ProgressBar } from '../../components/common/ProgressBar';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { developerService } from '../../services/api';
import { DeveloperProject } from '../../types';

export const DeveloperProjects: React.FC = () => {
    const [projects, setProjects] = useState<DeveloperProject[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProjects = () => {
        setIsLoading(true);
        setError(null);
        developerService.getProjects()
            .then((res) => {
                setProjects(res);
                setIsLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setError('Failed to load your assigned projects. Please try again.');
                setIsLoading(false);
            });
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="h-10 w-72 role-skeleton rounded-lg animate-pulse" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-56 role-skeleton rounded-2xl animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <PageHeader
                    eyebrow="My Work"
                    title="Assigned Projects"
                    badge={<Badge variant="developer">Developer</Badge>}
                    subtitle="View and manage the projects you are actively contributing to."
                />
                <div className="flex flex-col items-center justify-center p-12 text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                    <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--role-text-heading)' }}>Connection Error</h3>
                    <p className="text-sm max-w-md mb-6" style={{ color: 'var(--role-text-muted)' }}>{error}</p>
                    <Button onClick={fetchProjects} icon={<RefreshCw className="w-4 h-4 cursor-pointer" />}>
                        Retry Request
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow="My Work"
                title="Assigned Projects"
                badge={<Badge variant="developer">Developer</Badge>}
                subtitle="View and manage the projects you are actively contributing to."
            />

            {projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-16 text-center border rounded-2xl" style={{ borderColor: 'var(--role-border-subtle)', background: 'var(--role-bg-subtle)' }}>
                    <FolderKanban className="w-12 h-12 mb-4" style={{ color: 'var(--role-primary)' }} />
                    <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--role-text-heading)' }}>No projects assigned yet</h3>
                    <p className="text-sm max-w-sm mb-4" style={{ color: 'var(--role-text-muted)' }}>
                        Once the administrator or your project manager assigns you to projects, they will be listed here.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {projects.map((p) => (
                        <Link to={`/developer/projects/${p.id}`} key={p.id} className="block group">
                            <Card hoverEffect className="!p-5 h-full transition-all duration-200 group-hover:-translate-y-1">
                                <div className="flex items-center justify-between gap-2 mb-3">
                                    <span className="role-chip font-mono text-xs">{p.key}</span>
                                    <Badge variant={(p.status || '').toLowerCase() as any}>{p.status}</Badge>
                                </div>

                                <h3 className="role-card-title truncate text-base mb-1 group-hover:text-[var(--role-primary)] transition-colors">
                                    {p.name}
                                </h3>

                                <p className="role-muted text-xs truncate mb-3">
                                    Manager: <span className="font-medium" style={{ color: 'var(--role-text-body)' }}>{p.manager_name || 'Unassigned'}</span>
                                </p>

                                {p.description && (
                                    <p className="text-xs line-clamp-2 min-h-[32px] mb-4" style={{ color: 'var(--role-text-muted)' }}>
                                        {p.description}
                                    </p>
                                )}

                                <div className="pt-3" style={{ borderTop: '1px solid var(--role-border-subtle)' }}>
                                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                                        <span style={{ color: 'var(--role-text-muted)' }}>
                                            {p.total_tasks} assigned task{p.total_tasks !== 1 ? 's' : ''}
                                        </span>
                                        <span className="font-semibold" style={{ color: 'var(--role-success, #22C55E)' }}>
                                            {p.completed_tasks} completed
                                        </span>
                                    </div>
                                    <ProgressBar value={p.completed_tasks} max={Math.max(p.total_tasks, 1)} size="sm" />
                                </div>

                                <div className="flex items-center justify-end mt-4 text-[11px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--role-primary)' }}>
                                    Open Details <ArrowRight className="w-3 h-3 ml-1" />
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
};
