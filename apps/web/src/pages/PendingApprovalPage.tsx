import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Clock, ShieldAlert, CheckCircle2, RefreshCw, LogOut } from 'lucide-react';

export const PendingApprovalPage: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-6 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl bg-slate-900/70 border border-slate-800 backdrop-blur-xl rounded-2xl p-8 shadow-2xl relative z-10 space-y-6">
        {/* Status Icon */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto shadow-lg shadow-amber-500/10 mb-3">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Account Awaiting Approval</h1>
          <p className="text-sm text-slate-400">
            Welcome to WorkDesk, <span className="text-white font-medium">{user?.fullName}</span>.
          </p>
        </div>

        {/* User Card */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-11 h-11 rounded-full border border-slate-700" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-300">
                {user?.fullName?.charAt(0) || 'U'}
              </div>
            )}
            <div>
              <div className="text-sm font-semibold text-white">{user?.fullName}</div>
              <div className="text-xs text-slate-400 font-mono">{user?.email}</div>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            Pending Approval
          </span>
        </div>

        {/* Verification Steps */}
        <div className="space-y-3 p-5 rounded-xl bg-slate-950/40 border border-slate-800/80">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Access Activation Flow</h3>
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Google Corporate Workspace identity verified</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-amber-300 font-medium">
              <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>Manager assignment of unique Employee ID & Team</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <ShieldAlert className="w-4 h-4 text-slate-600 flex-shrink-0" />
              <span>Dashboard & Execution Workspace activation</span>
            </div>
          </div>
        </div>

        {/* Notice Box */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 leading-relaxed">
          Please notify your designated Organization Manager or Team Lead. Once your Employee ID is registered in the system, you will have immediate access to your tickets, meetings, and daily stand-ups.
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => window.location.reload()}
            className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Check Approval Status</span>
          </button>

          <button
            onClick={logout}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
