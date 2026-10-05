import React, { useState } from 'react';
import { TaskPointDto, RoleCode } from '@workdesk/shared';
import { Target, CheckCircle2, Circle, Plus, Trash2, ShieldAlert } from 'lucide-react';

interface Props {
  ticketId: string;
  points: TaskPointDto[];
  userRole?: RoleCode;
  onRefresh: () => void;
}

export const GuidancePointsList: React.FC<Props> = ({
  ticketId,
  points,
  userRole,
  onRefresh,
}) => {
  const [content, setContent] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canAdd = userRole !== RoleCode.ROLE_EMPLOYEE;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/tasks/${ticketId}/guidance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: content.trim(), isRequired }),
      });
      if (res.ok) {
        setContent('');
        setIsRequired(false);
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to add guidance point:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (pointId: string) => {
    try {
      const res = await fetch(`/api/v1/tasks/guidance/${pointId}/toggle`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to toggle guidance point:', err);
    }
  };

  const handleDelete = async (pointId: string) => {
    try {
      const res = await fetch(`/api/v1/tasks/guidance/${pointId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to delete guidance point:', err);
    }
  };

  const requiredIncomplete = points.filter((p) => p.isRequired && !p.isCompleted).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-amber-400" />
          <h3 className="font-semibold text-white text-sm tracking-wide">Lead & Manager Directives</h3>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
            {points.length} points
          </span>
        </div>
        {requiredIncomplete > 0 && (
          <span className="flex items-center gap-1 text-xs font-mono text-rose-400 bg-rose-950/40 border border-rose-800/40 px-2 py-0.5 rounded">
            <ShieldAlert className="w-3.5 h-3.5" />
            {requiredIncomplete} required gate
          </span>
        )}
      </div>

      <div className="space-y-2">
        {points.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-2">No guidance directives attached yet.</p>
        ) : (
          points.map((p) => (
            <div
              key={p.id}
              className={`flex items-start justify-between p-3 rounded-lg border transition-all ${
                p.isCompleted
                  ? 'bg-slate-950/60 border-slate-800/60 text-slate-400'
                  : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start gap-3 flex-1">
                <button
                  type="button"
                  onClick={() => handleToggle(p.id)}
                  className="mt-0.5 text-amber-400 hover:text-amber-300 transition-colors"
                >
                  {p.isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-500 hover:text-amber-400" />
                  )}
                </button>
                <div className="space-y-1">
                  <p className={`text-sm ${p.isCompleted ? 'line-through text-slate-500' : ''}`}>
                    {p.content}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                    <span className="text-slate-400">By {p.authorName || 'Lead'}</span>
                    {p.isRequired ? (
                      <span className="text-rose-400 font-semibold bg-rose-950/50 px-1.5 py-0.5 rounded border border-rose-800/30">
                        Required
                      </span>
                    ) : (
                      <span className="text-slate-500">Advisory</span>
                    )}
                    {p.completedByName && (
                      <span className="text-emerald-400">
                        ✓ verified by {p.completedByName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {canAdd && (
                <button
                  type="button"
                  onClick={() => handleDelete(p.id)}
                  className="text-slate-600 hover:text-rose-400 transition-colors p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {canAdd && (
        <form onSubmit={handleAdd} className="space-y-2 pt-2 border-t border-slate-800/60">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Issue directive or quality guidance..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              disabled={isSubmitting || !content.trim()}
              className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-semibold text-xs px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Directive
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-0"
            />
            Mandatory completion required for Done Gate
          </label>
        </form>
      )}
    </div>
  );
};
