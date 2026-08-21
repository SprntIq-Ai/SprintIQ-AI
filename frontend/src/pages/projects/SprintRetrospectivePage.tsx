import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Sparkles, CheckCircle2, AlertCircle, ShieldCheck, RefreshCw } from 'lucide-react';
import { intelligenceService } from '../../services/intelligenceService';

export const SprintRetrospectivePage: React.FC = () => {
  const { id, sprintId } = useParams<{ id: string; sprintId: string }>();
  const projectId = id || 'demo-project-id';
  const currentSprintId = sprintId || 'demo-sprint-id';

  const [loading, setLoading] = useState(true);
  const [retro, setRetro] = useState<any>(null);

  useEffect(() => {
    intelligenceService.generateRetrospective(projectId, currentSprintId)
      .then(setRetro)
      .finally(() => setLoading(false));
  }, [projectId, currentSprintId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-slate-500">
        <RefreshCw className="w-7 h-7 animate-spin mb-2" style={{ color: 'var(--role-primary)' }} />
        <p className="text-xs">Generating AI Sprint Retrospective with Gemini...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="role-icon-chip p-2.5 rounded-xl">
            <Sparkles className="w-6 h-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">AI Sprint Retrospective</h1>
            <p className="text-sm text-slate-500">Feature 8 — Gemini Sprint Analysis & Recommendations</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
          <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> What Went Well
          </h3>
          <ul className="space-y-2 text-xs text-slate-600">
            {retro?.what_went_well?.map((item: string, idx: number) => (
              <li key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200">• {item}</li>
            ))}
          </ul>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
          <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> What Did Not Go Well & Root Causes
          </h3>
          <ul className="space-y-2 text-xs text-slate-600">
            {retro?.what_did_not_go_well?.map((item: string, idx: number) => (
              <li key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200">• {item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
