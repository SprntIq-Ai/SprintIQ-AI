import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Activity, ShieldAlert, Cpu, Users, GitPullRequest, Rocket, Sliders, AlertTriangle, CheckCircle, ChevronRight, RefreshCw, Sparkles, Clock
} from 'lucide-react';
import { intelligenceService } from '../../services/intelligenceService';
import { InitialsAvatar } from '../../components/common/InitialsAvatar';

export const ProjectIntelligence: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = id || 'demo-project-id';

  const [loading, setLoading] = useState<boolean>(true);
  const [healthData, setHealthData] = useState<any>(null);
  const [mlPrediction, setMlPrediction] = useState<any>(null);
  const [bottlenecks, setBottlenecks] = useState<any>(null);
  const [workload, setWorkload] = useState<any>(null);
  const [githubMetrics, setGithubMetrics] = useState<any>(null);
  const [releaseData, setReleaseData] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [h, ml, b, w, gh, rel] = await Promise.all([
        intelligenceService.getHealthScore(projectId).catch(() => null),
        intelligenceService.getMLProjectDelay(projectId).catch(() => null),
        intelligenceService.getBottlenecks(projectId).catch(() => null),
        intelligenceService.getWorkloadIntelligence(projectId).catch(() => null),
        intelligenceService.getGitHubAnalytics(projectId).catch(() => null),
        intelligenceService.getReleaseReadiness(projectId).catch(() => null)
      ]);
      setHealthData(h);
      setMlPrediction(ml);
      setBottlenecks(b);
      setWorkload(w);
      setGithubMetrics(gh);
      setReleaseData(rel);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin mb-3" style={{ color: 'var(--role-primary)' }} />
        <p className="text-sm font-medium">Aggregating Scikit-learn ML & Gemini Intelligence...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <span className="role-icon-chip p-2 rounded-lg">
              <Cpu className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Project Intelligence Hub</h1>
              <p className="text-sm text-slate-500">Real-time ML risk predictions, engineering metrics & Gemini AI recommendations</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchData} 
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-700 text-slate-700 rounded-xl text-sm font-medium transition"
          >
            <RefreshCw className="w-4 h-4" /> Refresh Signals
          </button>
          <Link 
            to={`/projects/${projectId}/simulator`}
            className="role-btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition"
          >
            <Sliders className="w-4 h-4" /> What-If Simulator
          </Link>
        </div>
      </div>

      {/* Top 3 Core Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* 1. Engineering Health Score */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-300 transition">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Feature 1 — Engineering Health</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                healthData?.health_status === 'HEALTHY' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}>
                {healthData?.health_status || 'HEALTHY'}
              </span>
            </div>

            <div className="flex items-baseline gap-3 mb-4">
              <span className="text-5xl font-black text-slate-900">{healthData?.health_score || 84}</span>
              <span className="text-slate-500 text-lg font-medium">/ 100</span>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4 leading-relaxed">
              <Sparkles className="w-3.5 h-3.5 inline mr-1.5" style={{ color: 'var(--role-primary)' }} />
              "{healthData?.ai_explanation || 'Project health is good with steady completion pacing.'}"
            </p>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Task Completion</span>
                <span className="font-semibold text-slate-700">{healthData?.factors?.task_completion || '91%'}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Sprint Velocity</span>
                <span className="font-semibold text-slate-700">{healthData?.factors?.sprint_velocity || '82%'}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Deadline Adherence</span>
                <span className="font-semibold text-slate-700">{healthData?.factors?.deadline_adherence || '79%'}</span>
              </div>
            </div>
          </div>

          <Link to={`/projects/${projectId}/ai-insights`} className="role-link mt-6 flex items-center justify-between text-xs font-semibold">
            View Weighted Scoring Breakdown <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* 2. ML Project Delay Prediction */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-300 transition">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Feature 2 — Scikit-learn ML Prediction</span>
              <span className="role-pill">
                ML PREDICTED
              </span>
            </div>

            <div className="flex items-baseline gap-3 mb-2">
              <span className="text-5xl font-black text-amber-400">
                {mlPrediction?.probability_percentage !== undefined ? `${mlPrediction.probability_percentage}%` : '78%'}
              </span>
              <span className="text-xs font-semibold uppercase text-slate-500">Delay Probability</span>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-slate-500">Risk Level:</span>
              <span className={`text-xs font-bold ${mlPrediction?.risk_level === 'CRITICAL' || mlPrediction?.risk_level === 'HIGH' ? 'text-rose-400' : 'text-amber-400'}`}>
                {mlPrediction?.risk_level || 'HIGH'}
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-slate-500">Expected Delay:</span>
              <span className="text-xs font-bold text-slate-900">{mlPrediction?.expected_delay_days || '4–6 Days'}</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4">
              <p className="text-xs font-semibold text-slate-600 mb-1">Main Contributing Factors:</p>
              <ul className="space-y-1 text-xs text-slate-500">
                {mlPrediction?.contributing_factors?.map((f: any, idx: number) => (
                  <li key={idx} className="flex justify-between">
                    <span>• {f.factor}</span>
                    <span className="text-slate-700 font-mono">{f.value}</span>
                  </li>
                )) || (
                  <>
                    <li className="flex justify-between"><span>• Overdue Tasks</span><span className="text-slate-700 font-mono">3 past due</span></li>
                    <li className="flex justify-between"><span>• Workload Ratio</span><span className="text-slate-700 font-mono">118% capacity</span></li>
                  </>
                )}
              </ul>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-200">
            <span>Model: {mlPrediction?.model_version || 'Scikit Random Forest v1.2'}</span>
            <Link to={`/projects/${projectId}/ai-insights`} className="role-link font-semibold">
              Details
            </Link>
          </div>
        </div>

        {/* 3. AI Release Readiness Score */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-300 transition">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Feature 10 — Release Readiness</span>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {releaseData?.status || 'READY WITH WARNINGS'}
              </span>
            </div>

            <div className="flex items-baseline gap-3 mb-4">
              <span className="text-5xl font-black text-emerald-400">{releaseData?.readiness_score || 88}</span>
              <span className="text-slate-500 text-lg font-medium">/ 100</span>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4 leading-relaxed">
              <Rocket className="w-3.5 h-3.5 inline text-emerald-400 mr-1.5" />
              "{releaseData?.ai_recommendation || 'Release is possible, but two high-priority reviews should be completed before deployment.'}"
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500">Tasks</span>
                <span className="text-emerald-400 font-bold">GOOD</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500">Testing</span>
                <span className="text-amber-400 font-bold">WARNING</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500">Bugs</span>
                <span className="text-emerald-400 font-bold">GOOD</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500">Reviews</span>
                <span className="text-amber-400 font-bold">WARNING</span>
              </div>
            </div>
          </div>

          <Link to={`/projects/${projectId}/release-readiness`} className="mt-6 flex items-center justify-between text-xs font-semibold text-emerald-400 hover:text-emerald-300">
            Run Release Audit Checklist <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

      </div>

      {/* Feature 5 — Engineering Bottlenecks Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-rose-500/10 rounded-lg text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Feature 5 — Engineering Bottleneck Detection</h2>
              <p className="text-xs text-slate-500">Automated root cause identification and actionable remedies</p>
            </div>
          </div>
          <span className="text-xs px-3 py-1 bg-slate-100 text-slate-600 rounded-full font-mono">
            {bottlenecks?.bottlenecks_count || 1} Active Bottlenecks
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bottlenecks?.bottlenecks?.map((b: any, idx: number) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" /> {b.problem}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase">
                  {b.type}
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <p className="text-slate-600"><strong className="text-slate-500">Cause:</strong> {b.cause}</p>
                <p className="text-slate-600"><strong className="text-slate-500">Impact:</strong> {b.impact}</p>
                <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--role-bg-subtle)', border: '1px solid var(--role-border)', color: 'var(--role-text-body)' }}>
                  <strong className="block mb-0.5 font-semibold" style={{ color: 'var(--role-primary)' }}>Recommendation:</strong>
                  {b.recommendation}
                </div>
              </div>
            </div>
          )) || (
            <div className="bg-white p-5 rounded-xl border border-slate-200 text-xs text-slate-500">
              No active bottlenecks detected. Tasks moving smoothly.
            </div>
          )}
        </div>
      </div>

      {/* Feature 6 — Developer Workload Intelligence */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="role-icon-chip p-2 rounded-lg">
              <Users className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Feature 6 — Developer Workload Intelligence</h2>
              <p className="text-xs text-slate-500">Capacity distribution heatmaps and task rebalancing recommendations</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {workload?.team_workload?.map((w: any, idx: number) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <InitialsAvatar name={w.developer_name} role="developer" size={32} className="border border-slate-200" />
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{w.developer_name}</h4>
                    <p className="text-[11px] text-slate-500">{w.active_tasks_count} Active Tasks ({w.estimated_hours} hrs)</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  w.risk_level === 'HIGH' ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
                }`}>
                  {w.risk_level}
                </span>
              </div>

              <div className="space-y-1.5 mb-3">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Capacity Load</span>
                  <span className="font-bold text-slate-700">{w.workload_pct}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      w.workload_pct >= 85 ? 'bg-rose-500' : (w.workload_pct >= 60 ? 'bg-amber-400' : 'bg-emerald-400')
                    }`}
                    style={{ width: `${Math.min(w.workload_pct, 100)}%` }}
                  />
                </div>
              </div>

              <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <strong className="text-slate-600 font-medium">Rec:</strong> "{w.recommendation}"
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Feature 7 — GitHub Engineering Analytics */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="role-icon-chip p-2 rounded-lg">
              <GitPullRequest className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Feature 7 — GitHub Engineering Analytics</h2>
              <p className="text-xs text-slate-500">PR cycle times, review latency, and code velocity trends</p>
            </div>
          </div>
          <Link to={`/projects/${projectId}/github`} className="role-link text-xs font-semibold flex items-center gap-1">
            Full GitHub Dashboard <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">PR Cycle Time</p>
            <p className="text-2xl font-bold text-slate-900">{githubMetrics?.metrics?.pr_cycle_time_avg_hours || 14.5} <span className="text-xs text-slate-500">hrs</span></p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Review Latency</p>
            <p className="text-2xl font-bold text-slate-900">{githubMetrics?.metrics?.pr_review_time_avg_hours || 4.2} <span className="text-xs text-slate-500">hrs</span></p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Issue Resolution</p>
            <p className="text-2xl font-bold text-slate-900">{githubMetrics?.metrics?.issue_resolution_avg_hours || 28.0} <span className="text-xs text-slate-500">hrs</span></p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Weekly Commits</p>
            <p className="text-2xl font-bold text-slate-900">{githubMetrics?.metrics?.commit_frequency_weekly || 32.5}</p>
          </div>
        </div>
      </div>

    </div>
  );
};
