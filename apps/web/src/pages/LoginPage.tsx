import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RoleCode } from '@workdesk/shared';
import { ShieldCheck, Lock, Building, AlertCircle, Users } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const urlError = searchParams.get('error');
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const displayError = error || urlError;

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      setGoogleLoading(true);
      const res = await fetch('/api/v1/auth/google/url');
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { message: text || `HTTP ${res.status} ${res.statusText}` };
      }
      if (!res.ok) {
        throw new Error(data.message || 'Failed to retrieve Google Auth URL');
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      setError(err.message || 'Google Auth initiation failed');
      setGoogleLoading(false);
    }
  };


  const handleDevLogin = async (email: string, fullName: string, roleCode: RoleCode) => {
    try {
      setError(null);
      await login(email, fullName, roleCode);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-6 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg bg-slate-900/70 border border-slate-800 backdrop-blur-xl rounded-2xl p-8 shadow-2xl relative z-10 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center font-bold text-white text-2xl mx-auto shadow-lg shadow-indigo-500/25 mb-3">
            W
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">WorkDesk</h1>
          <p className="text-sm text-slate-400">
            Enterprise Work Management & Accountability Control Tower
          </p>
        </div>

        {/* Error notification */}
        {displayError && (
          <div className="p-4 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">{displayError}</div>
          </div>
        )}

        {/* Google Authentication Section */}
        <div className="pt-2 space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full py-4 px-5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-base flex items-center justify-center gap-3.5 shadow-xl shadow-white/5 hover:shadow-white/10 transition-all border border-slate-200 cursor-pointer active:scale-[0.99] disabled:opacity-60"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>{googleLoading ? 'Redirecting to Google...' : 'Continue with Google Workspace'}</span>
          </button>

          <p className="text-xs text-center text-slate-500">
            Authorized organization accounts only. Sign in with your corporate email.
          </p>

          {/* Quick Identity Sandbox */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-center flex items-center justify-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>Role Identity Sandbox</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                id="login-manager-btn"
                onClick={() => handleDevLogin('akshay.m@datai2i.com', 'Akshay M', RoleCode.ROLE_MANAGER)}
                className="px-3 py-2 rounded-lg bg-purple-950/60 hover:bg-purple-900/80 border border-purple-700/50 text-purple-200 text-xs font-semibold transition-colors"
              >
                Manager
              </button>
              <button
                type="button"
                id="login-lead-btn"
                onClick={() => handleDevLogin('leada_test@datai2i.com', 'Lead A', RoleCode.ROLE_LEAD)}
                className="px-3 py-2 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-700/50 text-cyan-200 text-xs font-semibold transition-colors"
              >
                Lead
              </button>
              <button
                type="button"
                id="login-employee-btn"
                onClick={() => handleDevLogin('rohit@datai2i.com', 'Rohit', RoleCode.ROLE_EMPLOYEE)}
                className="px-3 py-2 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-700/50 text-emerald-200 text-xs font-semibold transition-colors"
              >
                Employee
              </button>
            </div>
          </div>
        </div>

        {/* Security & Access Policy Cards */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-semibold text-slate-200">Super Administrator Governance</span>
              <p className="text-slate-400 leading-relaxed">
                Super Admin (<span className="text-indigo-300 font-mono">akshay.m@datai2i.com</span>) holds global authority across all organizations, user roles, and system workflows.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-3">
            <Building className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-semibold text-slate-200">Manager Approval & Employee ID Required</span>
              <p className="text-slate-400 leading-relaxed">
                Employees can sign in with their corporate email. Dashboard access is activated once a designated Manager approves the account and provisions a unique Employee ID.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>OAuth 2.0 OIDC • AES-256-GCM Session Encryption Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
