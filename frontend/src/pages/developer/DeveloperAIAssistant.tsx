import React, { useState, useRef, useEffect } from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { Button } from '../../components/common/Button';
import { developerService } from '../../services/api';
import { Sparkles, Bot, Send, User, Loader2, RotateCcw, AlertCircle } from 'lucide-react';

interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  isError?: boolean;
}

export const DeveloperAIAssistant: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { sender: 'ai', text: 'Hello! I am your SprintIQ Gemini AI assistant. Ask me about sprint tasks, code recommendations, or daily progress.' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastQuery, setLastQuery] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendQuery = async (queryText: string) => {
    if (!queryText.trim() || isLoading) return;

    setMessages((prev) => [...prev, { sender: 'user', text: queryText }]);
    setPrompt('');
    setLastQuery(queryText);
    setIsLoading(true);

    try {
      const res = await developerService.aiChat(queryText);
      setMessages((prev) => [...prev, { sender: 'ai', text: res.response || 'No response generated.' }]);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || 'Gemini AI service is momentarily unavailable. Please try again.';
      setMessages((prev) => [...prev, { sender: 'ai', text: detail, isError: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    sendQuery(prompt);
  };

  const handleRetry = () => {
    if (lastQuery) {
      sendQuery(lastQuery);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          Gemini AI Assistant <Sparkles className="w-6 h-6" style={{ color: 'var(--role-ai)' }} />
        </h1>
        <p className="text-xs text-slate-500 mt-1">Chat with Gemini 1.5 for code explanations, sprint progress analysis, and developer productivity tips</p>
      </div>

      <GlassCard className="h-[540px] flex flex-col justify-between border-l-4 border-l-[var(--role-ai)]">
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {messages.map((m, idx) => (
            <div key={idx} className={`flex gap-3 ${m.sender === 'user' ? 'flex-row-reverse' : ''}`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.sender === 'user' ? 'text-slate-900' : 'text-slate-700 border border-slate-200'}`}
                style={m.sender === 'user'
                  ? { backgroundColor: 'var(--role-primary)' }
                  : m.isError
                    ? { backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }
                    : { backgroundColor: 'var(--role-ai-light)', color: 'var(--role-ai)', border: '1px solid rgba(var(--role-ai-rgb), 0.25)' }}
              >
                {m.sender === 'user' ? <User className="w-4 h-4" /> : m.isError ? <AlertCircle className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div
                className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed ${
                  m.sender === 'user'
                    ? 'text-slate-900'
                    : m.isError
                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                      : 'bg-white text-slate-700 border border-slate-200'
                }`}
                style={m.sender === 'user' ? { backgroundColor: 'var(--role-primary)' } : m.isError ? {} : { border: '1px solid rgba(var(--role-ai-rgb), 0.18)' }}
              >
                <div className="whitespace-pre-wrap">{m.text}</div>
                {m.isError && (
                  <button
                    onClick={handleRetry}
                    className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-700 hover:text-rose-900 underline"
                  >
                    <RotateCcw className="w-3 h-3" /> Retry request
                  </button>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-xs animate-pulse p-2" style={{ color: 'var(--role-ai)' }}>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Gemini AI is processing your request...</span>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        <form onSubmit={handleSend} className="flex gap-2 pt-4 border-t border-slate-200">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask Gemini AI..."
            disabled={isLoading}
            className="flex-1 px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-ai)]"
          />
          <Button type="submit" variant="ai" isLoading={isLoading} disabled={!prompt.trim()} icon={<Send className="w-4 h-4" />}>
            Send
          </Button>
        </form>
      </GlassCard>
    </div>
  );
};
