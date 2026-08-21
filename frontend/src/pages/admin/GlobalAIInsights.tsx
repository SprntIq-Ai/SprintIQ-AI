import React, { useEffect, useState } from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { Badge } from '../../components/common/Badge';
import { aiService } from '../../services/api';
import { Sparkles, ShieldAlert, CheckCircle2, TrendingUp, Cpu, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/common/Button';

export const GlobalAIInsights: React.FC = () => {
  const [analysis, setAnalysis] = useState<any>(null);
  const [riskData, setRiskData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const fetchAI = async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const [sum, risk] = await Promise.all([
        aiService.getSummary('weekly'),
        aiService.getRiskPrediction(),
      ]);
      setAnalysis(sum);
      setRiskData(risk);
    } catch (e) {
      console.error("Failed to fetch AI Insights:", e);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAI();
  }, []);

  const getRiskFactors = (): string[] => {
    if (riskData?.primary_risk_factors && Array.isArray(riskData.primary_risk_factors)) {
      return riskData.primary_risk_factors;
    }
    const factors: string[] = [];
    if (riskData?.high_risk_tasks && Array.isArray(riskData.high_risk_tasks)) {
      riskData.high_risk_tasks.forEach((t: any) => {
        factors.push(`Task "${t.task_title}" is at-risk: ${t.risk_factor || 'unknown factor'} (${t.priority} priority)`);
      });
    }
    if (riskData?.overloaded_developers && Array.isArray(riskData.overloaded_developers)) {
      riskData.overloaded_developers.forEach((d: any) => {
        factors.push(`Developer ${d.developer_name} may be overloaded with ${d.assigned_tasks} tasks (${d.estimated_hours} estimated hours)`);
      });
    }
    if (riskData?.sprint_delay_probability) {
      factors.push(`Sprint delay risk probability is estimated at ${riskData.sprint_delay_probability}%`);
    }
    return factors.length > 0 ? factors : ["No major risk factors detected in current telemetry."];
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <RefreshCw className="w-10 h-10 animate-spin text-[var(--role-primary)] mb-4" />
        <p className="text-slate-500 font-medium animate-pulse">Loading AI Risk Insights...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">Unable to load AI Risk Insights</h3>
        <p className="text-xs text-slate-500 mb-6">We encountered an issue communicating with the AI service. Please verify the backend is running and try again.</p>
        <Button variant="admin" icon={<RefreshCw className="w-4 h-4" />} onClick={fetchAI}>
          Retry
        </Button>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-slate-400 animate-pulse" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">No risk insights available yet.</h3>
        <p className="text-xs text-slate-500 mb-6">No engineering telemetry or task logs have been analyzed for AI Insights yet.</p>
        <Button variant="admin" icon={<RefreshCw className="w-4 h-4" />} onClick={fetchAI}>
          Generate Now
        </Button>
      </div>
    );
  }

  const healthStatusVariant = String(analysis.health_status || '').toLowerCase().replace('-', '_').replace(' ', '_');
  const safeRecommendations = Array.isArray(analysis.recommendations) ? analysis.recommendations : [];
  const riskFactors = getRiskFactors();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            Global Gemini AI Intelligence <Sparkles className="w-6 h-6 animate-pulse" style={{ color: 'var(--role-primary)' }} />
          </h1>
          <p className="text-xs text-slate-500 mt-1">Real-time risk scoring, health status predictions, and mitigation strategies</p>
        </div>
        <Button variant="admin" icon={<RefreshCw className="w-4 h-4" />} onClick={fetchAI}>
          Re-Analyze Gemini Metrics
        </Button>
      </div>

      {/* Main Analysis Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <GlassCard className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Cpu className="w-5 h-5" style={{ color: 'var(--role-primary)' }} /> Executive Weekly AI Summary
            </h3>
            <Badge variant={healthStatusVariant as any}>{analysis.health_status || 'UNKNOWN'}</Badge>
          </div>

          <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap bg-slate-50 p-5 rounded-2xl border border-slate-200">
            {analysis.content || 'No summary content generated.'}
          </div>

          <div>
            <h4 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> AI Strategic Recommendations
            </h4>
            <div className="space-y-2">
              {safeRecommendations.length > 0 ? (
                safeRecommendations.map((rec: string, idx: number) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0" style={{ backgroundColor: 'var(--role-bg-subtle)', color: 'var(--role-primary)' }}>
                      {idx + 1}
                    </span>
                    <span>{rec}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400">No active AI recommendations computed for this period.</p>
              )}
            </div>
          </div>
        </GlassCard>

        {/* Risk Score Widget */}
        <div className="space-y-6">
          <GlassCard className="text-center">
            <h4 className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Overall Risk Score</h4>
            <div className="relative inline-flex items-center justify-center my-4">
              <div className="w-32 h-32 rounded-full border-8 flex flex-col items-center justify-center bg-white" style={{ borderColor: 'rgba(var(--role-primary-rgb), 0.20)' }}>
                <span className="text-4xl font-extrabold font-outfit" style={{ color: 'var(--role-primary)' }}>{analysis.risk_score || 0}</span>
                <span className="text-[10px] text-slate-500 font-mono">OUT OF 100</span>
              </div>
            </div>
            <p className="text-xs text-slate-500">Calculated continuously from task delay rates and developer workload bottleneck ratios.</p>
          </GlassCard>

          <GlassCard>
            <h4 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" /> Risk Factors Identified
            </h4>
            <div className="space-y-2 text-xs">
              {riskFactors.map((factor: string, i: number) => (
                <div key={i} className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-slate-700">
                  <span className="font-semibold text-amber-700">• </span>{factor}
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

