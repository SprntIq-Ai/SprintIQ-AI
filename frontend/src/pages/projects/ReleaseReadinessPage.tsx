import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Rocket, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { intelligenceService } from '../../services/intelligenceService';

export const ReleaseReadinessPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = id || 'demo-project-id';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    intelligenceService.getReleaseReadiness(projectId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-slate-500">
        <RefreshCw className="w-7 h-7 animate-spin text-emerald-500 mb-2" />
        <p className="text-xs">Running Release Readiness Audit...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
            <Rocket className="w-6 h-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">AI Release Readiness Score</h1>
            <p className="text-sm text-slate-500">Pre-release verification audit & check status</p>
          </div>
        </div>
        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold rounded-full uppercase">
          {data?.status || 'READY WITH WARNINGS'}
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-8">
        <div className="text-center">
          <div className="text-6xl font-black text-emerald-400">{data?.readiness_score || 88}</div>
          <p className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-wider">Readiness Score</p>
        </div>

        <div className="flex-1 bg-white p-4 rounded-xl border border-slate-200 text-xs text-slate-600">
          <p className="font-semibold text-emerald-300 mb-1">AI Recommendation:</p>
          <p>"{data?.ai_recommendation || 'Release is possible, but two high-priority reviews should be completed before deployment.'}"</p>
        </div>
      </div>
    </div>
  );
};
