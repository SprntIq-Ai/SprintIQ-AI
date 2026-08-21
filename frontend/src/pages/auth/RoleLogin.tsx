import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/common/Button';

export interface RoleLoginConfig {
  role: 'admin' | 'manager' | 'developer';
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  emailLabel: string;
  loginLabel: string;
  defaultEmail: string;
  defaultPassword: string;
  loginFn: (data: { email: string; password: string; remember_me: boolean; captcha_id?: string; captcha_code?: string }) => Promise<{
    access_token: string;
    refresh_token: string;
    user: any;
  }>;
  redirectPath: string;
  variant: 'admin' | 'manager' | 'developer';
  portalLinks: { to: string; label: string }[];
  forgotColor: string;
  iconGradient: string;
}

type ForgotStage = 'verify' | 'reset' | 'done';

const G_API = '/api/auth';

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data.detail || data.message || 'An error occurred. Please try again.';
  } catch {
    return 'An error occurred. Please try again.';
  }
}

const GoogleIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

export const RoleLogin: React.FC<RoleLoginConfig> = (cfg) => {
  const { login } = useAuth();

  const [email, setEmail] = useState(cfg.defaultEmail);
  const [password, setPassword] = useState(cfg.defaultPassword);
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [forgotMode, setForgotMode] = useState(false);
  const [forgotStage, setForgotStage] = useState<ForgotStage>('verify');
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaEntered, setCaptchaEntered] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotInfo, setForgotInfo] = useState('');
  const [resetId, setResetId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');

  const [publicSettings, setPublicSettings] = useState({ captcha_enabled: false, google_login_enabled: true });

  useEffect(() => {
    fetch(`${G_API}/public-settings`)
      .then(res => res.json())
      .then(data => setPublicSettings(data))
      .catch(() => { });
  }, []);

  const fetchCaptcha = useCallback(async () => {
    try {
      const res = await fetch(`${G_API}/captcha`);
      if (!res.ok) throw new Error('captcha fetch failed');
      const data = await res.json();
      setCaptchaId(data.captcha_id || '');
      setCaptchaCode(data.code || '');
      setCaptchaEntered('');
    } catch {
      setForgotError('Could not load the verification code. Please refresh and try again.');
    }
  }, []);

  useEffect(() => {
    fetchCaptcha();
  }, [fetchCaptcha]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');
    setForgotError('');

    // Pre-flight CAPTCHA Validation if enabled
    if (publicSettings.captcha_enabled) {
      if (!captchaEntered || captchaEntered.trim() === '') {
        setErrorMessage('Please enter the CAPTCHA code.');
        setIsLoading(false);
        return;
      }
    }

    try {
      const loginPayload: any = { email, password, remember_me: rememberMe };
      if (publicSettings.captcha_enabled) {
        loginPayload.captcha_id = captchaId;
        loginPayload.captcha_code = captchaEntered;
      }

      // Implementing Request Timeout manually since loginFn is abstract
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 10000)
      );

      const res: any = await Promise.race([
        cfg.loginFn(loginPayload),
        timeoutPromise
      ]);

      const userRole = res.user?.role?.toLowerCase();
      if (userRole !== cfg.role.toLowerCase()) {
        const displayRole = cfg.role.charAt(0).toUpperCase() + cfg.role.slice(1);
        throw new Error(`ROLE_MISMATCH:${displayRole}`);
      }

      login(res.access_token, res.refresh_token, res.user);

      // We handle navigation here but we reset loading state anyway
      window.location.href = cfg.redirectPath;
    } catch (err: any) {
      if (err.message === 'TIMEOUT') {
        setErrorMessage('Authentication server is not responding. Please try again.');
      } else if (err.message === 'Network Error') {
        setErrorMessage('Unable to connect to the SprintIQ authentication server.');
      } else if (err.message && err.message.startsWith('ROLE_MISMATCH:')) {
        const rName = err.message.split(':')[1];
        setErrorMessage(`This account does not have ${rName} access.`);
      } else {
        const errDetail = err?.response?.data?.detail || err?.response?.data?.message || 'Invalid email or password.';
        setErrorMessage(errDetail);
      }

      if (publicSettings.captcha_enabled) {
        fetchCaptcha();
        setCaptchaEntered('');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setForgotError('');
    setForgotInfo('');
    try {
      const res = await fetch(`${G_API}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, captcha_id: captchaId, entered_code: captchaEntered }),
      });
      const data = await res.json();
      if (!res.ok) {
        setForgotError(data.detail || data.message || 'Verification failed. Please try again.');
        fetchCaptcha();
        return;
      }
      if (data.status === 'success' && data.reset_id) {
        setResetId(data.reset_id);
        setForgotStage('reset');
      } else {
        setForgotInfo(data.message || 'Verification successful.');
        fetchCaptcha();
        setForgotStage('verify');
        setResetId('');
      }
    } catch {
      setForgotError('Could not reach the server. Please try again.');
      fetchCaptcha();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetId) {
      setForgotError('Session expired. Please start over.');
      setForgotStage('verify');
      fetchCaptcha();
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotError('Passwords do not match.');
      return;
    }
    setIsResetting(true);
    setForgotError('');
    try {
      const res = await fetch(`${G_API}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset_id: resetId, new_password: newPassword, confirm_password: confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setForgotError(data.detail || data.message || 'Could not reset the password.');
        return;
      }
      setForgotStage('done');
    } catch {
      setForgotError('Could not reach the server. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  const closeForgot = () => {
    setForgotMode(false);
    setForgotStage('verify');
    setForgotError('');
    setForgotInfo('');
    setResetId('');
    setNewPassword('');
    setConfirmPassword('');
    setCaptchaEntered('');
    fetchCaptcha();
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setGoogleError('');
    try {
      const res = await fetch(`${G_API}/google`);
      const data = await res.json();
      if (!res.ok) {
        setGoogleError(data.detail || 'Google sign-in is unavailable. Please try again.');
        return;
      }
      if (data.configured && data.authorization_url) {
        window.location.href = data.authorization_url;
        return;
      }
      setGoogleError(data.message || 'Google sign-in is not configured yet. Contact your administrator.');
    } catch {
      setGoogleError('Google sign-in could not be completed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const inputCls = 'w-full pl-10 pr-4 py-3 rounded-xl role-input text-slate-900 text-xs transition-all border border-[var(--role-border-subtle)] focus:outline-none focus:border-[var(--role-primary)]';

  return (
    <div className="sprintiq-theme min-h-screen role-page-bg text-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[rgba(var(--role-primary-rgb),0.15)] blur-3xl rounded-full pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] bg-[rgba(var(--role-secondary-rgb),0.10)] blur-3xl rounded-full pointer-events-none animate-pulse" />

      <div className="w-full max-w-md glass-panel rounded-3xl p-8 border border-[rgba(var(--role-primary-rgb),0.40)] shadow-2xl relative z-10">
        <div className="text-center mb-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{
              background: cfg.iconGradient,
              boxShadow: '0 8px 24px rgba(var(--role-primary-rgb), 0.35)',
            }}
          >
            {cfg.icon}
          </div>
          <h2 className="text-2xl font-bold text-slate-900 font-outfit">{cfg.title}</h2>
          <p className="text-xs text-slate-500 mt-1">{cfg.subtitle}</p>
          <div className="mt-3 h-0.5 w-16 mx-auto rounded-full" style={{ background: 'linear-gradient(to right, var(--role-primary), var(--role-secondary), var(--role-accent))' }} />
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}
        {googleError && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{googleError}</span>
          </div>
        )}
        {forgotInfo && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{forgotInfo}</span>
          </div>
        )}

        {!forgotMode && (
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">{cfg.emailLabel}</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={cfg.defaultEmail} className={inputCls} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 rounded-xl role-input text-slate-900 text-xs transition-all border border-[var(--role-border-subtle)] focus:outline-none focus:border-[var(--role-primary)]"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-900">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {publicSettings.captcha_enabled && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Verification Code</label>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 rounded-xl bg-slate-100 border border-slate-200 px-4 py-3 text-center tracking-[0.4em] font-mono text-xl font-bold text-slate-800 select-all">
                    {captchaCode || '·····'}
                  </div>
                  <button
                    type="button"
                    onClick={fetchCaptcha}
                    title="Refresh code"
                    className="w-11 h-11 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-[var(--role-primary)] text-lg flex items-center justify-center"
                  >
                    ↻
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    maxLength={6}
                    value={captchaEntered}
                    onChange={(e) => setCaptchaEntered(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Enter verification code"
                    className="w-full px-4 py-3 rounded-xl role-input text-slate-900 text-xs transition-all border border-[var(--role-border-subtle)] focus:outline-none focus:border-[var(--role-primary)]"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded bg-white border-slate-300 text-[var(--role-primary)] focus:ring-[rgba(var(--role-primary-rgb),0.40)]"
                />
                Remember me
              </label>
              <a href="#" onClick={(e) => { e.preventDefault(); setForgotMode(true); }} className={cfg.forgotColor + ' hover:underline'}>
                Forgot password?
              </a>
            </div>

            <Button type="submit" variant={cfg.variant} size="lg" isLoading={isLoading} className="w-full mt-2">
              {cfg.loginLabel}
            </Button>

            {publicSettings.google_login_enabled && (
              <>
                <div className="flex items-center gap-3 my-1">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">or</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                <Button type="button" variant="outline" size="lg" isLoading={googleLoading} onClick={handleGoogle} className="w-full">
                  <span className="flex items-center justify-center gap-2">
                    <GoogleIcon />
                    Continue with Google
                  </span>
                </Button>
              </>
            )}
          </form>
        )}

        {forgotMode && (
          <form onSubmit={forgotStage === 'reset' ? handleResetPassword : handleForgotVerify} className="space-y-5 pt-2">
            {forgotError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotStage === 'done' ? (
              <div className="text-center py-4 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Password Reset Successful</h3>
                <p className="text-xs text-slate-500">Your password has been updated. You can now sign in with your new password.</p>
                <Button type="button" variant={cfg.variant} size="lg" onClick={closeForgot} className="w-full">
                  Continue to Login
                </Button>
              </div>
            ) : (
              <>
                <div className="text-left">
                  <h3 className="text-base font-bold text-slate-900">Forgot Password?</h3>
                  <p className="text-xs text-slate-500 mt-1">Enter your registered email and the verification code shown below.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">Verification Code</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-xl bg-slate-100 border border-slate-200 px-4 py-3 text-center tracking-[0.4em] font-mono text-xl font-bold text-slate-800 select-all">
                      {captchaCode || '·····'}
                    </div>
                    <button
                      type="button"
                      onClick={fetchCaptcha}
                      title="Refresh code"
                      className="w-11 h-11 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-[var(--role-primary)] text-lg flex items-center justify-center"
                    >
                      ↻
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5">Enter the numbers shown above. A new code is generated on every refresh.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">Enter the numbers shown above</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      maxLength={6}
                      value={captchaEntered}
                      onChange={(e) => setCaptchaEntered(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="0000"
                      className="w-full pl-10 pr-4 py-3 rounded-xl role-input text-slate-900 text-xs transition-all border border-[var(--role-border-subtle)] focus:outline-none focus:border-[var(--role-primary)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">Registered Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={cfg.defaultEmail} className={inputCls} />
                  </div>
                </div>

                {forgotStage === 'verify' && (
                  <Button type="submit" variant={cfg.variant} size="lg" isLoading={isLoading} className="w-full">
                    Verify
                  </Button>
                )}

                {forgotStage === 'reset' && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-2">New Password</label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-4 py-3 rounded-xl role-input text-slate-900 text-xs transition-all border border-[var(--role-border-subtle)] focus:outline-none focus:border-[var(--role-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-2">Confirm Password</label>
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-4 py-3 rounded-xl role-input text-slate-900 text-xs transition-all border border-[var(--role-border-subtle)] focus:outline-none focus:border-[var(--role-primary)]"
                      />
                    </div>
                    <ul className="text-[11px] text-slate-500 space-y-1">
                      <li>✓ Minimum 8 characters</li>
                      <li>✓ Uppercase</li>
                      <li>✓ Lowercase</li>
                      <li>✓ Number</li>
                    </ul>
                    <Button type="submit" variant={cfg.variant} size="lg" isLoading={isResetting} className="w-full">
                      Reset Password
                    </Button>
                  </>
                )}

                <div className="flex items-center justify-between text-xs">
                  <a href="#" onClick={(e) => { e.preventDefault(); closeForgot(); }} className={cfg.forgotColor + ' hover:underline'}>
                    Back to login
                  </a>
                  <span className="text-slate-400">{forgotStage === 'verify' ? 'Step 1 of 2' : 'Step 2 of 2'}</span>
                </div>
              </>
            )}
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-slate-200 text-center text-xs text-slate-500">
          {cfg.portalLinks.map((l, i) => (
            <span key={l.to}>
              {i > 0 && <span className="mx-1">•</span>}
              <Link to={l.to} className="text-[#0EA5E9] hover:underline font-medium">{l.label}</Link>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};