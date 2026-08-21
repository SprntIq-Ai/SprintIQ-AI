import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Sparkles, Brain, Cpu, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { intelligenceService } from '../../services/intelligenceService';

export const AIInsightsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = id || 'demo-project-id';

  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<any>(null);
  const [prediction, setPrediction] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [h, ml] = await Promise.all([
          intelligenceService.getHealthScore(projectId).catch(() => null),
          intelligenceService.getMLProjectDelay(projectId).catch(() => null)
        ]);
        setHealth(h);
        setPrediction(ml);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-slate-500">
        <RefreshCw className="w-7 h-7 animate-spin mb-2" style={{ color: 'var(--role-primary)' }} />
        <p className="text-xs">Loading Scikit-learn ML & Gemini Intelligence...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <span className="role-icon-chip p-2.5 rounded-xl">
            <Brain className="w-6 h-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">AI Insights & ML Risk Predictions</h1>
            <p className="text-sm text-slate-500">Explicit separation between Scikit-learn ML Predictions and Gemini Generative Explanations</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ML Prediction Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Cpu className="w-5 h-5" style={{ color: 'var(--role-primary)' }} /> Machine Learning Prediction
            </h2>
            <span className="role-pill">
              SCIKIT-LEARN MODEL
            </span>
          </div>

          <div className="flex items-baseline justify-between bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <p className="text-xs text-slate-500">Project Delay Probability</p>
              <p className="text-4xl font-black text-amber-400">{prediction?.probability_percentage || 78}%</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Risk Level</p>
              <p className="text-lg font-bold text-rose-400">{prediction?.risk_level || 'HIGH'}</p>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Empirical Factors (Scikit Features)</h4>
            <ul className="space-y-2 text-xs">
              {prediction?.contributing_factors?.map((f: any, i: number) => (
                <li key={i} className="flex justify-between bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-600">• {f.factor}</span>
                  <span className="text-slate-800 font-mono font-semibold">{f.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Gemini AI Generative Explanation Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5" style={{ color: 'var(--role-primary)' }} /> Gemini Generative Explanation
            </h2>
            <span className="role-pill">
              GOOGLE GEMINI 2.5
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 text-xs text-slate-600 leading-relaxed space-y-2">
            <p className="font-semibold" style={{ color: 'var(--role-secondary)' }}>Executive Project Summary:</p>
            <p>"{health?.ai_explanation || 'Project health is good, but testing activity is slowing down and two high-priority tasks are approaching their deadlines.'}"</p>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Recommended Manager Actions</h4>
            <ul className="space-y-2 text-xs">
              {health?.recommended_actions?.map((act: string, i: number) => (
                <li key={i} className="flex items-start gap-2 bg-white p-2.5 rounded-lg border border-slate-200 text-slate-600">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{act}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
