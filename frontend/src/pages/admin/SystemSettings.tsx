import React, { useEffect, useState, useCallback } from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { adminSettingsService } from '../../services/api';
import {
  Settings, ShieldCheck, Database, Cpu, Lock, Github, CheckCircle2,
  AlertCircle, Save, Loader2, Users, FolderKanban, Bot, Bell, Activity
} from 'lucide-react';

interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  setting_type: string;
  category: string;
  description: string;
}

export const SystemSettings: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [health, setHealth] = useState<any>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [testMsg, setTestMsg] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadSettingsAndHealth = useCallback(async () => {
    setIsLoading(true);
    try {
      const [settingsData, healthData] = await Promise.all([
        adminSettingsService.getSettings(),
        adminSettingsService.getHealth()
      ]);
      const mapped: Record<string, any> = {};
      settingsData.forEach((s: SystemSetting) => {
        if (s.setting_type === 'boolean') {
          mapped[s.setting_key] = s.setting_value === 'true';
        } else if (s.setting_type === 'number') {
          mapped[s.setting_key] = Number(s.setting_value);
        } else {
          mapped[s.setting_key] = s.setting_value;
        }
      });
      setSettings(mapped);
      setHealth(healthData);
      setHasChanges(false);
    } catch (e) {
      console.error(e);
      showToast('error', 'Failed to load system settings backend.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettingsAndHealth();
  }, [loadSettingsAndHealth]);

  const handleChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await adminSettingsService.updateSettings(settings);
      showToast('success', 'Settings saved successfully');
      setHasChanges(false);

      // Update health check just in case config changed things
      const healthData = await adminSettingsService.getHealth();
      setHealth(healthData);
    } catch (e: any) {
      showToast('error', e.response?.data?.detail || 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const runTest = async (testFn: () => Promise<any>, name: string) => {
    setTestMsg(null);
    try {
      const res = await testFn();
      if (res.status === 'success') {
        showToast('success', res.message);
      } else {
        showToast('error', res.message);
      }
    } catch (e: any) {
      showToast('error', `Test failed for ${name}.`);
    }
  };

  const refreshHealth = async () => {
    setHealthLoading(true);
    try {
      const healthData = await adminSettingsService.getHealth();
      setHealth(healthData);
      showToast('success', 'Health status refreshed');
    } catch (e) {
      showToast('error', 'Failed to refresh health');
    } finally {
      setHealthLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--role-primary)' }} />
      </div>
    );
  }

  const renderToggle = (key: string, label: string) => (
    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
      <span className="text-slate-700 font-medium">{label}</span>
      <button
        onClick={() => handleChange(key, !settings[key])}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${settings[key] ? 'bg-[var(--role-primary)]' : 'bg-slate-300'
          }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings[key] ? 'translate-x-4' : 'translate-x-0'
            }`}
        />
      </button>
    </div>
  );

  const renderInput = (key: string, label: string, type: string = "text", placeholder: string = "") => (
    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 gap-4">
      <span className="text-slate-700 font-medium">{label}</span>
      <input
        type={type}
        value={settings[key] || ''}
        placeholder={placeholder}
        onChange={(e) => handleChange(key, type === 'number' ? Number(e.target.value) : e.target.value)}
        className="w-32 px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[var(--role-primary)] text-right font-mono"
      />
    </div>
  );

  const renderSelect = (key: string, label: string, options: { value: string, label: string }[]) => (
    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 gap-4">
      <span className="text-slate-700 font-medium">{label}</span>
      <select
        value={settings[key] || ''}
        onChange={(e) => handleChange(key, e.target.value)}
        className="px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[var(--role-primary)] bg-white cursor-pointer"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  return (
    <div className="space-y-8 max-w-5xl pb-24 relative settings-page">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-[60] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl text-sm font-medium ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
            }`}
          style={{ animation: 'slideInRight 0.3s ease-out' }}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      {/* Floating Save Bar */}
      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transform transition-all">
          <div className="glass-card shadow-2xl px-6 py-4 rounded-full flex items-center gap-6 border-[var(--role-primary)]">
            <span className="text-sm font-medium">You have unsaved changes</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => loadSettingsAndHealth()} disabled={isSaving}>Discard</Button>
              <Button variant="admin" icon={<Save className="w-4 h-4" />} onClick={handleSave} isLoading={isSaving}>Save Changes</Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">System Settings & Configuration</h1>
          <p className="text-xs text-slate-500 mt-1">Configure global application behavior, AI models, security policies, and integrations.</p>
        </div>
        {!hasChanges && <Button variant="admin" icon={<Save className="w-4 h-4" />} onClick={handleSave} isLoading={isSaving}>Save Changes</Button>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* MAINTENANCE / HEALTH */}
        <div className="space-y-6">
          <GlassCard className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5" style={{ color: 'var(--role-primary)' }} /> System Maintenance & Health
              </h3>
              <Button variant="outline" size="sm" onClick={refreshHealth} isLoading={healthLoading}>Refresh</Button>
            </div>
            {health && (
              <div className="space-y-3 text-xs">
                {Object.entries(health).map(([key, info]: [string, any]) => (
                  <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900 capitalize">{key}</span>
                      <span className="text-slate-500 text-[10px] truncate max-w-[200px]">{info.message}</span>
                    </div>
                    <Badge variant={info.status === 'ONLINE' ? 'healthy' : info.status === 'WARNING' ? 'at_risk' : 'critical'}>
                      {info.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => runTest(adminSettingsService.testDatabase, 'Database')}>Test DB Connection</Button>
              <Button variant="outline" size="sm" onClick={() => runTest(adminSettingsService.testGemini, 'Gemini')}>Test Gemini</Button>
              <Button variant="outline" size="sm" onClick={() => runTest(adminSettingsService.testGithub, 'GitHub')}>Test GitHub</Button>
            </div>
          </GlassCard>

          {/* GEMINI AI CONFIGURATION */}
          <GlassCard className="space-y-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
              <Cpu className="w-5 h-5" style={{ color: 'var(--role-secondary)' }} /> Gemini AI Configuration
            </h3>
            <div className="space-y-3 text-xs">
              {renderToggle("gemini_enabled", "Enable Gemini AI System")}
              {renderSelect("gemini_model", "Gemini Model", [
                { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash (Fast)" },
                { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro (Powerful)" },
                { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Latest)" }
              ])}
              {renderInput("gemini_temperature", "Temperature (0.0 - 1.0)", "number")}
              {renderInput("gemini_max_tokens", "Maximum Output Tokens", "number")}
              {renderSelect("ai_response_mode", "AI Response Mode", [
                { value: "concise", label: "Concise & Professional" },
                { value: "detailed", label: "Detailed Explanations" }
              ])}
            </div>
          </GlassCard>
        </div>

        {/* SECURITY & AUTHORIZATION */}
        <div className="space-y-6">
          <GlassCard className="space-y-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
              <Lock className="w-5 h-5" style={{ color: 'var(--role-accent)' }} /> Security & Authorization
            </h3>
            <div className="space-y-3 text-xs">
              {renderToggle("strict_role_verification", "Strict Role Verification on Portals")}
              {renderInput("jwt_token_lifetime", "JWT Token Lifetime (Minutes)", "number")}
              {renderInput("password_hashing_rounds", "Bcrypt Hashing Rounds", "number")}
              {renderInput("session_timeout", "Session Timeout (Minutes)", "number")}
              {renderInput("max_login_attempts", "Maximum Login Attempts", "number")}
              {renderInput("account_lockout_duration", "Account Lockout Duration (Mins)", "number")}
              {renderToggle("captcha_enabled", "Require CAPTCHA before Login")}
              {renderToggle("google_login_enabled", "Enable Google Sign-In")}
            </div>
          </GlassCard>
        </div>

        {/* PROJECT & TASK POLICIES */}
        <div className="space-y-6">
          <GlassCard className="space-y-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
              <FolderKanban className="w-5 h-5" style={{ color: 'var(--role-primary)' }} /> Project & Task Policies
            </h3>
            <div className="space-y-3 text-xs">
              {renderToggle("allow_project_creation", "Allow Admins/Managers to Create Projects")}
              {renderToggle("allow_project_deletion", "Allow Project Deletion")}
              {renderToggle("require_project_manager", "Require Project Manager Assignment")}
              {renderToggle("allow_mult_devs_task", "Allow Multiple Developers Per Task")}
              {renderToggle("require_task_verification", "Require Task Review/Verification")}
              {renderToggle("auto_archive_verified", "Auto Archive Verified Tasks")}
            </div>
          </GlassCard>

          {/* AI COPILOT SETTINGS */}
          <GlassCard className="space-y-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
              <Bot className="w-5 h-5" style={{ color: 'var(--role-secondary)' }} /> AI Copilot Intelligence
            </h3>
            <div className="space-y-3 text-xs">
              {renderToggle("ai_copilot_enabled", "Enable SprintIQ Copilot Helper")}
              {renderSelect("ai_project_context", "Project-Aware Context Scope", [
                { value: "current", label: "Current Active Project Only" },
                { value: "assigned", label: "Assigned Projects" },
                { value: "all_accessible", label: "All Accessible Projects" }
              ])}
              {renderToggle("ai_fallback_enabled", "Enable Built-In AI Fallback Mode")}
            </div>
          </GlassCard>
        </div>

        {/* ACCOUNT POLICIES & NOTIFICATIONS & GITHUB */}
        <div className="space-y-6">
          <GlassCard className="space-y-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
              <Users className="w-5 h-5" style={{ color: 'var(--role-accent)' }} /> User Account Policies
            </h3>
            <div className="space-y-3 text-xs">
              {renderToggle("allow_admin_create_managers", "Allow Admin to Create Manager Accounts")}
              {renderToggle("allow_managers_create_developers", "Allow Managers to Create Developer Accounts")}
              {renderToggle("require_email_verification", "Require Email Verification")}
              {renderToggle("allow_account_disable", "Allow Admins to Disable Accounts")}
              {renderInput("min_password_length", "Minimum Password Length", "number")}
              {renderSelect("default_account_status", "Default Status on Import", [
                { value: "ACTIVE", label: "Active" },
                { value: "PENDING", label: "Pending Review" },
                { value: "INACTIVE", label: "Inactive" }
              ])}
            </div>
          </GlassCard>

          <GlassCard className="space-y-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
              <Github className="w-5 h-5" style={{ color: 'var(--role-primary)' }} /> GitHub Integration
            </h3>
            <div className="space-y-3 text-xs">
              {renderToggle("github_integration_enabled", "Enable Global GitHub Integration")}
              {renderToggle("repo_sync_enabled", "Enable Automated Repository Syncing")}
              {renderInput("sync_interval", "Repository Sync Interval (Minutes)", "number")}
              {renderToggle("webhook_enabled", "Accept GitHub Webhooks")}
            </div>
          </GlassCard>

          <GlassCard className="space-y-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
              <Bell className="w-5 h-5" style={{ color: 'var(--role-secondary)' }} /> Notification Engine
            </h3>
            <div className="space-y-3 text-xs">
              {renderToggle("notify_in_app", "Master: In-App Notifications")}
              {renderToggle("notify_task_assign", "Task Assignment Notifications")}
              {renderToggle("notify_project_assign", "Project Assignment Notifications")}
              {renderToggle("notify_verification", "Task Verification Alerts")}
              {renderToggle("notify_github", "GitHub CI/CD Alerts")}
              {renderToggle("notify_risk", "AI Critical Risk Detection Alerts")}
            </div>
          </GlassCard>
        </div>

      </div>
    </div>
  );
};
