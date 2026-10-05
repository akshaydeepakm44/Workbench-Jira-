import React, { useState } from 'react';
import { TaskDependencyDto, DependencyType } from '@workdesk/shared';
import { GitCommit, Plus, Trash2, ShieldAlert, ArrowRight, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  ticketId: string;
  dependencies: TaskDependencyDto[];
  inverseDependencies: TaskDependencyDto[];
  onRefresh: () => void;
  canEdit: boolean;
}

export const DependencyWidget: React.FC<Props> = ({
  ticketId,
  dependencies,
  inverseDependencies,
  onRefresh,
  canEdit,
}) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [targetTicketId, setTargetTicketId] = useState('');
  const [type, setType] = useState<DependencyType>(DependencyType.BLOCKS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTicketId.trim()) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/tasks/${ticketId}/dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetTicketId: targetTicketId.trim().toUpperCase(), type }),
      });
      if (res.ok) {
        setTargetTicketId('');
        setIsOpen(false);
        onRefresh();
      } else {
        const err = await res.json();
        setErrorMsg(err.message || 'Failed to add dependency');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (depId: string) => {
    try {
      const res = await fetch(`/api/v1/tasks/dependencies/${depId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to remove dependency:', err);
    }
  };

  const blockingCount = inverseDependencies.filter(
    (d) => d.type === DependencyType.BLOCKS && d.taskStatus !== 'DONE' as any,
  ).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitCommit className="w-5 h-5 text-cyan-400" />
          <h3 className="font-semibold text-white text-sm tracking-wide">Work Item Dependencies</h3>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Link Issue
          </button>
        )}
      </div>

      {blockingCount > 0 && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/40 text-xs text-rose-300">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>Cannot transition to DONE: Blocked by {blockingCount} active incomplete dependency.</span>
        </div>
      )}

      {isOpen && (
        <form onSubmit={handleAdd} className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
          {errorMsg && (
            <div className="p-2 rounded bg-rose-950/50 border border-rose-800/50 text-xs text-rose-300">
              {errorMsg}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Relationship</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as DependencyType)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
              >
                <option value={DependencyType.BLOCKS}>Blocks (This ticket blocks target)</option>
                <option value={DependencyType.RELATES_TO}>Relates to</option>
                <option value={DependencyType.DUPLICATES}>Duplicates</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Target Ticket Key</label>
              <input
                type="text"
                value={targetTicketId}
                onChange={(e) => setTargetTicketId(e.target.value)}
                placeholder="e.g. DESK-1002"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white uppercase"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors"
            >
              Link Dependency
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {dependencies.length === 0 && inverseDependencies.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-2">No dependencies linked.</p>
        ) : (
          <>
            {/* Outgoing Dependencies */}
            {dependencies.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs hover:border-slate-700 transition-all"
              >
                <div className="flex items-center gap-2 flex-1">
                  <span className="font-semibold text-cyan-400 uppercase tracking-wide px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40 text-[10px]">
                    {d.type === DependencyType.BLOCKS ? 'Blocks' : d.type}
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-500" />
                  <button
                    type="button"
                    onClick={() => navigate(`/tasks/${d.targetTicketId}`)}
                    className="font-mono text-indigo-400 hover:underline font-semibold"
                  >
                    {d.targetTicketId}
                  </button>
                  <span className="text-slate-300 truncate">{d.targetTitle}</span>
                  <span className="text-slate-500 ml-auto font-mono text-[10px]">{d.targetStatus}</span>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleRemove(d.id)}
                    className="text-slate-600 hover:text-rose-400 ml-2 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}

            {/* Incoming Inverse Dependencies */}
            {inverseDependencies.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs hover:border-slate-700 transition-all"
              >
                <div className="flex items-center gap-2 flex-1">
                  <span className="font-semibold text-rose-400 uppercase tracking-wide px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800/40 text-[10px]">
                    {d.type === DependencyType.BLOCKS ? 'Blocked by' : `Inversely ${d.type}`}
                  </span>
                  <ArrowLeft className="w-3 h-3 text-slate-500" />
                  <button
                    type="button"
                    onClick={() => navigate(`/tasks/${d.taskTicketId}`)}
                    className="font-mono text-indigo-400 hover:underline font-semibold"
                  >
                    {d.taskTicketId}
                  </button>
                  <span className="text-slate-300 truncate">{d.taskTitle}</span>
                  <span className="text-slate-500 ml-auto font-mono text-[10px]">{d.taskStatus}</span>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleRemove(d.id)}
                    className="text-slate-600 hover:text-rose-400 ml-2 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};
