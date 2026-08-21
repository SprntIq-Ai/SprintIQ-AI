import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Sparkles, Bot, User, Loader2, ArrowRight, FolderKanban, Cpu, CheckCircle2 } from 'lucide-react';
import { intelligenceService } from '../../services/intelligenceService';
import { adminService, managerService, developerService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from 'react-router-dom';

interface AIChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

type CopilotMode = 'FULL_WORKSPACE' | 'PROJECT_AWARE';

interface AccessibleProject {
  id: string;
  name: string;
  key: string;
}

const QUICK_PROMPTS = [
  "What is today's progress?",
  "Which sprint is delayed?",
  "Who has maximum workload?",
  "Generate weekly executive report.",
];

export const AIChatDrawer: React.FC<AIChatDrawerProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<CopilotMode>('FULL_WORKSPACE');
  const [accessibleProjects, setAccessibleProjects] = useState<AccessibleProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projectsLoading, setProjectsLoading] = useState(false);

  // Project-aware context derived from the current route (frontend only)
  const routeProjectId = useMemo(() => {
    const m = location.pathname.match(/\/projects\/([^/]+)/);
    return m ? m[1] : undefined;
  }, [location.pathname]);

  // Load projects accessible to the authenticated user (RBAC, from backend)
  const loadAccessibleProjects = async () => {
    setProjectsLoading(true);
    try {
      const role = user?.role;
      let list: AccessibleProject[] = [];
      if (role === 'admin') {
        const projects = await adminService.getProjects();
        list = projects.map((p: any) => ({ id: p.id, name: p.name, key: p.key }));
      } else if (role === 'manager') {
        const projects = await managerService.getProjects();
        list = projects.map((p: any) => ({ id: p.id, name: p.name, key: p.key }));
      } else {
        const data = await developerService.getDashboard();
        list = (data?.projects || []).map((p: any) => ({ id: p.id, name: p.name, key: p.key }));
      }
      setAccessibleProjects(list);
      if (list.length > 0) {
        setSelectedProjectId((prev) => {
          if (prev && list.some((p) => p.id === prev)) return prev;
          return list[0].id;
        });
      } else {
        setSelectedProjectId('');
      }
    } catch (e) {
      setAccessibleProjects([]);
      setSelectedProjectId('');
    } finally {
      setProjectsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAccessibleProjects();
    }
  }, [isOpen]);

  // When on a project route, default to PROJECT_AWARE scoped to that project
  useEffect(() => {
    if (routeProjectId) {
      setMode('PROJECT_AWARE');
      setSelectedProjectId(routeProjectId);
    } else {
      setMode('FULL_WORKSPACE');
    }
  }, [routeProjectId]);

  const projectLabel = mode === 'PROJECT_AWARE'
    ? (accessibleProjects.find((p) => p.id === selectedProjectId)?.name || selectedProjectId.toUpperCase() || 'Project')
    : `Full workspace (${accessibleProjects.length} project${accessibleProjects.length === 1 ? '' : 's'})`;

  const ensureWelcome = () => {
    if (messages.length === 0) {
      const welcome: ChatMessage = {
        id: 'welcome',
        sender: 'ai',
        text: `Hello ${user?.full_name || 'Engineer'}! I am **SprintIQ AI Copilot**. I can analyze sprint velocity, delivery risk, developer workload and daily progress — currently scoped to **${projectLabel}**. Ask me anything.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([welcome]);
    }
  };

  const handleSend = async (textToSend?: string) => {
    ensureWelcome();
    const query = textToSend || prompt;
    if (!query.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setPrompt('');
    setIsLoading(true);

    try {
      const effectiveMode = mode === 'PROJECT_AWARE' ? 'PROJECT_AWARE' : 'FULL_WORKSPACE';
      const effectiveProjectId = effectiveMode === 'PROJECT_AWARE' && selectedProjectId ? selectedProjectId : undefined;
      const res = await intelligenceService.queryAICopilot(query, effectiveProjectId, effectiveMode);
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: res.answer || 'Analysis complete.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: detail || 'Sorry, I encountered an issue reaching the AI Copilot. Please check the server connection.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/30 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md glass-panel flex flex-col z-50"
            style={{ borderLeft: '1px solid var(--role-border)', boxShadow: 'var(--role-shadow-lg)', borderRadius: 0 }}
            role="dialog"
            aria-label="AI Copilot"
          >
            {/* Header */}
            <div
              className="px-5 py-5 flex items-center justify-between shrink-0"
              style={{
                borderBottom: '1px solid rgba(var(--role-ai-rgb), 0.18)',
                background: 'linear-gradient(to right, rgba(var(--role-ai-rgb), 0.08), rgba(var(--role-ai-rgb), 0.03))',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="p-2.5 rounded-xl"
                  style={{
                    background: 'linear-gradient(135deg, var(--role-ai), var(--role-ai-hover))',
                    boxShadow: '0 4px 12px rgba(var(--role-ai-rgb), 0.30)',
                  }}
                >
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2" style={{ color: 'var(--role-text-heading)' }}>
                    SprintIQ AI Copilot
                  </h3>
                  <p className="text-[11px] flex items-center gap-1.5 mt-0.5" style={{ color: 'var(--role-text-muted)' }}>
                    <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[9px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> ONLINE
                    </span>
                    Predictive Engineering Intelligence
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg transition-colors duration-200 hover:bg-[var(--role-bg-subtle)]"
                style={{ color: 'var(--role-text-muted)' }}
                aria-label="Close AI Copilot"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Project context chip + mode toggle */}
            <div className="px-5 py-3 shrink-0" style={{ borderBottom: '1px solid var(--role-border-subtle)', background: 'var(--role-bg-muted)' }}>
              {/* Mode toggle */}
              <div className="flex items-center gap-1.5 mb-2">
                <button
                  onClick={() => setMode('FULL_WORKSPACE')}
                  className={`flex-1 text-[10px] font-semibold px-2 py-1.5 rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 ${mode === 'FULL_WORKSPACE' ? 'text-white' : ''}`}
                  style={
                    mode === 'FULL_WORKSPACE'
                      ? { background: 'var(--role-ai)', boxShadow: '0 2px 8px rgba(var(--role-ai-rgb), 0.30)' }
                      : { background: 'var(--role-bg-subtle)', border: '1px solid var(--role-border-subtle)', color: 'var(--role-text-muted)' }
                  }
                >
                  <FolderKanban className="w-3.5 h-3.5" />
                  Full Workspace
                </button>
                <button
                  onClick={() => setMode('PROJECT_AWARE')}
                  className={`flex-1 text-[10px] font-semibold px-2 py-1.5 rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 ${mode === 'PROJECT_AWARE' ? 'text-white' : ''}`}
                  style={
                    mode === 'PROJECT_AWARE'
                      ? { background: 'var(--role-ai)', boxShadow: '0 2px 8px rgba(var(--role-ai-rgb), 0.30)' }
                      : { background: 'var(--role-bg-subtle)', border: '1px solid var(--role-border-subtle)', color: 'var(--role-text-muted)' }
                  }
                >
                  <Cpu className="w-3.5 h-3.5" />
                  Project-aware
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="role-ai-chip !text-[10px]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {projectLabel}
                </span>
              </div>

              {/* Project selector (PROJECT_AWARE) — populated dynamically from accessible projects */}
              {mode === 'PROJECT_AWARE' && (
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  disabled={projectsLoading || accessibleProjects.length === 0}
                  className="mt-2 w-full px-3 py-2 rounded-lg text-xs role-input focus:outline-none"
                  style={{ background: 'var(--role-surface)', border: '1px solid var(--role-border)', color: 'var(--role-text-body)' }}
                  aria-label="Select project"
                >
                  {projectsLoading && <option value="">Loading projects...</option>}
                  {!projectsLoading && accessibleProjects.length === 0 && <option value="">No accessible projects</option>}
                  {accessibleProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.key})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              {messages.length === 0 && (
                <button
                  onClick={ensureWelcome}
                  className="w-full px-4 py-3 rounded-xl text-xs text-center transition-colors"
                  style={{ background: 'var(--role-bg-subtle)', border: '1px dashed var(--role-border)', color: 'var(--role-text-muted)' }}
                >
                  Tap to start a conversation with the AI Copilot
                </button>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`flex gap-3 ${m.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={
                      m.sender === 'user'
                        ? { background: 'var(--role-primary)', color: '#ffffff' }
                        : { background: 'var(--role-ai-light)', color: 'var(--role-ai)', border: '1px solid rgba(var(--role-ai-rgb), 0.25)' }
                    }
                  >
                    {m.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div
                    className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed ${m.sender === 'user' ? 'rounded-tr-none' : 'rounded-tl-none'}`}
                    style={
                      m.sender === 'user'
                        ? { backgroundColor: 'var(--role-primary)', color: 'var(--role-btn-text, #ffffff)' }
                        : { background: 'var(--role-surface)', border: '1px solid rgba(var(--role-ai-rgb), 0.20)', color: 'var(--role-text-body)' }
                    }
                  >
                    <div className="whitespace-pre-wrap">{m.text}</div>
                    <span className="text-[10px] opacity-60 block mt-2 text-right">{m.timestamp}</span>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div
                  className="flex items-center gap-2 text-xs p-3 rounded-xl animate-pulse"
                  style={{
                    backgroundColor: 'rgba(var(--role-ai-rgb), 0.05)',
                    border: '1px solid rgba(var(--role-ai-rgb), 0.18)',
                    color: 'var(--role-ai)',
                  }}
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>AI Copilot is analyzing project metrics...</span>
                </div>
              )}
            </div>

            {/* Quick Prompts */}
            <div className="px-5 py-3 shrink-0" style={{ borderTop: '1px solid var(--role-border-subtle)' }}>
              <p className="role-label !text-[9px] mb-2">Suggested Queries</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((qp) => (
                  <button
                    key={qp}
                    onClick={() => handleSend(qp)}
                    className="text-[11px] px-3 py-1.5 rounded-lg transition-all duration-200 flex items-center gap-1.5"
                    style={{ background: 'var(--role-bg-muted)', border: '1px solid var(--role-border-subtle)', color: 'var(--role-text-body)' }}
                  >
                    {qp}
                    <ArrowRight className="w-3 h-3" style={{ color: 'var(--role-ai)' }} />
                  </button>
                ))}
              </div>
            </div>

            {/* Input Footer */}
            <div className="p-4 shrink-0" style={{ borderTop: '1px solid var(--role-border-subtle)', background: 'var(--role-surface)' }}>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask about the workspace, sprint health, workload, delays..."
                  className="flex-1 px-4 py-3 rounded-xl text-xs focus:outline-none transition-colors role-input"
                  aria-label="Ask the AI Copilot"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={isLoading || !prompt.trim()}
                  className="p-3 rounded-xl disabled:opacity-50 transition-all hover:brightness-110 shrink-0"
                  style={{
                    background: 'var(--role-ai)',
                    color: '#ffffff',
                    boxShadow: '0 4px 12px rgba(var(--role-ai-rgb), 0.30)',
                  }}
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};