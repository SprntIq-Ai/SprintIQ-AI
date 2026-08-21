import React, { useEffect, useState } from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { managerService } from '../../services/api';
import { GitPullRequest, CheckCircle2, XCircle, AlertCircle, MessageSquare, Paperclip, Clock } from 'lucide-react';
import { InitialsAvatar } from '../../components/common/InitialsAvatar';

type Notice = { type: 'success' | 'error'; text: string } | null;

const formatDate = (d?: string) => (d ? new Date(d).toLocaleString() : 'N/A');

export const ReviewQueue: React.FC = () => {
  const [reviews, setReviews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [feedback, setFeedback] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const loadReviews = async () => {
    setIsLoading(true);
    try {
      const data = await managerService.getReviews();
      setReviews(data);
    } catch (e) {
      console.error(e);
      setNotice({ type: 'error', text: 'Failed to load the review queue.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, []);

  const handleDecision = async (taskId: string, action: string) => {
    if (action !== 'APPROVE' && !feedback.trim()) {
      setNotice({ type: 'error', text: 'Please provide review feedback before requesting changes or rejecting.' });
      return;
    }
    setPendingAction(taskId);
    try {
      await managerService.decideReview(taskId, action, feedback);
      setNotice({ type: 'success', text: action === 'APPROVE' ? 'Task approved and moved to the developer Completed Tasks.' : 'Changes requested — task returned to the developer.' });
      setSelectedTask(null);
      setFeedback('');
      loadReviews();
    } catch (e: any) {
      setNotice({ type: 'error', text: e?.response?.data?.detail || 'Failed to record review decision' });
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          Developer Submission Review Queue <GitPullRequest className="w-7 h-7 text-amber-400" />
        </h1>
        <p className="text-xs text-slate-500 mt-1">Approve completed submissions to move them to developer Completed Tasks, or return them for changes.</p>
      </div>

      {notice && (
        <div className={`px-4 py-3 rounded-xl border text-xs font-medium ${notice.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
          {notice.text}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => <div key={i} className="h-64 role-skeleton rounded-2xl" />)}
        </div>
      ) : reviews.length === 0 ? (
        <GlassCard className="text-center py-12">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900">Review Queue is Clear!</h3>
          <p className="text-xs text-slate-500 mt-1">No developer task submissions awaiting your verification.</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reviews.map((r) => (
            <GlassCard key={r.task_id} className="space-y-4 border-l-4 border-l-amber-500">
              <div className="flex items-center justify-between">
                <Badge variant="at_risk">SUBMITTED FOR REVIEW</Badge>
                <span className="text-[11px] text-slate-500 font-mono">{r.project_name}</span>
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-1">{r.title}</h3>
                <p className="text-slate-600 text-xs line-clamp-2">{r.description}</p>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <InitialsAvatar name={r.developer_name} role="developer" size={32} />
                <div>
                  <p className="font-semibold text-slate-900">{r.developer_name}</p>
                  <p className="text-slate-500 text-[11px]">{r.progress}% Completed • {r.story_points} SP</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-1.5 text-slate-600">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> Submitted {formatDate(r.submitted_at)}
                </div>
                <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-1.5 text-slate-600">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" /> {r.comments_count ?? 0} comments
                </div>
                <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-1.5 text-slate-600">
                  <Paperclip className="w-3.5 h-3.5 text-slate-400" /> {r.attachments_count ?? 0} files
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <textarea
                  rows={2}
                  value={selectedTask?.task_id === r.task_id ? feedback : ''}
                  onChange={(e) => {
                    setSelectedTask(r);
                    setFeedback(e.target.value);
                  }}
                  placeholder="Review feedback for the developer (required to request changes)..."
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none"
                />

                <div className="flex items-center gap-2">
                  <Button
                    variant="manager"
                    size="sm"
                    icon={<CheckCircle2 className="w-4 h-4" />}
                    onClick={() => handleDecision(r.task_id, 'APPROVE')}
                    disabled={pendingAction === r.task_id}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500"
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<AlertCircle className="w-4 h-4 text-amber-400" />}
                    onClick={() => handleDecision(r.task_id, 'REQUEST_CHANGES')}
                    disabled={pendingAction === r.task_id}
                    className="flex-1"
                  >
                    Request Changes
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<XCircle className="w-4 h-4" />}
                    onClick={() => handleDecision(r.task_id, 'REJECT')}
                    disabled={pendingAction === r.task_id}
                    className="flex-1"
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
};