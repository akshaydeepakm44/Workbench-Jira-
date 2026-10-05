import React, { useState } from 'react';
import { TaskEvidenceDto, EvidenceType } from '@workdesk/shared';
import { FileText, GitPullRequest, MessageSquare, Terminal, Rocket, ExternalLink, Plus, Trash2 } from 'lucide-react';

interface Props {
  ticketId: string;
  evidence: TaskEvidenceDto[];
  onRefresh: () => void;
  canEdit: boolean;
}

export const WorkEvidenceList: React.FC<Props> = ({
  ticketId,
  evidence,
  onRefresh,
  canEdit,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<EvidenceType>(EvidenceType.PULL_REQUEST);
  const [title, setTitle] = useState('');
  const [uri, setUri] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getIcon = (t: EvidenceType) => {
    switch (t) {
      case EvidenceType.PULL_REQUEST:
        return <GitPullRequest className="w-4 h-4 text-purple-400" />;
      case EvidenceType.DOCUMENT:
        return <FileText className="w-4 h-4 text-blue-400" />;
      case EvidenceType.COMMUNICATION:
        return <MessageSquare className="w-4 h-4 text-emerald-400" />;
      case EvidenceType.TEST_RUN:
        return <Terminal className="w-4 h-4 text-amber-400" />;
      case EvidenceType.DEPLOYMENT:
        return <Rocket className="w-4 h-4 text-rose-400" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !uri.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/tasks/${ticketId}/evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type,
          title: title.trim(),
          uri: uri.trim(),
          notes: notes.trim() || undefined,
        }),
      });
      if (res.ok) {
        setTitle('');
        setUri('');
        setNotes('');
        setIsOpen(false);
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to attach evidence:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (evidenceId: string) => {
    try {
      const res = await fetch(`/api/v1/tasks/evidence/${evidenceId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to remove evidence:', err);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-400" />
          <h3 className="font-semibold text-white text-sm tracking-wide">Work Evidence & Proof</h3>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
            {evidence.length} attached
          </span>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Attach Evidence
          </button>
        )}
      </div>

      {isOpen && (
        <form onSubmit={handleAdd} className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Evidence Category</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as EvidenceType)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
              >
                <option value={EvidenceType.PULL_REQUEST}>Pull Request (PR)</option>
                <option value={EvidenceType.DOCUMENT}>Technical Document</option>
                <option value={EvidenceType.TEST_RUN}>Test Run / CI Results</option>
                <option value={EvidenceType.DEPLOYMENT}>Deployment Verification</option>
                <option value={EvidenceType.COMMUNICATION}>Client / Stakeholder Comms</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Title / Description</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. PR #42 Merged to main"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Resource URL (URI)</label>
            <input
              type="url"
              value={uri}
              onChange={(e) => setUri(e.target.value)}
              placeholder="https://github.com/... or https://docs.google.com/..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Optional Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Brief context or verification notes..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
            />
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
              className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors"
            >
              Save Evidence
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {evidence.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-2">No verification evidence attached. Required for completion.</p>
        ) : (
          evidence.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  {getIcon(e.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">{e.title}</span>
                    <a
                      href={e.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 text-xs flex items-center gap-0.5"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                    <span>Uploaded by {e.uploaderName || 'User'}</span>
                    {e.notes && <span>• {e.notes}</span>}
                  </div>
                </div>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleDelete(e.id)}
                  className="text-slate-600 hover:text-rose-400 transition-colors p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
