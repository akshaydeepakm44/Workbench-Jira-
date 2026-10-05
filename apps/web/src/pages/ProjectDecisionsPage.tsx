import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { RoleCode, ProjectDecisionDto } from '@workdesk/shared';
import {
  FileText,
  Plus,
  Search,
  User,
  AlertCircle,
  Clock,
  Sparkles,
  Link as LinkIcon,
  Lock,
  Shield,
  Users,
} from 'lucide-react';

export const ProjectDecisionsPage: React.FC = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<{ id: string; name: string; key: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [decisions, setDecisions] = useState<ProjectDecisionDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [rationale, setRationale] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED'>('APPROVED');
  const [visibility, setVisibility] = useState<'myself' | 'team' | 'core'>('team');
  const [visibilityFilter, setVisibilityFilter] = useState<'ALL' | 'MYSELF' | 'TEAM' | 'CORE'>('ALL');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isLeadOrManager =
    user?.roleCode === RoleCode.ROLE_MANAGER || user?.roleCode === RoleCode.ROLE_LEAD;

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      fetchDecisions(selectedProjectId);
    }
  }, [selectedProjectId]);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/v1/projects', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const list = data?.items || data || [];
        setProjects(list);
        if (list.length > 0) {
          setSelectedProjectId(list[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load projects', err);
    }
  };

  const fetchDecisions = async (projectId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/decisions/project/${projectId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDecisions(data || []);
      } else {
        setDecisions([]);
      }
    } catch (err) {
      console.error('Failed to load decisions', err);
      setDecisions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !summary.trim() || !selectedProjectId) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/v1/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId: selectedProjectId,
          title,
          summary,
          rationale: rationale || undefined,
          status,
          visibility: visibility.toUpperCase(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to create decision');
      }

      setShowCreateModal(false);
      setTitle('');
      setSummary('');
      setRationale('');
      setVisibility('team');
      fetchDecisions(selectedProjectId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create decision');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDecisions = decisions.filter((d) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      d.title.toLowerCase().includes(query) ||
      d.summary.toLowerCase().includes(query) ||
      (d.rationale && d.rationale.toLowerCase().includes(query));

    const vis = (d.visibility || 'TEAM').toUpperCase();
    const matchesVis = visibilityFilter === 'ALL' || vis === visibilityFilter;

    return matchesSearch && matchesVis;
  });

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'APPROVED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'PROPOSED':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'REJECTED':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'SUPERSEDED':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
      default:
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
    }
  };

  const getVisibilityBadge = (v?: string) => {
    const vis = (v || 'TEAM').toUpperCase();
    switch (vis) {
      case 'MYSELF':
        return {
          label: 'Myself (Private)',
          className: 'bg-purple-500/15 text-purple-300 border-purple-500/40',
          icon: Lock,
          description: 'Only previewed to manager himself',
        };
      case 'CORE':
        return {
          label: 'Core (Employees & HR)',
          className: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
          icon: Shield,
          description: 'Employees & HR only (hidden from interns)',
        };
      case 'TEAM':
      default:
        return {
          label: 'Team (All)',
          className: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
          icon: Users,
          description: 'Shown to all project members',
        };
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-sm font-semibold tracking-wide uppercase">
            <FileText className="w-4 h-4" />
            Productivity & Traceability
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight mt-1">
            Project Decision Log
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Immutable, auditable historical records of architecture and governance decisions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Project selector */}
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.key})
              </option>
            ))}
          </select>

          {isLeadOrManager && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors shadow-lg shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Record Decision</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search decisions by title, summary, or rationale..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Visibility Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          {(['ALL', 'MYSELF', 'TEAM', 'CORE'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setVisibilityFilter(tab)}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                visibilityFilter === tab
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab === 'ALL' ? 'All' : tab === 'MYSELF' ? 'Myself' : tab === 'TEAM' ? 'Team' : 'Core'}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-400 font-mono px-2 self-center">
          {filteredDecisions.length} recorded
        </div>
      </div>

      {/* Decision Cards List */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm animate-pulse">
          Loading decision log...
        </div>
      ) : filteredDecisions.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/30 rounded-xl border border-slate-800/80">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-slate-300 font-medium">No decisions recorded</h3>
          <p className="text-slate-500 text-sm mt-1">
            {searchQuery
              ? 'No decisions match the current query.'
              : 'Record architectural or delivery decisions to maintain immutable traceability.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredDecisions.map((decision) => (
            <div
              key={decision.id}
              className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${getStatusBadge(
                        decision.status,
                      )}`}
                    >
                      {decision.status}
                    </span>

                    {(() => {
                      const visBadge = getVisibilityBadge(decision.visibility);
                      const VisIcon = visBadge.icon;
                      return (
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium border flex items-center gap-1.5 ${visBadge.className}`}
                          title={visBadge.description}
                        >
                          <VisIcon className="w-3 h-3" />
                          <span>{visBadge.label}</span>
                        </span>
                      );
                    })()}

                    <h3 className="text-lg font-semibold text-slate-100">{decision.title}</h3>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-4 flex-wrap">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      Decided by {decision.decidedByName}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      {new Date(decision.createdAt).toLocaleDateString()}
                    </span>
                    {decision.meetingTitle && (
                      <span className="flex items-center gap-1 text-cyan-400">
                        <LinkIcon className="w-3.5 h-3.5" />
                        Meeting: {decision.meetingTitle}
                      </span>
                    )}
                    {decision.taskTicketId && (
                      <span className="flex items-center gap-1 text-indigo-400 font-mono">
                        <LinkIcon className="w-3.5 h-3.5" />
                        {decision.taskTicketId}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-sm text-slate-300 bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80">
                <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">
                  Decision Summary
                </div>
                {decision.summary}
              </div>

              {decision.rationale && (
                <div className="text-sm text-slate-400 pl-3 border-l-2 border-slate-700">
                  <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold block mb-0.5">
                    Rationale
                  </span>
                  {decision.rationale}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                Record Project Decision
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateDecision} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Architectural standard for caching"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Visibility & Audience Scope *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Myself */}
                  <button
                    type="button"
                    onClick={() => setVisibility('myself')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      visibility === 'myself'
                        ? 'bg-purple-950/50 border-purple-500 text-purple-200 shadow-md shadow-purple-950/40 ring-1 ring-purple-500'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Lock className="w-3.5 h-3.5 text-purple-400" />
                      <span>Myself</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                      Private to you only (manager self-view)
                    </div>
                  </button>

                  {/* Team */}
                  <button
                    type="button"
                    onClick={() => setVisibility('team')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      visibility === 'team'
                        ? 'bg-blue-950/50 border-blue-500 text-blue-200 shadow-md shadow-blue-950/40 ring-1 ring-blue-500'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Users className="w-3.5 h-3.5 text-blue-400" />
                      <span>Team</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                      Shown to all project members
                    </div>
                  </button>

                  {/* Core */}
                  <button
                    type="button"
                    onClick={() => setVisibility('core')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      visibility === 'core'
                        ? 'bg-cyan-950/50 border-cyan-500 text-cyan-200 shadow-md shadow-cyan-950/40 ring-1 ring-cyan-500'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Shield className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Core</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                      Employees & HR only (hidden from interns)
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Summary *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe the agreed decision and scope of impact..."
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Rationale / Context
                </label>
                <textarea
                  rows={2}
                  placeholder="Why was this choice made? Trade-offs considered..."
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="APPROVED">APPROVED</option>
                  <option value="PROPOSED">PROPOSED</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="REJECTED">REJECTED</option>
                  <option value="SUPERSEDED">SUPERSEDED</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Recording...' : 'Record Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
