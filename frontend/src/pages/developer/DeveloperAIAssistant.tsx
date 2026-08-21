import React, { useState } from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { Button } from '../../components/common/Button';
import { developerService } from '../../services/api';
import { Sparkles, Bot, Send, User, Loader2 } from 'lucide-react';

export const DeveloperAIAssistant: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string }>>([
    { sender: 'ai', text: 'Hello! I am your SprintIQ Gemini AI assistant. Ask me about sprint tasks, code recommendations, or daily progress.' }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    const query = prompt;
    setMessages((prev) => [...prev, { sender: 'user', text: query }]);
    setPrompt('');
    setIsLoading(true);

    try {
      const res = await developerService.aiChat(query);
      setMessages((prev) => [...prev, { sender: 'ai', text: res.response }]);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setMessages((prev) => [...prev, { sender: 'ai', text: detail || 'Failed to query Gemini AI.' }]);
    } finally {
      setIsLoading(false);
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

      <GlassCard className="h-[520px] flex flex-col justify-between border-l-4 border-l-[var(--role-ai)]">
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {messages.map((m, idx) => (
            <div key={idx} className={`flex gap-3 ${m.sender === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.sender === 'user' ? 'text-slate-900' : 'text-slate-700 border border-slate-200'}`}
                style={m.sender === 'user'
                  ? { backgroundColor: 'var(--role-primary)' }
                  : { backgroundColor: 'var(--role-ai-light)', color: 'var(--role-ai)', border: '1px solid rgba(var(--role-ai-rgb), 0.25)' }}
              >
                {m.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div
                className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed ${m.sender === 'user' ? 'text-slate-900' : 'bg-white text-slate-700 border border-slate-200'}`}
                style={m.sender === 'user' ? { backgroundColor: 'var(--role-primary)' } : { border: '1px solid rgba(var(--role-ai-rgb), 0.18)' }}
              >
                <div className="whitespace-pre-wrap">{m.text}</div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-xs animate-pulse" style={{ color: 'var(--role-ai)' }}>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Gemini AI is processing your request...</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSend} className="flex gap-2 pt-4 border-t border-slate-200">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask Gemini AI..."
            className="flex-1 px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-ai)]"
          />
          <Button type="submit" variant="ai" isLoading={isLoading} icon={<Send className="w-4 h-4" />}>
            Send
          </Button>
        </form>
      </GlassCard>
    </div>
  );
};
