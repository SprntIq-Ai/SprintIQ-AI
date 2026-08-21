import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Sparkles, CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { aiService, taskService, projectService } from '../../services/api';
import { AITaskDetails } from '../../types';

interface AITaskGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  onTaskCreated?: () => void;
}

export const AITaskGeneratorModal: React.FC<AITaskGeneratorModalProps> = ({
  isOpen,
  onClose,
  projectId,
  onTaskCreated
}) => {
  const [title, setTitle] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aiDetails, setAiDetails] = useState<AITaskDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Resolve the currently selected project. Never send "default"/empty as a FK.
  const resolveProjectId = async (): Promise<string | null> => {
    if (projectId && projectId !== 'default' && projectId.trim() !== '') {
      return projectId;
    }
    try {
      const projects = await projectService.getAll();
      return projects[0]?.id || null;
    } catch (e) {
      return null;
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsGenerating(true);
    setError(null);
    setSuccess(null);
    setAiDetails(null);
    try {
      const pid = await resolveProjectId();
      const res = await aiService.generateTask(title, pid || undefined);
      // Gemini may omit the title; fall back to the user-entered title.
      setAiDetails({ ...res, title: res.title || title });
    } catch (e) {
      console.error(e);
      setError('Failed to generate task with AI');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateTask = async () => {
    if (!aiDetails) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const pid = await resolveProjectId();
      if (!pid) {
        setError('No project selected. Please select a project first.');
        return;
      }

      await taskService.create({
        title: aiDetails.title || title,
        description: `${aiDetails.description}\n\nAcceptance Criteria:\n- ${aiDetails.acceptance_criteria.join('\n- ')}\n\nTechnical Notes: ${aiDetails.technical_notes}`,
        priority: aiDetails.priority,
        project_id: pid,
        estimated_hours: aiDetails.estimated_hours,
        story_points: aiDetails.story_points,
        use_active_sprint: true
      });
      setSuccess('AI task added to backlog successfully.');
      setTitle('');
      setAiDetails(null);
      setTimeout(() => {
        onClose();
        if (onTaskCreated) onTaskCreated();
      }, 1200);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d: any) => `${d.loc?.join('.')}: ${d.msg}`).join('; ')
        : detail || 'Failed to create task';
      console.error('Create AI task error:', e?.response?.status, msg);
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI Task Generator (Gemini Powered)" maxWidth="max-w-2xl">
      <div className="space-y-5">
        <form onSubmit={handleGenerate} className="space-y-3">
          <label className="block text-xs font-semibold text-slate-600">Enter Feature or Bug Task Title</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Implement OAuth2 Refresh Token Rotation Engine"
              className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-ai)] transition-colors"
              required
            />
            <Button type="submit" variant="ai" isLoading={isGenerating} icon={<Sparkles className="w-4 h-4" />}>
              Generate Task
            </Button>
          </div>
        </form>

        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold">Failed to create task</p>
              <p className="break-words mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4" /> {success}
          </div>
        )}

        {aiDetails && (
          <div className="space-y-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="font-bold text-slate-900 text-sm">{aiDetails.title}</span>
              <div className="flex gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold">{aiDetails.priority}</span>
                <span className="px-2 py-0.5 rounded bg-[rgba(var(--role-action-rgb),0.10)] text-[var(--role-action)] font-semibold">{aiDetails.story_points} SP</span>
                <span className="px-2 py-0.5 rounded bg-[rgba(var(--role-accent-rgb),0.10)] text-[var(--role-accent)] font-semibold">{aiDetails.estimated_hours}h</span>
              </div>
            </div>

            <div>
              <p className="font-semibold text-slate-600 mb-1">Description:</p>
              <p className="text-slate-500 leading-relaxed">{aiDetails.description}</p>
            </div>

            <div>
              <p className="font-semibold text-slate-600 mb-1">Acceptance Criteria:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-500">
                {aiDetails.acceptance_criteria.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-semibold text-slate-600 mb-1">Technical Notes:</p>
              <p className="font-mono text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-200" style={{ color: 'var(--role-secondary)' }}>{aiDetails.technical_notes}</p>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="ai" onClick={handleCreateTask} isLoading={isSaving} icon={<CheckCircle2 className="w-4 h-4" />}>
                Save AI Task to Backlog
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};