import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Sliders, Play, AlertCircle, Calendar, Clock, RefreshCw,
  Users, TrendingUp, TrendingDown, Target, BarChart3,
  AlertTriangle, CheckCircle, XCircle, Info
} from 'lucide-react';
import { intelligenceService } from '../../services/intelligenceService';

interface SimulationData {
  project_id: string;
  project_key: string;
  project_name: string;
  project_status: string;
  start_date: string | null;
  target_date: string | null;
  baseline_target_days: number;
  days_elapsed: number;
  days_remaining: number;
  developer_count: number;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  remaining_tasks: number;
  total_estimated_hours: number;
  completed_hours: number;
  remaining_hours: number;
  total_story_points: number;
  sprint_count: number;
  active_sprint_count: number;
  avg_hours_per_task: number;
  hours_per_dev_per_day: number;
}

interface SimulationResult {
  baseline_target: number;
  simulated_target: number;
  expected_delay: number;
  impact_percentage: number;
  affected_tasks: number;
  affected_sprints: number;
  risk_level: string;
  explanation: string;
  warning: string;
}

const SCENARIOS = [
  { value: 'DEV_UNAVAILABLE', label: 'Developer unavailable for N days', unit: 'Days', paramKey: 'unavailable_days', min: 1, max: 30 },
  { value: 'ADD_DEV', label: 'Add N developers', unit: 'Developers', paramKey: 'added_devs', min: 1, max: 10 },
  { value: 'REMOVE_DEV', label: 'Remove N developers', unit: 'Developers', paramKey: 'removed_devs', min: 1, max: 10 },
  { value: 'INCREASE_SCOPE', label: 'Increase scope by N tasks', unit: 'Tasks', paramKey: 'added_tasks', min: 1, max: 20 },
  { value: 'REDUCE_SCOPE', label: 'Reduce scope by N tasks', unit: 'Tasks', paramKey: 'removed_tasks', min: 1, max: 20 },
  { value: 'ADD_DEADLINE_DAYS', label: 'Add N days to deadline', unit: 'Days', paramKey: 'shift_days', min: 1, max: 30 },
  { value: 'REDUCE_WORKING_DAYS', label: 'Reduce available working days', unit: 'Days', paramKey: 'reduced_days', min: 1, max: 20 },
  { value: 'DELAY_SPRINT', label: 'Delay sprint by N days', unit: 'Days', paramKey: 'delay_days', min: 1, max: 15 },
];

const RISK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  LOW: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  MEDIUM: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  HIGH: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
  CRITICAL: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200' },
};

const RISK_ICONS: Record<string, React.ReactNode> = {
  LOW: <CheckCircle className="w-4 h-4" />,
  MEDIUM: <AlertTriangle className="w-4 h-4" />,
  HIGH: <AlertCircle className="w-4 h-4" />,
  CRITICAL: <XCircle className="w-4 h-4" />,
};

export const WhatIfSimulatorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const projectKey = id || '';

  const [scenarioType, setScenarioType] = useState<string>('DEV_UNAVAILABLE');
  const [paramValue, setParamValue] = useState<number>(3);
  const [loading, setLoading] = useState<boolean>(false);
  const [dataLoading, setDataLoading] = useState<boolean>(true);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [simData, setSimData] = useState<SimulationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load baseline project data
  const loadSimulationData = useCallback(async () => {
    if (!projectKey) {
      setError('No project identifier found in URL.');
      setDataLoading(false);
      return;
    }
    setDataLoading(true);
    setError(null);
    try {
      const data = await intelligenceService.getSimulationData(projectKey);
      if (data.error) {
        setError(data.error);
      } else {
        setSimData(data);
      }
    } catch (e: any) {
      console.error('[Simulator] Failed to load project data:', e);
      setError(e?.response?.data?.detail || 'Unable to load project data. Please try again.');
    } finally {
      setDataLoading(false);
    }
  }, [projectKey]);

  useEffect(() => {
    loadSimulationData();
  }, [loadSimulationData]);

  // Get the current scenario config
  const currentScenario = SCENARIOS.find(s => s.value === scenarioType) || SCENARIOS[0];

  // Dynamic max for some scenarios
  const getSliderMax = () => {
    if (!simData) return currentScenario.max;
    if (scenarioType === 'REMOVE_DEV') return Math.max(simData.developer_count - 1, 1);
    if (scenarioType === 'REDUCE_SCOPE') return Math.max(simData.remaining_tasks, 1);
    return currentScenario.max;
  };

  // Reset value when scenario changes
  useEffect(() => {
    setParamValue(Math.min(3, getSliderMax()));
    setResult(null);
  }, [scenarioType]);

  // ── Run Simulation ──
  const runSimulation = async () => {
    if (!projectKey) return;
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = {
        [currentScenario.paramKey]: paramValue,
        value: paramValue,
      };
      const res = await intelligenceService.runProjectSimulation(projectKey, scenarioType, params);
      if (res.error) {
        setError(res.error);
      } else {
        setResult(res);
      }
    } catch (e: any) {
      console.error('[Simulator] Simulation failed:', e);
      setError(e?.response?.data?.detail || 'Unable to run simulation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Loading state ──
  if (dataLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin mb-3" style={{ color: 'var(--role-primary)' }} />
        <p className="text-sm font-medium">Loading project data...</p>
      </div>
    );
  }

  // ── Error – project not found ──
  if (error && !simData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="bg-white border border-rose-200 rounded-2xl p-8 text-center max-w-md shadow-lg">
          <div className="w-14 h-14 rounded-xl bg-rose-50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-rose-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Project Not Found</h2>
          <p className="text-sm text-slate-500">{error}</p>
          <button
            onClick={loadSimulationData}
            className="mt-4 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-medium hover:bg-slate-200 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const riskStyle = result ? (RISK_COLORS[result.risk_level] || RISK_COLORS.MEDIUM) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="role-icon-chip p-2.5 rounded-xl">
              <Sliders className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">What-If Project Simulator</h1>
              <p className="text-sm text-slate-500">
                Simulate hypothetical schedule changes, resource availability, and scope shifts
              </p>
            </div>
          </div>
          {simData && (
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
              <span className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-700">
                {simData.project_key}
              </span>
              <span className="text-slate-400">|</span>
              <span>{simData.project_name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Baseline Stats */}
      {simData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <Target className="w-4 h-4" />
              <span className="text-[11px] font-semibold uppercase tracking-wider">Baseline Target</span>
            </div>
            <p className="text-2xl font-black text-slate-900">{simData.baseline_target_days} <span className="text-sm font-medium text-slate-400">Days</span></p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <Users className="w-4 h-4" />
              <span className="text-[11px] font-semibold uppercase tracking-wider">Developers</span>
            </div>
            <p className="text-2xl font-black text-slate-900">{simData.developer_count}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <BarChart3 className="w-4 h-4" />
              <span className="text-[11px] font-semibold uppercase tracking-wider">Tasks</span>
            </div>
            <p className="text-2xl font-black text-slate-900">{simData.completed_tasks}<span className="text-sm font-medium text-slate-400">/{simData.total_tasks}</span></p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <Clock className="w-4 h-4" />
              <span className="text-[11px] font-semibold uppercase tracking-wider">Remaining</span>
            </div>
            <p className="text-2xl font-black text-slate-900">{simData.remaining_hours}<span className="text-sm font-medium text-slate-400">h</span></p>
          </div>
        </div>
      )}

      {/* Main Grid: Controls + Outcome */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-slate-400" />
            Configure Scenario
          </h3>

          <div>
            <label className="text-xs text-slate-500 block mb-1.5 font-medium">Scenario Type</label>
            <select
              value={scenarioType}
              onChange={(e) => setScenarioType(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-700 focus:outline-none focus:border-[var(--role-primary)] transition"
            >
              {SCENARIOS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-slate-500 font-medium">Value</label>
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-mono">
                {paramValue} {currentScenario.unit}
              </span>
            </div>
            <input
              type="range"
              min={currentScenario.min}
              max={getSliderMax()}
              value={paramValue}
              onChange={(e) => setParamValue(Number(e.target.value))}
              className="w-full accent-[var(--role-primary)]"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>{currentScenario.min} {currentScenario.unit}</span>
              <span>{getSliderMax()} {currentScenario.unit}</span>
            </div>
          </div>

          <button
            onClick={runSimulation}
            disabled={loading}
            className="role-btn-primary w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold transition"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Running simulation...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Run Simulation
              </>
            )}
          </button>

          {error && simData && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-600 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Outcome */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-400" />
            Simulation Outcome
          </h3>

          {result ? (
            <div className="space-y-4">
              {/* Core Metrics */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Baseline Target
                  </span>
                  <span className="font-mono font-bold text-slate-800">{result.baseline_target} Days</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" />
                    Simulated Target
                  </span>
                  <span className="font-mono font-bold" style={{ color: 'var(--role-primary)' }}>
                    {result.simulated_target} Days
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-3 flex justify-between items-center text-xs">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Expected Delay
                  </span>
                  <span className={`font-bold font-mono ${result.expected_delay > 0 ? 'text-rose-500' : result.expected_delay < 0 ? 'text-emerald-500' : 'text-slate-600'}`}>
                    {result.expected_delay > 0 ? '+' : ''}{result.expected_delay} Days
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-3 flex justify-between items-center text-xs">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5" />
                    Impact
                  </span>
                  <span className={`font-bold font-mono ${result.impact_percentage > 20 ? 'text-rose-500' : result.impact_percentage > 10 ? 'text-amber-500' : 'text-slate-600'}`}>
                    {result.impact_percentage}%
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-3 flex justify-between items-center text-xs">
                  <span className="text-slate-500">Risk</span>
                  {riskStyle && (
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${riskStyle.bg} ${riskStyle.text} ${riskStyle.border} border`}>
                      {RISK_ICONS[result.risk_level]}
                      {result.risk_level}
                    </span>
                  )}
                </div>
              </div>

              {/* Impact Summary */}
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <h4 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  Impact Summary
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">{result.explanation}</p>
                <div className="flex gap-4 mt-3 pt-3 border-t border-slate-100">
                  <div className="text-xs text-slate-500">
                    <span className="font-bold text-slate-700">{result.affected_tasks}</span> Affected Tasks
                  </div>
                  <div className="text-xs text-slate-500">
                    <span className="font-bold text-slate-700">{result.affected_sprints}</span> Affected Sprints
                  </div>
                </div>
              </div>

              {/* Warning */}
              {riskStyle && (
                <div className={`p-3.5 rounded-xl text-[11px] flex items-start gap-2.5 border ${riskStyle.bg} ${riskStyle.border}`}>
                  <span className={`mt-0.5 flex-shrink-0 ${riskStyle.text}`}>
                    {RISK_ICONS[result.risk_level]}
                  </span>
                  <span className={riskStyle.text}>{result.warning}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="min-h-[200px] flex flex-col items-center justify-center text-center px-4">
              <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mb-3">
                <Play className="w-5 h-5 text-slate-300" />
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Select a scenario and click "Run Simulation" to view predicted delay &amp; risk impact.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
