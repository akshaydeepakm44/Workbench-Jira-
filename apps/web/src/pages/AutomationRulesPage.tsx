import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { RoleCode, AutomationRuleDto } from '@workdesk/shared';
import {
  Zap,
  Plus,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Clock,
  Sparkles,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

export const AutomationRulesPage: React.FC = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<{ id: string; name: string; key: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [rules, setRules] = useState<AutomationRuleDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState('TASK_CREATED');
  const [conditionValue, setConditionValue] = useState('TASK');
  const conditionField = 'typeEquals';
  const [actionType, setActionType] = useState('SET_PRIORITY');
  const [actionValue, setActionValue] = useState('Critical');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isLeadOrManager =
    user?.roleCode === RoleCode.ROLE_MANAGER || user?.roleCode === RoleCode.ROLE_LEAD;

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      fetchRules(selectedProjectId);
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

  const fetchRules = async (projectId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/automation/rules/project/${projectId}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setRules(data || []);
      } else {
        setRules([]);
      }
    } catch (err) {
      console.error('Failed to load automation rules', err);
      setRules([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedProjectId) return;
    setSubmitting(true);
    setErrorMsg(null);

    const conditions: Record<string, any> = {};
    if (conditionField && conditionValue) {
      conditions[conditionField] = conditionValue;
    }

    const actions: Record<string, any> = { actionType };
    if (actionType === 'SET_PRIORITY') {
      actions.priority = actionValue;
    } else if (actionType === 'TRANSITION') {
      actions.targetStatus = actionValue;
    }

    try {
      const res = await fetch('/api/v1/automation/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId: selectedProjectId,
          name,
          description: description || undefined,
          eventType,
          conditions,
          actions,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create automation rule');
      }

      setShowCreateModal(false);
      setName('');
      setDescription('');
      fetchRules(selectedProjectId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating rule');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleRule = async (rule: AutomationRuleDto) => {
    try {
      await fetch(`/api/v1/automation/rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isEnabled: !rule.isEnabled }),
      });
      fetchRules(selectedProjectId);
    } catch (err) {
      console.error('Failed to toggle rule', err);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this automation rule?')) return;
    try {
      await fetch(`/api/v1/automation/rules/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      fetchRules(selectedProjectId);
    } catch (err) {
      console.error('Failed to delete rule', err);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-sm font-semibold tracking-wide uppercase">
            <Zap className="w-4 h-4" />
            Automation & Intelligence
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight mt-1">
            Governed Automation Engine
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Lightweight Event-Condition-Action workflows with recursion safety, rate limits, and audit logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
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
              <span>Create Rule</span>
            </button>
          )}
        </div>
      </div>

      {/* Safety Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Recursion Limit</div>
            <div className="text-sm font-bold text-slate-200">Max Depth = 2 (Enforced)</div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Project Rate Limiting</div>
            <div className="text-sm font-bold text-slate-200">50 executions / project / min</div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Runtime Authorization</div>
            <div className="text-sm font-bold text-slate-200">Auto-Disabled on Demotion</div>
          </div>
        </div>
      </div>

      {/* Rules List */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm animate-pulse">
          Loading automation rules...
        </div>
      ) : rules.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/30 rounded-xl border border-slate-800/80">
          <Zap className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-slate-300 font-medium">No automation rules configured</h3>
          <p className="text-slate-500 text-sm mt-1">
            Create automated rules to set priority, assign work, or transition tasks automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                      rule.isEnabled
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                    }`}
                  >
                    {rule.isEnabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                  <h3 className="text-base font-semibold text-slate-100">{rule.name}</h3>
                </div>

                {rule.description && (
                  <p className="text-xs text-slate-400">{rule.description}</p>
                )}

                <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-400 pt-1">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-indigo-300">
                    EVENT: {rule.eventType}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300">
                    IF: {JSON.stringify(rule.conditions)}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300">
                    THEN: {JSON.stringify(rule.actions)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                <button
                  onClick={() => handleToggleRule(rule)}
                  className={`p-2 rounded-lg transition-colors ${
                    rule.isEnabled ? 'text-emerald-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-800'
                  }`}
                  title={rule.isEnabled ? 'Disable Rule' : 'Enable Rule'}
                >
                  {rule.isEnabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                </button>
                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  className="p-2 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                  title="Delete Rule"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
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
                <Zap className="w-5 h-5 text-indigo-400" />
                Create Automation Rule
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

            <form onSubmit={handleCreateRule} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Rule Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Elevate priority on high-impact items"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Optional brief description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">When Event Occurs</label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="TASK_CREATED">TASK_CREATED</option>
                    <option value="TASK_STATUS_CHANGED">TASK_STATUS_CHANGED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Action To Take</label>
                  <select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="SET_PRIORITY">SET_PRIORITY</option>
                    <option value="TRANSITION">TRANSITION</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Condition Match</label>
                  <input
                    type="text"
                    placeholder="e.g. TASK"
                    value={conditionValue}
                    onChange={(e) => setConditionValue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Action Value</label>
                  <input
                    type="text"
                    placeholder="e.g. Critical or IN_PROGRESS"
                    value={actionValue}
                    onChange={(e) => setActionValue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
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
                  {submitting ? 'Creating...' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
