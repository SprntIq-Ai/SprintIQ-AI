import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Sparkles, CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { aiService, taskService, projectService, managerService } from '../../services/api';
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
  const [targetProjectId, setTargetProjectId] = useState<string>(projectId || '');
  const [projectList, setProjectList] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aiDetails, setAiDetails] = useState<AITaskDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(null);
      // Fetch accessible projects
      const loadProjs = async () => {
        let projs: any[] = [];
        try {
          projs = await managerService.getProjects();
        } catch {
          try {
            projs = await projectService.getAll();
          } catch {}
        }
        setProjectList(projs || []);
        if (projectId && projectId.trim() !== '') {
          setTargetProjectId(projectId);
        } else if (projs && projs.length > 0 && !targetProjectId) {
          setTargetProjectId(projs[0].id);
        }
      };
      loadProjs();
    }
  }, [isOpen, projectId]);

  const resolveProjectId = (): string | null => {
    if (targetProjectId && targetProjectId !== 'default' && targetProjectId.trim() !== '') {
      return targetProjectId;
    }
    if (projectList && projectList.length > 0) {
      return projectList[0].id;
    }
    return null;
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsGenerating(true);
    setError(null);
    setSuccess(null);
    setAiDetails(null);
    try {
      const pid = resolveProjectId();
      const res = await aiService.generateTask(title, pid || undefined);
      setAiDetails({ ...res, title: res.title || title });
    } catch (e: any) {
      console.error("AI Task Generation error:", e);
      setError(e?.response?.data?.detail || 'Failed to generate task with AI. Please try again.');
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
      const pid = resolveProjectId();
      if (!pid) {
        setError('No project selected. Please select a target project.');
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
          {projectList.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Target Project</label>
              <select
                value={targetProjectId}
                onChange={(e) => setTargetProjectId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-ai)]"
              >
                {projectList.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.key || 'PROJ'})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Enter Feature or Bug Task Title</label>
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
          </div>
        </form>

        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold">Error</p>
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
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-semibold">{aiDetails.priority}</span>
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">{aiDetails.story_points} SP</span>
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-semibold">{aiDetails.estimated_hours}h</span>
              </div>
            </div>

            <div>
              <p className="font-semibold text-slate-700 mb-1">Description:</p>
              <p className="text-slate-600 leading-relaxed">{aiDetails.description}</p>
            </div>

            <div>
              <p className="font-semibold text-slate-700 mb-1">Acceptance Criteria:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-600">
                {aiDetails.acceptance_criteria.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-semibold text-slate-700 mb-1">Technical Notes:</p>
              <p className="font-mono text-[11px] bg-white p-2.5 rounded-lg border border-slate-200 text-slate-700">{aiDetails.technical_notes}</p>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200">
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