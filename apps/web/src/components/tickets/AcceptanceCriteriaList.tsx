import React, { useState } from 'react';
import { AcceptanceCriterionDto } from '@workdesk/shared';
import { CheckSquare, Square, Plus, Trash2, AlertCircle } from 'lucide-react';

interface Props {
  ticketId: string;
  criteria: AcceptanceCriterionDto[];
  onRefresh: () => void;
  canEdit: boolean;
}

export const AcceptanceCriteriaList: React.FC<Props> = ({
  ticketId,
  criteria,
  onRefresh,
  canEdit,
}) => {
  const [newDesc, setNewDesc] = useState('');
  const [isMandatory, setIsMandatory] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesc.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/tasks/${ticketId}/criteria`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ description: newDesc.trim(), isMandatory }),
      });
      if (res.ok) {
        setNewDesc('');
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to add criterion:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (criterionId: string) => {
    try {
      const res = await fetch(`/api/v1/tasks/criteria/${criterionId}/toggle`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to toggle criterion:', err);
    }
  };

  const handleDelete = async (criterionId: string) => {
    try {
      const res = await fetch(`/api/v1/tasks/criteria/${criterionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to delete criterion:', err);
    }
  };

  const completedCount = criteria.filter((c) => c.isCompleted).length;
  const mandatoryIncomplete = criteria.filter((c) => c.isMandatory && !c.isCompleted).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-indigo-400" />
          <h3 className="font-semibold text-white text-sm tracking-wide">Acceptance Criteria</h3>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
            {completedCount}/{criteria.length} completed
          </span>
        </div>
        {mandatoryIncomplete > 0 && (
          <span className="flex items-center gap-1 text-xs font-mono text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded">
            <AlertCircle className="w-3.5 h-3.5" />
            {mandatoryIncomplete} mandatory gate outstanding
          </span>
        )}
      </div>

      <div className="space-y-2">
        {criteria.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-2">No acceptance criteria defined yet.</p>
        ) : (
          criteria.map((c) => (
            <div
              key={c.id}
              className={`flex items-start justify-between p-3 rounded-lg border transition-all ${
                c.isCompleted
                  ? 'bg-slate-950/60 border-slate-800/60 text-slate-400'
                  : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start gap-3 flex-1">
                <button
                  type="button"
                  onClick={() => handleToggle(c.id)}
                  className="mt-0.5 text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {c.isCompleted ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-500 hover:text-indigo-400" />
                  )}
                </button>
                <div className="space-y-1">
                  <p className={`text-sm ${c.isCompleted ? 'line-through text-slate-500' : ''}`}>
                    {c.description}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                    {c.isMandatory ? (
                      <span className="text-indigo-400 font-semibold bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-800/30">
                        Mandatory
                      </span>
                    ) : (
                      <span className="text-slate-500">Optional</span>
                    )}
                    {c.completedByName && (
                      <span className="text-emerald-400">
                        ✓ by {c.completedByName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  className="text-slate-600 hover:text-rose-400 transition-colors p-1"
                  title="Delete criterion"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {canEdit && (
        <form onSubmit={handleAdd} className="space-y-2 pt-2 border-t border-slate-800/60">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Add an acceptance requirement..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={isSubmitting || !newDesc.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={isMandatory}
              onChange={(e) => setIsMandatory(e.target.checked)}
              className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0"
            />
            Mandatory for Done Gate
          </label>
        </form>
      )}
    </div>
  );
};
