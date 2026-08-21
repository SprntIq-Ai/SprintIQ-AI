import React, { useEffect, useState } from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { developerService } from '../../services/api';
import { Task, Comment as TaskComment } from '../../types';
import { ListTodo, Upload, Send, CheckCircle2, Clock, MessageSquare, Paperclip, AlertCircle, Play, Archive, RefreshCw } from 'lucide-react';

type Notice = { type: 'success' | 'error'; text: string } | null;

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

const formatDate = (d?: string) => (d ? new Date(d).toLocaleString() : 'N/A');

export const MyTasks: React.FC = () => {
  const [tab, setTab] = useState<'active' | 'completed'>('active');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);

  // Progress update state
  const [progressVal, setProgressVal] = useState<number>(0);
  const [statusVal, setStatusVal] = useState<string>('IN_PROGRESS');
  const [updateNotes, setUpdateNotes] = useState<string>('');

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const [list, completed] = await Promise.all([
        developerService.getTasks(),
        developerService.getCompletedTasks(),
      ]);
      setTasks(list);
      setCompletedTasks(completed);
    } catch (e) {
      console.error(e);
      setNotice({ type: 'error', text: 'Failed to load tasks.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleOpenTask = async (task: Task) => {
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

  const isLocked = (task: Task) => task.status === 'REVIEW_PENDING' || task.status === 'COMPLETED';

  const handleSaveProgress = async () => {
    if (!selectedTask) return;
    try {
      await developerService.updateProgress(selectedTask.id, progressVal, statusVal, updateNotes);
      setNotice({ type: 'success', text: 'Progress saved successfully!' });
      loadTasks();
      setSelectedTask((prev) => (prev ? { ...prev, progress: progressVal, status: statusVal as any } : null));
    } catch (e: any) {
      setNotice({ type: 'error', text: e?.response?.data?.detail || 'Failed to update task progress' });
    }
  };

  const handleSubmitForReview = async () => {
    if (!selectedTask) return;
    try {
      await developerService.submitTask(selectedTask.id);
      setNotice({ type: 'success', text: 'Task submitted to Project Manager for review!' });
      loadTasks();
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
    } catch (e) {
      setNotice({ type: 'error', text: 'Failed to post comment' });
    }
  };

  const renderTaskCard = (t: Task, completed: boolean) => (
    <GlassCard
      key={t.id}
      hoverEffect
      onClick={() => handleOpenTask(t)}
      className={`border-l-4 flex flex-col justify-between ${completed ? 'border-l-emerald-500' : 'border-l-[var(--role-primary)]'}`}
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <Badge variant={t.priority.toLowerCase() as any}>{t.priority}</Badge>
          <Badge variant={statusBadgeVariant(t.status)}>{STATUS_LABELS[t.status] || t.status}</Badge>
        </div>

        <h3 className="text-lg font-bold text-slate-900 mb-2">{t.title}</h3>
        <p className="text-slate-500 text-xs line-clamp-2 mb-4">{t.description || "No description."}</p>

        {t.status === 'REJECTED' && (
          <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-700">
            <p className="font-semibold mb-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Review feedback from {t.reviewed_by_name || 'Project Manager'}</p>
            <p className="leading-relaxed">{t.review_comment || 'Please revise this task and resubmit.'}</p>
          </div>
        )}

        {completed && t.reviewed_at && (
          <div className="mb-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-700">
            <p className="font-semibold mb-1 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Approved by {t.reviewed_by_name || 'Project Manager'} on {formatDate(t.reviewed_at)}</p>
            {t.review_comment && <p className="leading-relaxed">"{t.review_comment}"</p>}
          </div>
        )}

        <div className="space-y-2 text-xs border-t border-slate-200 pt-3">
          <div className="flex justify-between text-slate-600">
            <span className="text-slate-500">Project / Sprint:</span>
            <span className="font-semibold" style={{ color: 'var(--role-primary)' }}>{t.project_name} ({t.sprint_name || "No Sprint"})</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span className="text-slate-500">Due Date:</span>
            <span className="font-mono text-slate-500">{t.due_date || "N/A"}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-200">
        <div className="flex justify-between text-[11px] mb-1">
          <span className="text-slate-500">Completion</span>
          <span className="font-bold" style={{ color: completed ? '#10B981' : 'var(--role-primary)' }}>{t.progress}%</span>
        </div>
        <div className="w-full h-2 bg-white rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${t.progress}%`, backgroundColor: completed ? '#10B981' : 'var(--role-primary)' }} />
        </div>
      </div>
    </GlassCard>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">My Assigned Tasks</h1>
          <p className="text-xs text-slate-500 mt-1">Active tasks stay here until the Project Manager approves them, then they move to Completed Tasks.</p>
        </div>

        <div className="flex items-center gap-2 rounded-xl p-1 bg-slate-100 border border-slate-200">
          <button
            onClick={() => setTab('active')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${tab === 'active' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <ListTodo className="w-4 h-4" /> Active ({tasks.length})
          </button>
          <button
            onClick={() => setTab('completed')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${tab === 'completed' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Archive className="w-4 h-4" /> Completed ({completedTasks.length})
          </button>
        </div>
      </div>

      {notice && (
        <div className={`px-4 py-3 rounded-xl border text-xs font-medium ${notice.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
          {notice.text}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => <div key={i} className="h-56 role-skeleton rounded-2xl" />)}
        </div>
      ) : tab === 'active' && tasks.length === 0 ? (
        <GlassCard className="text-center py-12">
          <ListTodo className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900">No Active Tasks</h3>
          <p className="text-xs text-slate-500 mt-1">Tasks assigned to you will appear here until approved.</p>
        </GlassCard>
      ) : tab === 'completed' && completedTasks.length === 0 ? (
        <GlassCard className="text-center py-12">
          <Archive className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900">No Completed Tasks Yet</h3>
          <p className="text-xs text-slate-500 mt-1">Manager-approved tasks will be archived here.</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(tab === 'active' ? tasks : completedTasks).map((t) => renderTaskCard(t, tab === 'completed'))}
        </div>
      )}

      {/* Task Detail Workbench Modal */}
      <Modal
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        title={selectedTask?.title || "Task Detail Workbench"}
        maxWidth="max-w-3xl"
      >
        {selectedTask && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <Badge variant={statusBadgeVariant(selectedTask.status)}>{STATUS_LABELS[selectedTask.status] || selectedTask.status}</Badge>
                {selectedTask.submitted_at && selectedTask.status === 'REVIEW_PENDING' && (
                  <span className="text-[10px] text-amber-600 font-medium">Submitted {formatDate(selectedTask.submitted_at)}</span>
                )}
                {selectedTask.reviewed_at && (
                  <span className="text-[10px] text-slate-500 font-medium">Reviewed {formatDate(selectedTask.reviewed_at)}</span>
                )}
              </div>
              <p className="text-slate-600 leading-relaxed pt-1">{selectedTask.description}</p>
              <div className="flex flex-wrap gap-4 text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                <span>Project: <strong className="text-slate-900">{selectedTask.project_name}</strong></span>
                <span>Story Points: <strong style={{ color: 'var(--role-primary)' }}>{selectedTask.story_points} SP</strong></span>
                <span>Est. Hours: <strong style={{ color: 'var(--role-primary)' }}>{selectedTask.estimated_hours}h</strong></span>
              </div>
            </div>

            {selectedTask.status === 'REJECTED' && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs">
                <p className="font-bold text-rose-800 mb-1 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> Changes Requested by {selectedTask.reviewed_by_name || 'Project Manager'}</p>
                <p className="text-rose-700 leading-relaxed">{selectedTask.review_comment || 'Please revise this task and resubmit.'}</p>
                <p className="text-[10px] text-rose-500 mt-2">Reviewed {formatDate(selectedTask.reviewed_at)}</p>
              </div>
            )}

            {selectedTask.status === 'COMPLETED' && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                <p className="font-bold text-emerald-800 mb-1 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Approved by {selectedTask.reviewed_by_name || 'Project Manager'}</p>
                {selectedTask.review_comment && <p className="text-emerald-700 leading-relaxed">"{selectedTask.review_comment}"</p>}
                <p className="text-[10px] text-emerald-500 mt-2">Approved {formatDate(selectedTask.reviewed_at)}</p>
              </div>
            )}

            {/* Progress Controls - locked while awaiting review / approved */}
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
                      className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs"
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
                      className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <Button variant="outline" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={handleSaveProgress}>
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
                  <p className="text-[10px] text-amber-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Tasks can only be submitted for review at 100% completion.</p>
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