import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { UserCheck, Lock, User, Phone, CheckCircle, AlertTriangle, Sparkles } from 'lucide-react';
import { authService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/common/Button';

export const AcceptInvite: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const { login } = useAuth();

  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setErrorMsg("Invitation token missing from URL query parameter.");
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await authService.acceptInvite({
        token,
        password,
        full_name: fullName,
        phone,
        bio,
      });

      login(res.access_token, res.refresh_token, res.user);

      if (res.user.role === 'admin') {
        navigate('/admin/dashboard');
      } else if (res.user.role === 'manager') {
        navigate('/manager/dashboard');
      } else {
        navigate('/developer/dashboard');
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setErrorMsg(detail || 'Failed to complete registration. Token may be invalid or expired.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[rgba(var(--role-primary-rgb),0.15)] blur-3xl rounded-full pointer-events-none" />

      <div className="w-full max-w-lg glass-panel rounded-3xl p-8 border border-[var(--role-border)] shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{
              background: 'linear-gradient(135deg, var(--role-primary), var(--role-accent))',
              boxShadow: '0 8px 24px var(--role-glow)',
            }}
          >
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 font-outfit">Accept Team Invitation</h2>
          <p className="text-xs text-slate-500 mt-1">Complete your profile setup to activate your SprintIQ account</p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Invitation Token</label>
            <input
              type="text"
              readOnly
              value={token || 'No Token Provided'}
              className="w-full px-4 py-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-primary)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Create Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-primary)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone Number (Optional)</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-primary)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Bio (Optional)</label>
            <div className="relative">
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell the team a little about yourself..."
                rows={3}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-primary)]"
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="admin"
            size="lg"
            isLoading={isLoading}
            className="w-full mt-4"
          >
            Activate Account & Complete Setup
          </Button>
        </form>
      </div>
    </div>
  );
};
