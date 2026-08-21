import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, UserCheck, Code2, Sparkles, ArrowRight, Activity, Cpu, Layers } from 'lucide-react';
import { motion } from 'framer-motion';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-[rgba(var(--role-primary-rgb),0.20)] via-[rgba(var(--role-secondary-rgb),0.10)] to-transparent blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <header className="px-8 py-6 flex items-center justify-between z-10 border-b border-slate-200 backdrop-blur-md bg-white/60">
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-2xl shadow-xl"
            style={{
              background: 'linear-gradient(135deg, var(--role-primary), var(--role-accent))',
              boxShadow: '0 8px 24px var(--role-glow)',
            }}
          >
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-extrabold tracking-tight font-outfit">
            SprintIQ <span className="role-text-gradient">AI</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            to="/login/admin"
            className="text-xs font-semibold px-4 py-2 rounded-xl transition-all"
            style={{ backgroundColor: 'rgba(56,189,248,0.08)', border: '1px solid rgba(14,165,233,0.25)', color: '#0EA5E9' }}
          >
            Admin Portal
          </Link>
          <Link
            to="/login/manager"
            className="text-xs font-semibold px-4 py-2 rounded-xl transition-all"
            style={{ backgroundColor: 'rgba(56,189,248,0.08)', border: '1px solid rgba(14,165,233,0.25)', color: '#0EA5E9' }}
          >
            Manager Portal
          </Link>
          <Link
            to="/login/developer"
            className="text-xs font-semibold px-4 py-2 rounded-xl transition-all"
            style={{ backgroundColor: 'rgba(56,189,248,0.08)', border: '1px solid rgba(14,165,233,0.25)', color: '#0EA5E9' }}
          >
            Developer Portal
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 z-10 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full role-ai-chip text-xs font-semibold">
            <Cpu className="w-4 h-4" />
            <span>Powered by Google Gemini 1.5 Risk Intelligence</span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-tight">
            AI-Driven Engineering <br />
            <span className="role-text-gradient">
              Project Intelligence Platform
            </span>
          </h1>

          <p className="text-slate-500 text-lg max-w-2xl mx-auto font-normal leading-relaxed">
            Monitor team productivity, predict delivery risks with Google Gemini AI, track sprint velocity, and empower software engineering teams through role-tailored workspaces.
          </p>
        </motion.div>

        {/* Role Access Cards Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-14"
        >
          {/* Admin Card */}
          <Link
            to="/login/admin"
            className="glass-card rounded-2xl p-8 text-left border glass-card-hover group relative overflow-hidden"
            style={{ borderColor: 'rgba(56,189,248,0.30)' }}
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"
              style={{ backgroundColor: 'rgba(56,189,248,0.12)', color: '#0EA5E9' }}>
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--role-text-heading)' }}>Admin Portal</h3>
            <p className="text-xs leading-relaxed mb-6" style={{ color: 'var(--role-text-muted)' }}>
              Global project governance, invite project managers, review audit logs, and oversee organization analytics.
            </p>
            <div className="flex items-center text-xs font-semibold gap-1.5 group-hover:translate-x-1 transition-transform" style={{ color: '#0EA5E9' }}>
              <span>Admin Login</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>

          {/* Project Manager Card */}
          <Link
            to="/login/manager"
            className="glass-card rounded-2xl p-8 text-left border glass-card-hover group relative overflow-hidden"
            style={{ borderColor: 'rgba(56,189,248,0.30)' }}
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"
              style={{ backgroundColor: 'rgba(56,189,248,0.12)', color: '#0EA5E9' }}>
              <UserCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--role-text-heading)' }}>Manager Portal</h3>
            <p className="text-xs leading-relaxed mb-6" style={{ color: 'var(--role-text-muted)' }}>
              Sprint planning, developer task assignment, review submission approval, and Gemini workload suggestions.
            </p>
            <div className="flex items-center text-xs font-semibold gap-1.5 group-hover:translate-x-1 transition-transform" style={{ color: '#0EA5E9' }}>
              <span>Manager Login</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>

          {/* Developer Card */}
          <Link
            to="/login/developer"
            className="glass-card rounded-2xl p-8 text-left border glass-card-hover group relative overflow-hidden"
            style={{ borderColor: 'rgba(56,189,248,0.30)' }}
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"
              style={{ backgroundColor: 'rgba(56,189,248,0.12)', color: '#0EA5E9' }}>
              <Code2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--role-text-heading)' }}>Developer Engine</h3>
            <p className="text-xs leading-relaxed mb-6" style={{ color: 'var(--role-text-muted)' }}>
              Execute assigned tasks, update 0-100% progress, upload attachments, and chat with AI assistant.
            </p>
            <div className="flex items-center text-xs font-semibold gap-1.5 group-hover:translate-x-1 transition-transform" style={{ color: '#0EA5E9' }}>
              <span>Developer Login</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="px-8 py-6 text-center text-xs text-slate-500 border-t border-slate-200">
        SprintIQ AI &copy; 2026 Enterprise SaaS. All rights reserved. Built with React 19, FastAPI, Supabase, and Google Gemini AI.
      </footer>
    </div>
  );
};
