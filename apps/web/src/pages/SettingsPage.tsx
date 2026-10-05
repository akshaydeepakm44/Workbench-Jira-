import React from 'react';
import { Settings, Globe, Database } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="pb-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-purple-400" />
          <span>System Settings & Configuration</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Organization identity, security domains, and integration configurations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-400" />
            <span>Google Workspace OIDC</span>
          </h3>
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Domain Restriction</span>
              <span className="font-mono text-emerald-400">company.com (Internal Active)</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Google Meet Conference Engine</span>
              <span className="font-mono text-slate-200">conferenceDataVersion = 1 (Ready)</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Token Refresh Strategy</span>
              <span className="text-slate-300">Just-In-Time (JIT) with Redis/in-process locking</span>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <span>Persistence & Data Isolation</span>
          </h3>
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Active Database</span>
              <span className="font-mono text-slate-200">SQLite (dev.db) / Prisma Client</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Production Target</span>
              <span className="font-mono text-indigo-400">PostgreSQL 16+ via instance deploy</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Data Isolation Policy</span>
              <span className="text-emerald-400 font-semibold">Strict 404 (Zero Information Leakage)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
