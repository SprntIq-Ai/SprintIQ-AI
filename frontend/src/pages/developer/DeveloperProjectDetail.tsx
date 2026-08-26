import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    ArrowLeft, FolderKanban, Calendar, TrendingUp, Sparkles, Clock, Timer,
    Users, CheckCircle2, ListTodo, Layers, Cpu, GitPullRequest, AlertCircle,
    MessageSquare, Send, RefreshCw, FileText
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { ProgressBar } from '../../components/common/ProgressBar';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { GlassCard } from '../../components/common/GlassCard';
import { developerService } from '../../services/api';
import { DeveloperProjectDetail as DetailType, DeveloperProjectTask, Comment as TaskComment } from '../../types';

const STATUS_LABELS: Record<string, string> = {
    NOT_STARTED: 'Not Started',
    IN_PROGRESS: 'In Progress',
    TESTING: 'Testing',
    REVIEW_PENDING: 'Submitted for Review',
    REJECTED: 'Changes Requested',
    COMPLETED: 'Approved',
};

const statusBadgeVariant = (status: string): any => {
    switch (status) {
        case 'REVIEW_PENDING': return 'at_risk';
        case 'REJECTED': return 'critical';
        case 'COMPLETED': return 'healthy';
        case 'TESTING': return 'info';
        case 'IN_PROGRESS': return 'in_progress';
        default: return 'neutral';
    }
};

const formatDateLocal = (d?: string) => (d ? new Date(d).toLocaleDateString() : 'N/A');
const formatDateTime = (d?: string) => (d ? new Date(d).toLocaleString() : 'N/A');

export const DeveloperProjectDetail: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const [data, setData] = useState<DetailType | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal and Task Workflow states
    const [selectedTask, setSelectedTask] = useState<DeveloperProjectTask | null>(null);
    const [comments, setComments] = useState<TaskComment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Progress update state inside modal
    const [progressVal, setProgressVal] = useState<number>(0);
    const [statusVal, setStatusVal] = useState<string>('IN_PROGRESS');
    const [updateNotes, setUpdateNotes] = useState<string>('');

    const fetchProjectDetails = () => {
        if (!projectId) return;
        setIsLoading(true);
        setError(null);
        developerService.getProject(projectId)
            .then((res) => {
                setData(res);
                setIsLoading(false);
            })
            .catch((err) => {
                console.error(err);
                if (err.response?.status === 403) {
                    setError("You don't have access to this project.");
                } else if (err.response?.status === 404) {
                    setError("Project not found.");
                } else {
                    setError("Failed to load project details. Please try again later.");
                }
                setIsLoading(false);
            });
    };

    useEffect(() => {
        fetchProjectDetails();
    }, [projectId]);

    const handleOpenTask = async (task: DeveloperProjectTask) => {
        setSelectedTask(task);
        setProgressVal(task.progress);
        setStatusVal(task.status === 'REJECTED' ? 'IN_PROGRESS' : task.status);
        setUpdateNotes('');
        setNotice(null);
        try {
            const cList = await developerService.getComments(task.id);
            setComments(cList as TaskComment[]);
        } catch (e) {
            console.error(e);
        }
    };

    const isLocked = (task: DeveloperProjectTask) =>
        task.status === 'REVIEW_PENDING' || task.status === 'COMPLETED';

    const handleSaveProgress = async () => {
        if (!selectedTask) return;
        try {
            await developerService.updateProgress(selectedTask.id, progressVal, statusVal, updateNotes);
            setNotice({ type: 'success', text: 'Progress saved successfully!' });

            // Update local state instead of refetching the entire project
            if (data) {
                const updatedTasks = data.tasks.map(t =>
                    t.id === selectedTask.id ? { ...t, progress: progressVal, status: statusVal as any } : t
                );

                // Recalculate summary metrics
                const completedCount = updatedTasks.filter(t => t.status === 'COMPLETED').length;
                const inProgressCount = updatedTasks.filter(t => t.status === 'IN_PROGRESS').length;
                const reviewPendingCount = updatedTasks.filter(t => t.status === 'REVIEW_PENDING').length;
                const progressPercentage = (completedCount / maxVal(updatedTasks.length, 1)) * 100;

                setData({
                    ...data,
                    tasks: updatedTasks,
                    developer_summary: {
                        ...data.developer_summary,
                        completed_task_count: completedCount,
                        in_progress_task_count: inProgressCount,
                        review_pending_task_count: reviewPendingCount,
                        overall_progress: roundVal(progressPercentage, 1)
                    }
                });
            }
            setSelectedTask((prev) => (prev ? { ...prev, progress: progressVal, status: statusVal as any } : null));
        } catch (e: any) {
            setNotice({ type: 'error', text: e?.response?.data?.detail || 'Failed to update task progress' });
        }
    };

    const maxVal = (val: number, fallback: number) => val > 0 ? val : fallback;
    const roundVal = (val: number, precision: number) => {
        const factor = Math.pow(10, precision);
        return Math.round(val * factor) / factor;
    };

    const handleSubmitForReview = async () => {
        if (!selectedTask) return;
        try {
            await developerService.submitTask(selectedTask.id);
            setNotice({ type: 'success', text: 'Task submitted for manager review!' });

            if (data) {
                const updatedTasks = data.tasks.map(t =>
                    t.id === selectedTask.id ? { ...t, progress: 100, status: 'REVIEW_PENDING' as any } : t
                );

                // Recalculate summary metrics
                const completedCount = updatedTasks.filter(t => t.status === 'COMPLETED').length;
                const inProgressCount = updatedTasks.filter(t => t.status === 'IN_PROGRESS').length;
                const reviewPendingCount = updatedTasks.filter(t => t.status === 'REVIEW_PENDING').length;

                setData({
                    ...data,
                    tasks: updatedTasks,
                    developer_summary: {
                        ...data.developer_summary,
                        in_progress_task_count: inProgressCount,
                        review_pending_task_count: reviewPendingCount
                    }
                });
            }
            setSelectedTask(null);
        } catch (e: any) {
            setNotice({ type: 'error', text: e?.response?.data?.detail || 'Failed to submit task' });
        }
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTask || !newComment.trim()) return;
        try {
            const added = await developerService.addComment(selectedTask.id, newComment);
            setComments((prev) => [...prev, added as TaskComment]);
            setNewComment('');
        } catch (err) {
            console.error(err);
            setNotice({ type: 'error', text: 'Failed to post comment' });
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 role-skeleton rounded-lg animate-pulse" />
                    <div className="h-8 w-48 role-skeleton rounded-lg animate-pulse" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <div className="h-64 role-skeleton rounded-2xl lg:col-span-2 animate-pulse" />
                    <div className="h-64 role-skeleton rounded-2xl animate-pulse" />
                </div>
                <div className="h-96 role-skeleton rounded-2xl w-full animate-pulse" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="space-y-6">
                <Link to="/developer/projects" className="inline-flex items-center gap-2 text-xs font-semibold hover:underline" style={{ color: 'var(--role-primary)' }}>
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Assigned Projects
                </Link>
                <div className="flex flex-col items-center justify-center p-12 text-center border rounded-2xl" style={{ borderColor: 'var(--role-border-subtle)', background: 'var(--role-bg-subtle)' }}>
                    <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                    <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--role-text-heading)' }}>
                        {error === "Project not found." ? "Project Not Found" : "Access Denied"}
                    </h3>
                    <p className="text-sm max-w-md mb-6" style={{ color: 'var(--role-text-muted)' }}>
                        {error || "An error occurred while loading project details."}
                    </p>
                    <Link to="/developer/projects">
                        <Button>
                            Go to Assigned Projects
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    const { project, developer_summary: summary, tasks, sprints, team } = data;
    const activeSprints = sprints.filter(s => s.status === 'ACTIVE');
    const activeSprint = activeSprints.length > 0 ? activeSprints[0] : null;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <Link to="/developer/projects" className="inline-flex items-center gap-2 text-xs font-semibold mb-4 hover:underline" style={{ color: 'var(--role-primary)' }}>
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Assigned Projects
                </Link>

                <div className="flex items-start md:items-center justify-between flex-wrap gap-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <span className="role-chip font-mono text-xs">{project.key}</span>
                            <Badge variant={(project.status || '').toLowerCase() as any}>{project.status}</Badge>
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--role-text-heading)' }}>
                            {project.name}
                        </h1>
                        <p className="text-xs" style={{ color: 'var(--role-text-muted)' }}>
                            Manager: <span className="font-semibold text-slate-700">{project.manager_name || 'Unassigned'}</span>
                        </p>
                    </div>

                    {/* Project Intelligence Quick Links */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <Link to={`/projects/${project.id}/intelligence`}>
                            <Button size="sm" variant="outline" icon={<Cpu className="w-3.5 h-3.5" />}>
                                Intelligence
                            </Button>
                        </Link>
                        <Link to={`/projects/${project.id}/ai-insights`}>
                            <Button size="sm" variant="outline" icon={<Sparkles className="w-3.5 h-3.5" />}>
                                AI Insights
                            </Button>
                        </Link>
                        <Link to={`/projects/${project.id}/github`}>
                            <Button size="sm" variant="outline" icon={<GitPullRequest className="w-3.5 h-3.5" />}>
                                GitHub Engine
                            </Button>
                        </Link>
                        <Link to={`/projects/${project.id}/release-readiness`}>
                            <Button size="sm" variant="outline" icon={<FileText className="w-3.5 h-3.5" />}>
                                Release Info
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Overview & Workloads */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Project Overview */}
                <Card title="Project Overview" icon={<FolderKanban className="w-4 h-4" />} className="lg:col-span-2 space-y-4">
                    <div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--role-text-muted)' }}>Description</span>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--role-text-body)' }}>
                            {project.description || "No project overview or description has been provided details."}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--role-text-muted)' }}>Status</span>
                            <span className="text-xs font-semibold block mt-0.5" style={{ color: 'var(--role-text-heading)' }}>{project.status}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--role-text-muted)' }}>Start Date</span>
                            <span className="text-xs font-semibold block mt-0.5" style={{ color: 'var(--role-text-heading)' }}>{formatDateLocal(project.start_date)}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--role-text-muted)' }}>Target Date</span>
                            <span className="text-xs font-semibold block mt-0.5" style={{ color: 'var(--role-text-heading)' }}>{formatDateLocal(project.target_date)}</span>
                        </div>
                    </div>
                </Card>

                {/* My Project Progress */}
                <Card title="My Progress" icon={<TrendingUp className="w-4 h-4" />} className="h-full flex flex-col justify-between">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="px-3 py-2.5 rounded-xl border text-center" style={{ background: 'var(--role-bg-subtle)', borderColor: 'var(--role-border-subtle)' }}>
                            <span className="text-xs block" style={{ color: 'var(--role-text-muted)' }}>Assigned Tasks</span>
                            <span className="text-base font-bold" style={{ color: 'var(--role-text-heading)' }}>{summary.assigned_task_count}</span>
                        </div>
                        <div className="px-3 py-2.5 rounded-xl border text-center" style={{ background: 'var(--role-bg-subtle)', borderColor: 'var(--role-border-subtle)' }}>
                            <span className="text-xs block" style={{ color: 'var(--role-text-muted)' }}>Completed</span>
                            <span className="text-base font-bold text-emerald-600">{summary.completed_task_count}</span>
                        </div>
                        <div className="px-3 py-2.5 rounded-xl border text-center" style={{ background: 'var(--role-bg-subtle)', borderColor: 'var(--role-border-subtle)' }}>
                            <span className="text-xs block" style={{ color: 'var(--role-text-muted)' }}>In Progress</span>
                            <span className="text-base font-bold text-blue-500">{summary.in_progress_task_count}</span>
                        </div>
                        <div className="px-3 py-2.5 rounded-xl border text-center" style={{ background: 'var(--role-bg-subtle)', borderColor: 'var(--role-border-subtle)' }}>
                            <span className="text-xs block" style={{ color: 'var(--role-text-muted)' }}>Awaiting Review</span>
                            <span className="text-base font-bold text-amber-500">{summary.review_pending_task_count}</span>
                        </div>
                    </div>

                    <div className="space-y-1 mt-auto pt-3 border-t" style={{ borderColor: 'var(--role-border-subtle)' }}>
                        <div className="flex items-center justify-between text-xs font-semibold.text-slate-600 mb-1">
                            <span style={{ color: 'var(--role-text-muted)' }}>Overall Contribution Progress</span>
                            <span style={{ color: 'var(--role-primary)' }}>{summary.overall_progress}%</span>
                        </div>
                        <ProgressBar value={summary.overall_progress} size="md" />
                    </div>
                </Card>
            </div>

            {/* Main Content splits */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Core Assigned Tasks */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="role-section-title flex items-center gap-2">
                            <ListTodo className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--role-primary)' }} /> My Assigned Tasks
                        </h2>
                        <span className="role-muted">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
                    </div>

                    {tasks.length === 0 ? (
                        <Card className="text-center py-10">
                            <ListTodo className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                            <p className="text-sm font-semibold" style={{ color: 'var(--role-text-heading)' }}>No Tasks Assigned Yet</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--role-text-muted)' }}>
                                You have no tasks assigned to you on this project. Manager allocations will reflect here.
                            </p>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {tasks.map((t) => (
                                <GlassCard
                                    key={t.id}
                                    hoverEffect
                                    onClick={() => handleOpenTask(t)}
                                    className={`border-l-4 cursor-pointer flex flex-col justify-between p-4 ${t.status === 'COMPLETED' ? 'border-l-emerald-500' : 'border-l-[var(--role-primary)]'}`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                                            <Badge variant={t.priority.toLowerCase() as any}>{t.priority}</Badge>
                                            <Badge variant={statusBadgeVariant(t.status)}>{STATUS_LABELS[t.status] || t.status}</Badge>
                                        </div>

                                        <h3 className="text-sm font-bold text-slate-900 mb-1truncate">{t.title}</h3>
                                        {t.description && (
                                            <p className="text-slate-500 text-[11px] line-clamp-2 mb-3">{t.description}</p>
                                        )}

                                        {t.status === 'REJECTED' && (
                                            <div className="mb-3 p-2.5 rounded-lg bg-rose-50 border border-rose-100 text-[10px] text-rose-700">
                                                <p className="font-semibold flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Changes Requested</p>
                                                <p className="truncate mt-0.5">"{t.review_comment || 'Rework required'}"</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2 mt-3 pt-3 border-t border-slate-100">
                                        <div className="flex items-center justify-between text-[10px]">
                                            <span style={{ color: 'var(--role-text-muted)' }}>Sprint:</span>
                                            <span className="font-semibold" style={{ color: 'var(--role-primary)' }}>{t.sprint_name || 'No Sprint'}</span>
                                        </div>
                                        {t.due_date && (
                                            <div className="flex items-center justify-between text-[10px]">
                                                <span style={{ color: 'var(--role-text-muted)' }}>Due:</span>
                                                <span className="font-mono">{t.due_date}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between text-[10px]">
                                            <span style={{ color: 'var(--role-text-muted)' }}>Story Points:</span>
                                            <span className="font-mono font-semibold" style={{ color: 'var(--role-primary)' }}>{t.story_points} SP</span>
                                        </div>
                                    </div>

                                    <div className="pt-3">
                                        <div className="flex justify-between items-center text-[10px] mb-1">
                                            <span style={{ color: 'var(--role-text-muted)' }}>Progress</span>
                                            <span className="font-bold" style={{ color: t.status === 'COMPLETED' ? '#10B981' : 'var(--role-primary)' }}>{t.progress}%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full" style={{ width: `${t.progress}%`, backgroundColor: t.status === 'COMPLETED' ? '#10B981' : 'var(--role-primary)' }} />
                                        </div>
                                    </div>
                                </GlassCard>
                            ))}
                        </div>
                    )}
                </div>

                {/* Sprints & Team column */}
                <div className="space-y-6">
                    {/* Active Sprint Section */}
                    <Card title="Current Sprint" icon={<Layers className="w-4 h-4" />}>
                        {activeSprint ? (
                            <div className="space-y-3">
                                <div>
                                    <h4 className="text-xs font-bold" style={{ color: 'var(--role-text-heading)' }}>{activeSprint.name}</h4>
                                    {activeSprint.goal && (
                                        <p className="text-[11px] mt-1" style={{ color: 'var(--role-text-muted)' }}>Goal: {activeSprint.goal}</p>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-[10px] pt-1.5 border-t" style={{ borderColor: 'var(--role-border-subtle)' }}>
                                    <div>
                                        <span className="block" style={{ color: 'var(--role-text-muted)' }}>Start Date</span>
                                        <strong style={{ color: 'var(--role-text-heading)' }}>{formatDateLocal(activeSprint.start_date)}</strong>
                                    </div>
                                    <div>
                                        <span className="block" style={{ color: 'var(--role-text-muted)' }}>End Date</span>
                                        <strong style={{ color: 'var(--role-text-heading)' }}>{formatDateLocal(activeSprint.end_date)}</strong>
                                    </div>
                                </div>
                                <div className="pt-1">
                                    <Badge variant="healthy">ACTIVE</Badge>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-4">
                                <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                <p className="text-xs font-medium" style={{ color: 'var(--role-text-muted)' }}>No active sprints for this project.</p>
                            </div>
                        )}
                    </Card>

                    {/* Project Team Section */}
                    <Card title="Project Team" icon={<Users className="w-4 h-4" />} className="space-y-3.5">
                        {team.length === 0 ? (
                            <p className="text-xs" style={{ color: 'var(--role-text-muted)' }}>No other members in this project.</p>
                        ) : (
                            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                                {team.map((m) => (
                                    <div key={m.id} className="flex items-center gap-3">
                                        <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold text-white uppercase" style={{ background: 'var(--role-primary)' }}>
                                            {m.full_name ? m.full_name.substring(0, 2) : 'SP'}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-semibold truncate" style={{ color: 'var(--role-text-heading)' }}>{m.full_name}</p>
                                            <p className="text-[10px] truncate" style={{ color: 'var(--role-text-muted)' }}>{m.email} · {m.role_in_project}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            {/* Task Workbench Modal */}
            <Modal
                isOpen={!!selectedTask}
                onClose={() => setSelectedTask(null)}
                title={selectedTask?.title || "Task Detail Workbench"}
                maxWidth="max-w-3xl"
            >
                {selectedTask && (
                    <div className="space-y-6">
                        {notice && (
                            <div className={`px-4 py-3 rounded-xl border text-xs font-medium ${notice.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                                {notice.text}
                            </div>
                        )}

                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                                <Badge variant={statusBadgeVariant(selectedTask.status)}>{STATUS_LABELS[selectedTask.status] || selectedTask.status}</Badge>
                                {selectedTask.submitted_at && selectedTask.status === 'REVIEW_PENDING' && (
                                    <span className="text-[10px] text-amber-600 font-medium">Submitted {formatDateTime(selectedTask.submitted_at)}</span>
                                )}
                                {selectedTask.reviewed_at && (
                                    <span className="text-[10px] text-slate-500 font-medium">Reviewed {formatDateTime(selectedTask.reviewed_at)}</span>
                                )}
                            </div>
                            <p className="text-slate-600 leading-relaxed pt-1">{selectedTask.description || 'No task description available.'}</p>
                            <div className="flex flex-wrap gap-4 text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                                <span>Story Points: <strong style={{ color: 'var(--role-primary)' }}>{selectedTask.story_points} SP</strong></span>
                                <span>Est. Hours: <strong style={{ color: 'var(--role-primary)' }}>{selectedTask.estimated_hours}h</strong></span>
                            </div>
                        </div>

                        {selectedTask.status === 'REJECTED' && (
                            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs">
                                <p className="font-bold text-rose-800 mb-1 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> Changes Requested</p>
                                <p className="text-rose-700 leading-relaxed">{selectedTask.review_comment || 'Please revise this task and resubmit.'}</p>
                                <p className="text-[10px] text-rose-500 mt-2">Reviewed {formatDateTime(selectedTask.reviewed_at)}</p>
                            </div>
                        )}

                        {selectedTask.status === 'COMPLETED' && (
                            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                                <p className="font-bold text-emerald-800 mb-1 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Approved</p>
                                {selectedTask.review_comment && <p className="text-emerald-700 leading-relaxed">"{selectedTask.review_comment}"</p>}
                                <p className="text-[10px] text-emerald-500 mt-2">Approved {formatDateTime(selectedTask.reviewed_at)}</p>
                            </div>
                        )}

                        {/* Progress Controls */}
                        {isLocked(selectedTask) ? (
                            <div className="glass-card p-5 rounded-2xl border text-center" style={{ borderColor: 'var(--role-border)' }}>
                                <p className="text-sm font-semibold text-slate-700">
                                    {selectedTask.status === 'REVIEW_PENDING'
                                        ? 'This task is awaiting manager review. Progress is locked until it is reviewed.'
                                        : 'This task has been approved and completed.'}
                                </p>
                            </div>
                        ) : (
                            <div className="glass-card p-5 rounded-2xl space-y-4 border" style={{ borderColor: 'var(--role-border)' }}>
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-slate-900 text-sm">Update Task Progress (0% to 100%)</h4>
                                    <span className="text-xl font-bold font-mono" style={{ color: 'var(--role-primary)' }}>{progressVal}%</span>
                                </div>

                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="10"
                                    value={progressVal}
                                    onChange={(e) => setProgressVal(parseInt(e.target.value))}
                                    className="w-full h-3 bg-white rounded-lg appearance-none cursor-pointer accent-[var(--role-primary)]"
                                />

                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Status Transition</label>
                                        <select
                                            value={statusVal}
                                            onChange={(e) => setStatusVal(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none"
                                        >
                                            <option value="NOT_STARTED">Not Started</option>
                                            <option value="IN_PROGRESS">In Progress</option>
                                            <option value="TESTING">Testing</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Progress Notes</label>
                                        <input
                                            type="text"
                                            value={updateNotes}
                                            onChange={(e) => setUpdateNotes(e.target.value)}
                                            placeholder="e.g. Unit tests passing 100%"
                                            className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-between items-center pt-2 flex-wrap gap-2">
                                    <Button variant="outline" size="sm" icon={<RefreshCw className="w-4 h-4 cursor-pointer" />} onClick={handleSaveProgress}>
                                        Save Progress Snapshot
                                    </Button>
                                    <Button
                                        variant="developer"
                                        size="sm"
                                        icon={<Send className="w-4 h-4" />}
                                        disabled={progressVal < 100}
                                        onClick={handleSubmitForReview}
                                    >
                                        {progressVal < 100 ? 'Reach 100% to Submit' : 'Submit Task for Manager Review'}
                                    </Button>
                                </div>
                                {progressVal < 100 && (
                                    <p className="text-[10px] text-amber-600 flex items-center gap-1"><AlertCircle className="w-3 h-3 animate-bounce" /> Tasks can only be submitted for review at 100% completion.</p>
                                )}
                            </div>
                        )}

                        {/* Comment Thread */}
                        <div className="space-y-4">
                            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" style={{ color: 'var(--role-primary)' }} /> Developer Comments ({comments.length})
                            </h4>

                            <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                                {comments.map((c) => (
                                    <div key={c.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-semibold text-slate-900">{(c as TaskComment).author_name}</span>
                                            <span className="text-[10px] text-slate-500">{new Date((c as TaskComment).created_at).toLocaleString()}</span>
                                        </div>
                                        <p className="text-slate-600">{(c as TaskComment).content}</p>
                                    </div>
                                ))}
                            </div>

                            <form onSubmit={handleAddComment} className="flex gap-2">
                                <input
                                    type="text"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Write comment or note..."
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none"
                                />
                                <Button type="submit" variant="developer" size="sm">Post</Button>
                            </form>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
