import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RoleCode } from '@workdesk/shared';
import {
  Video,
  ExternalLink,
  Clock,
  ArrowLeft,
  ListOrdered,
  FileCheck,
  CheckSquare,
} from 'lucide-react';

export const MeetingWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [meeting, setMeeting] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Inputs
  const [agendaTopic, setAgendaTopic] = useState('');
  const [decisionText, setDecisionText] = useState('');
  const [actionDesc, setActionDesc] = useState('');
  const [actionAssignee, setActionAssignee] = useState('');
  const [actionDueDate, setActionDueDate] = useState('');

  const fetchWorkspace = async () => {
    try {
      const res = await fetch(`/api/v1/meetings/${id}/workspace`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMeeting(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspace();
    fetch('/api/v1/users', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then(setUsersList)
      .catch(console.error);
  }, [id]);

  const handleAddAgenda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agendaTopic.trim()) return;

    try {
      const res = await fetch(`/api/v1/meetings/${id}/agenda`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ topic: agendaTopic.trim() }),
      });
      if (res.ok) {
        setAgendaTopic('');
        await fetchWorkspace();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionText.trim()) return;

    try {
      const res = await fetch(`/api/v1/meetings/${id}/decisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ description: decisionText.trim() }),
      });
      if (res.ok) {
        setDecisionText('');
        await fetchWorkspace();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddActionItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionDesc.trim()) return;

    try {
      const res = await fetch(`/api/v1/meetings/${id}/action-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          description: actionDesc.trim(),
          assigneeId: actionAssignee || undefined,
          dueDate: actionDueDate || undefined,
        }),
      });
      if (res.ok) {
        setActionDesc('');
        setActionAssignee('');
        setActionDueDate('');
        await fetchWorkspace();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleConvertActionItem = async (actionId: string) => {
    try {
      const res = await fetch(`/api/v1/meetings/${id}/action-items/${actionId}/convert`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        await fetchWorkspace();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="text-slate-400 py-12 text-center text-sm">Loading Meeting Workspace...</div>;
  }

  if (!meeting) {
    return <div className="text-rose-400 py-12 text-center text-sm">Meeting not found or access denied.</div>;
  }

  return (
    <div className="space-y-6">
      <Link to="/meetings" className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 font-medium">
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Meetings</span>
      </Link>

      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">{meeting.title}</h1>
            {meeting.isInstant && (
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                Instant Room
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{new Date(meeting.startTime).toLocaleString()}</span>
            </span>
            <span>Organizer: {meeting.organizerName}</span>
            <span>{meeting.participants?.length || 1} Participants</span>
          </div>
        </div>

        {meeting.googleMeetUrl && (
          <a
            href={meeting.googleMeetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
          >
            <Video className="w-4 h-4" />
            <span>Join Google Meet</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agenda Items Column */}
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <ListOrdered className="w-4 h-4 text-indigo-400" />
              <span>Agenda Items</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">{meeting.agendaItems?.length || 0}</span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {meeting.agendaItems && meeting.agendaItems.length > 0 ? (
              meeting.agendaItems.map((ag: any, index: number) => (
                <div key={ag.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 flex items-start gap-2.5">
                  <span className="text-slate-500 font-mono font-bold">{index + 1}.</span>
                  <span>{ag.topic}</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500 italic p-2">No agenda items added yet.</div>
            )}
          </div>

          <form onSubmit={handleAddAgenda} className="flex gap-2 pt-2">
            <input
              type="text"
              value={agendaTopic}
              onChange={(e) => setAgendaTopic(e.target.value)}
              placeholder="Add agenda topic..."
              className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            >
              Add
            </button>
          </form>
        </div>

        {/* Decisions Recorded Column */}
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <span>Decisions Recorded</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">{meeting.decisions?.length || 0}</span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {meeting.decisions && meeting.decisions.length > 0 ? (
              meeting.decisions.map((d: any) => (
                <div key={d.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 space-y-1">
                  <div>{d.description}</div>
                  <div className="text-[10px] text-slate-500">{new Date(d.recordedAt).toLocaleTimeString()}</div>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500 italic p-2">No decisions recorded yet.</div>
            )}
          </div>

          <form onSubmit={handleAddDecision} className="flex gap-2 pt-2">
            <input
              type="text"
              value={decisionText}
              onChange={(e) => setDecisionText(e.target.value)}
              placeholder="Record key meeting decision..."
              className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
            >
              Record
            </button>
          </form>
        </div>

        {/* Action Items Column with Convert to Task */}
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4 text-cyan-400" />
              <span>Action Items &rarr; Tasks</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">{meeting.actionItems?.length || 0}</span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {meeting.actionItems && meeting.actionItems.length > 0 ? (
              meeting.actionItems.map((act: any) => (
                <div
                  key={act.id}
                  className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-2"
                >
                  <div className="text-slate-200 font-medium">{act.description}</div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Assignee: {act.assigneeName || 'Unassigned'}</span>
                    <span>{act.dueDate ? new Date(act.dueDate).toLocaleDateString() : 'No Due Date'}</span>
                  </div>

                  {user?.roleCode !== RoleCode.ROLE_EMPLOYEE && (
                    <div className="pt-1 flex justify-end">
                      {act.convertedTaskId ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                          Converted to Ticket
                        </span>
                      ) : (
                        <button
                          onClick={() => handleConvertActionItem(act.id)}
                          className="px-2 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[10px]"
                        >
                          Convert to Task &rarr;
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500 italic p-2">No action items created yet.</div>
            )}
          </div>

          <form onSubmit={handleAddActionItem} className="space-y-2 pt-2">
            <input
              type="text"
              required
              value={actionDesc}
              onChange={(e) => setActionDesc(e.target.value)}
              placeholder="Action item description..."
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={actionAssignee}
                onChange={(e) => setActionAssignee(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">Assignee (Optional)</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={actionDueDate}
                onChange={(e) => setActionDueDate(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <button
              type="submit"
              className="w-full py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
            >
              Add Action Item
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
