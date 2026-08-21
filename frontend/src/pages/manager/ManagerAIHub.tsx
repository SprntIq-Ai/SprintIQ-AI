import React, { useEffect, useState } from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { aiService } from '../../services/api';
import { Sparkles, Bot, RefreshCw, CheckCircle2, TrendingUp, AlertTriangle, ShieldAlert } from 'lucide-react';

export const ManagerAIHub: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [riskData, setRiskData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const fetchAI = async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const [sum, risk] = await Promise.all([
        aiService.getSummary('sprint'),
        aiService.getRiskPrediction(),
      ]);
      setSummary(sum);
      setRiskData(risk);
    } catch (e) {
      console.error("Manager AI Hub backend error:", e);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAI();
  }, []);

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
        <h3 className="text-lg font-bold text-slate-900 mb-2">AI insights are temporarily unavailable.</h3>
        <p className="text-xs text-slate-500 mb-6">Unable to load AI Risk Insights. Please verify connection or try again later.</p>
        <Button variant="manager" icon={<RefreshCw className="w-4 h-4" />} onClick={fetchAI}>
          Retry
        </Button>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-slate-400 animate-pulse" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">No Sprint Insights Available.</h3>
        <p className="text-xs text-slate-500 mb-6">Insufficient telemetry exists for this sprint.</p>
        <Button variant="manager" icon={<RefreshCw className="w-4 h-4" />} onClick={fetchAI}>
          Refresh
        </Button>
      </div>
    );
  }

  const safeRecommendations = Array.isArray(summary.recommendations) ? summary.recommendations : [];
  const safeMitigations = Array.isArray(riskData?.ai_recommendations) ? riskData.ai_recommendations : [];
  const healthStatusVariant = String(summary.health_status || 'default').toLowerCase().replace('-', '_').replace(' ', '_');

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            Sprint Intelligence Hub <Sparkles className="w-6 h-6 text-emerald-500" />
          </h1>
          <p className="text-xs text-slate-500 mt-1">Gemini AI workload optimization, delivery risk forecasting, and sprint bottleneck alerts</p>
        </div>
        <Button variant="manager" icon={<RefreshCw className="w-4 h-4" />} onClick={fetchAI}>
          Re-Analyze Sprint Metrics
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <GlassCard className="lg:col-span-2 space-y-5 border-l-4 border-l-[var(--role-primary)]">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Bot className="w-5 h-5 text-[var(--role-primary)]" /> Gemini Sprint Health Analysis
            </h3>
            <Badge variant={healthStatusVariant as any}>{summary.health_status || 'UNKNOWN'}</Badge>
          </div>

          <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
            {summary.content || 'Analysis output empty.'}
          </p>

          <div>
            <h4 className="font-bold text-slate-900 text-xs mb-3 uppercase tracking-wider">Manager Recommendations</h4>
            <div className="space-y-2">
              {safeRecommendations.length > 0 ? (
                safeRecommendations.map((rec: string, idx: number) => (
                  <div key={idx} className="p-3 rounded-xl bg-emerald-950/5 border border-emerald-900/20 text-xs text-emerald-800">
                    💡 {rec}
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400">No active AI recommendations computed for this period.</p>
              )}
            </div>
          </div>
        </GlassCard>

        <GlassCard className="text-center space-y-4">
          <h4 className="text-xs text-slate-500 font-semibold uppercase">Sprint Risk Index</h4>
          <div className="w-28 h-28 rounded-full border-4 border-emerald-500/30 bg-white flex flex-col items-center justify-center mx-auto">
            <span className="text-3xl font-bold text-emerald-600">{summary.risk_score || 0}</span>
            <span className="text-[9px] text-slate-500 font-mono">RISK SCORE</span>
          </div>

          <div className="space-y-2 text-xs text-left pt-2 border-t border-slate-200">
            <p className="font-semibold text-slate-600">Predicted Mitigation Actions:</p>
            {safeMitigations.length > 0 ? (
              safeMitigations.map((m: string, i: number) => (
                <div key={i} className="p-2 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-600">
                  <span className="font-semibold text-amber-600">• </span>{m}
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400">No mitigation strategies identified.</p>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
