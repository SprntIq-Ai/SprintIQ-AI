import React, { useEffect, useState } from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { sprintService, projectService, aiService } from '../../services/api';
import { Sprint, Project, AISprintPlan } from '../../types';
import { Layers, Plus, Calendar, Target, CheckCircle2, Sparkles, UserCheck, Flame } from 'lucide-react';

export const SprintPlanner: React.FC = () => {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiPlan, setAiPlan] = useState<AISprintPlan | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [projectId, setProjectId] = useState('');

  const loadSprints = async () => {
    setIsLoading(true);
    try {
      const [sList, pList] = await Promise.all([
        sprintService.getAll(),
        projectService.getAll(),
      ]);
      setSprints(sList);
      setProjects(pList);
      if (pList.length > 0 && !projectId) {
        setProjectId(pList[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSprints();
  }, []);

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sprintService.create({
        name,
        goal,
        start_date: startDate,
        end_date: endDate,
        project_id: projectId,
      });
      setIsModalOpen(false);
      setName('');
      setGoal('');
      setStartDate('');
      setEndDate('');
      loadSprints();
    } catch (err: any) {
      alert("Failed to create sprint");
    }
  };

  const handleGenerateAiSprint = async () => {
    if (!projectId) return;
    setIsGeneratingAi(true);
    try {
      const res = await aiService.planSprint({ project_id: projectId, target_focus: "Velocity & Feature Delivery" });
      setAiPlan(res);
    } catch (e) {
      alert("AI Sprint Planning failed");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleApplyAiSprint = async () => {
    if (!aiPlan || !projectId) return;
    try {
      await sprintService.create({
        name: `Sprint AI - ${aiPlan.goal.slice(0, 30)}...`,
        goal: aiPlan.goal,
        start_date: new Date().toISOString().split('T')[0],
        end_date: aiPlan.estimated_completion_date,
        project_id: projectId,
      });
      alert("AI Sprint Plan applied successfully!");
      setIsAiModalOpen(false);
      setAiPlan(null);
      loadSprints();
    } catch (e) {
      alert("Failed to apply AI Sprint");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            AI Sprint Planner <Badge variant="ai">Gemini Powered</Badge>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Plan sprint goals, generate AI story point allocation, and manage active sprint milestones</p>
        </div>

        <div className="flex gap-3">
          <Button variant="ai" icon={<Sparkles className="w-4 h-4" />} onClick={() => setIsAiModalOpen(true)}>
            AI Sprint Generator
          </Button>
          <Button variant="outline" icon={<Plus className="w-4 h-4" />} onClick={() => setIsModalOpen(true)}>
            Manual Sprint
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {sprints.map((s) => {
          const derived = s.derived_status || s.status;
          const isCompleted = derived === 'COMPLETED';
          const progress = s.progress_percentage || 0;
          const remaining = (s.total_tasks || 0) - (s.completed_tasks || 0);

          return (
            <GlassCard key={s.id} hoverEffect className="border-l-4 border-l-emerald-500 space-y-4 flex flex-col">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isCompleted && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                  <Badge variant={
                    derived === 'COMPLETED' ? 'completed' :
                      derived === 'OVERDUE' ? 'critical' :
                        derived === 'ACTIVE' ? 'in_progress' :
                          derived === 'CANCELLED' ? 'default' : 'pending'
                  }>{derived}</Badge>
                </div>
                <span className="text-xs text-slate-500 font-mono">{s.start_date} to {s.end_date}</span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">{s.name}</h3>
                <p className="text-slate-600 text-xs flex items-start gap-1.5 leading-relaxed">
                  <Target className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{s.goal || "No explicit goal set."}</span>
                </p>
              </div>

              <div className="mt-auto pt-4 border-t border-slate-100 w-full">
                <div className="flex justify-between text-[11px] text-slate-500 mb-1 font-medium">
                  <span>Progress: {progress}%</span>
                  <span>{s.completed_tasks || 0} / {s.total_tasks || 0} Tasks Completed</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 mb-2 overflow-hidden">
                  <div className="bg-emerald-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>

                {isCompleted ? (
                  <p className="text-[10px] text-emerald-600 font-bold flex items-center justify-end gap-1">
                    <CheckCircle2 className="w-3 h-3" /> All tasks verified by manager
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 text-right">
                    {s.total_tasks === 0 ? "No tasks assigned" : `Remaining: ${remaining} Tasks | Rejected: ${s.rejected_tasks || 0}`}
                  </p>
                )}
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Manual Sprint Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Sprint">
        <form onSubmit={handleCreateSprint} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Target Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.key})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Sprint Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sprint 3 - Auth Security"
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Sprint Goal</label>
            <textarea
              rows={2}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Primary milestone target..."
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">End Date</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="manager">Create Sprint</Button>
          </div>
        </form>
      </Modal>

      {/* AI Sprint Generator Modal */}
      <Modal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} title="AI Sprint Planner (Gemini Suggested)" maxWidth="max-w-2xl">
        <div className="space-y-4">
          <p className="text-xs text-slate-500">Gemini analyzes project history, velocity, and backlog to suggest optimal sprint goals, story points, duration, developers, and workload distribution.</p>

          <div className="flex justify-start">
            <Button variant="ai" onClick={handleGenerateAiSprint} isLoading={isGeneratingAi} icon={<Sparkles className="w-4 h-4" />}>
              Generate AI Sprint Plan
            </Button>
          </div>

          {aiPlan && (
            <div className="space-y-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div className="border-b border-slate-200 pb-3">
                <p className="font-bold text-slate-900 text-sm">Suggested Goal:</p>
                <p className="text-emerald-400 mt-1 leading-relaxed">{aiPlan.goal}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-slate-600">
                <div>Duration: <strong className="text-slate-900">{aiPlan.duration_weeks} Weeks</strong></div>
                <div>Total Story Points: <strong className="text-emerald-400">{aiPlan.total_story_points} SP</strong></div>
                <div>Est. Completion: <strong className="text-slate-900">{aiPlan.estimated_completion_date}</strong></div>
              </div>

              <div>
                <p className="font-semibold text-slate-900 mb-2">Recommended Tasks:</p>
                <div className="space-y-2">
                  {aiPlan.recommended_tasks.map((t, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">{t.title}</span>
                      <div className="flex gap-2">
                        <span className="px-2 py-0.5 rounded bg-[rgba(var(--role-action-rgb),0.10)] text-[var(--role-action)]">{t.story_points} SP</span>
                        <span className="px-2 py-0.5 rounded bg-[rgba(var(--role-primary-rgb),0.10)] text-[var(--role-primary)]">{t.priority}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="ai" onClick={handleApplyAiSprint} icon={<CheckCircle2 className="w-4 h-4" />}>
                  1-Click Apply AI Sprint Plan
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
