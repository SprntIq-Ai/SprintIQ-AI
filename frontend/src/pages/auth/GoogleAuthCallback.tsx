import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/common/Button';

export const GoogleAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'loading' | 'no_account' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setStatus('error');
      setMessage('Google sign-in was cancelled or failed. Please try again.');
      return;
    }
    if (!code) {
      setStatus('error');
      setMessage('Missing Google authorization code.');
      return;
    }

    fetch('/api/auth/google/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setStatus('error');
          setMessage(data.detail || data.message || 'Google sign-in failed. Please try again.');
          return;
        }
        if (data.status === 'no_account') {
          setStatus('no_account');
          setMessage('Your Google account is authenticated, but no SprintIQ account is associated with this email. Please contact an administrator.');
          return;
        }
        if (data.status === 'success' && data.access_token) {
          login(data.access_token, data.refresh_token, data.user);
          const role = data.user?.role;
          if (role === 'admin') navigate('/admin/dashboard', { replace: true });
          else if (role === 'manager') navigate('/manager/dashboard', { replace: true });
          else if (role === 'developer') navigate('/developer/dashboard', { replace: true });
          else navigate('/', { replace: true });
          return;
        }
        setStatus('error');
        setMessage(data.message || 'Google sign-in failed. Please try again.');
      })
      .catch(() => {
        setStatus('error');
        setMessage('Could not reach the server. Please try again.');
      });
  }, [searchParams, login, navigate]);

  return (
    <div className="sprintiq-theme min-h-screen role-page-bg text-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md glass-panel rounded-3xl p-8 border border-[rgba(var(--role-primary-rgb),0.40)] shadow-2xl relative z-10 text-center">
        {status === 'loading' && (
          <div className="py-10 space-y-4">
            <div className="w-12 h-12 rounded-full border-4 border-[var(--role-primary)] border-t-transparent animate-spin mx-auto" />
            <p className="text-sm font-medium text-slate-600">Completing Google sign-in...</p>
          </div>
        )}

        {status === 'no_account' && (
          <div className="py-6 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7 text-amber-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Google Authenticated</h3>
            <p className="text-xs text-slate-500">{message}</p>
            <Link to="/" className="inline-block mt-2 text-[#0EA5E9] hover:underline text-xs font-medium">Return to home</Link>
          </div>
        )}

        {status === 'error' && (
          <div className="py-6 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7 text-rose-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Sign-in Failed</h3>
            <p className="text-xs text-slate-500">{message}</p>
            <Link to="/" className="inline-block mt-2 text-[#0EA5E9] hover:underline text-xs font-medium">Return to home</Link>
          </div>
        )}

        {(status === 'no_account' || status === 'error') && (
          <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => navigate('/login/admin')}>
            Go to Admin Login
          </Button>
        )}
      </div>
    </div>
  );
};