import React, { useState, useEffect } from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Timer, Play, Pause, RotateCcw, CheckCircle2, Zap, Flame, ShieldAlert } from 'lucide-react';
import { developerFeatureService, developerService } from '../../services/api';
import { Task, FocusSession } from '../../types';

export const FocusMode: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(25 * 60); // 25 minutes
  const [isActive, setIsActive] = useState<boolean>(false);
  const [mode, setMode] = useState<'POMODORO' | 'SHORT_BREAK' | 'LONG_BREAK'>('POMODORO');
  const [isDistractionFree, setIsDistractionFree] = useState<boolean>(false);
  const [recentSessions, setRecentSessions] = useState<FocusSession[]>([]);

  useEffect(() => {
    developerService.getTasks().then(setTasks).catch(console.error);
    developerFeatureService.getFocusSessions().then(setRecentSessions).catch(console.error);
  }, []);

  useEffect(() => {
    let interval: any = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      handleFinishSession();
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const handleFinishSession = async () => {
    try {
      const minutes = mode === 'POMODORO' ? 25 : 5;
      const session = await developerFeatureService.createFocusSession({
        duration_minutes: minutes,
        task_id: selectedTask || undefined,
        notes: `Completed ${mode} focus sprint`
      });
      setRecentSessions((prev) => [session, ...prev]);
      alert(`🎉 Focus Session completed! Outstanding focus.`);
    } catch (e) {
      console.error(e);
    }
  };

  const setTimerMode = (newMode: 'POMODORO' | 'SHORT_BREAK' | 'LONG_BREAK') => {
    setMode(newMode);
    setIsActive(false);
    if (newMode === 'POMODORO') setTimeLeft(25 * 60);
    else if (newMode === 'SHORT_BREAK') setTimeLeft(5 * 60);
    else setTimeLeft(15 * 60);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`space-y-8 transition-all ${isDistractionFree ? 'fixed inset-0 z-50 bg-white p-8 overflow-y-auto' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            Developer Focus Mode (Pomodoro Workbench) <Badge variant="developer">Clean UI</Badge>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Pomodoro timer, task focus sessions, and distraction-free execution interface</p>
        </div>

        <Button
          variant={isDistractionFree ? 'danger' : 'developer'}
          onClick={() => setIsDistractionFree(!isDistractionFree)}
          icon={<ShieldAlert className="w-4 h-4" />}
        >
          {isDistractionFree ? 'Exit Distraction-Free Mode' : 'Enter Distraction-Free Mode'}
        </Button>
      </div>

      {/* Pomodoro Timer Centerpiece */}
      <GlassCard className="max-w-2xl mx-auto p-8 text-center space-y-6 border-l-4 border-l-[var(--role-primary)]">
        {/* Mode Selector */}
        <div className="inline-flex p-1.5 rounded-2xl bg-white border border-slate-200 gap-2">
          <button
            onClick={() => setTimerMode('POMODORO')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'POMODORO' ? 'bg-[var(--role-primary)] text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Focus Sprint (25m)
          </button>
          <button
            onClick={() => setTimerMode('SHORT_BREAK')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'SHORT_BREAK' ? 'bg-emerald-500 text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Short Break (5m)
          </button>
          <button
            onClick={() => setTimerMode('LONG_BREAK')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'LONG_BREAK' ? 'bg-[var(--role-accent)] text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Long Break (15m)
          </button>
        </div>

        {/* Task Linker */}
        <div className="max-w-md mx-auto">
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 text-left">Target Focus Task</label>
          <select
            value={selectedTask}
            onChange={(e) => setSelectedTask(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs"
          >
            <option value="">-- Select Task to Focus On --</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} ({t.story_points} SP)
              </option>
            ))}
          </select>
        </div>

        {/* Timer Display */}
        <div className="py-6">
          <span className="text-7xl sm:text-8xl font-black font-mono tracking-wider text-[var(--role-secondary)] drop-shadow-lg">
            {formatTime(timeLeft)}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="developer"
            size="lg"
            onClick={() => setIsActive(!isActive)}
            icon={isActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          >
            {isActive ? 'Pause Focus' : 'Start Focus Sprint'}
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={() => setTimerMode(mode)}
            icon={<RotateCcw className="w-5 h-5" />}
          >
            Reset
          </Button>
        </div>
      </GlassCard>

      {/* Focus History Log */}
      <GlassCard className="max-w-2xl mx-auto">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Flame className="w-4 h-4 text-amber-400" /> Recent Completed Focus Sessions ({recentSessions.length})
        </h3>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
          {recentSessions.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">No completed focus sessions today yet.</p>
          ) : (
            recentSessions.map((s) => (
              <div key={s.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-slate-900">{s.notes || 'Focus Session'}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-500">
                  <span className="font-mono text-[var(--role-secondary)]">{s.duration_minutes} mins</span>
                  <span className="text-[10px] text-slate-500">{new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </GlassCard>
    </div>
  );
};
