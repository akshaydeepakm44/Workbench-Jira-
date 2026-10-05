import React, { useEffect, useState } from 'react';
import { Video, Plus, Clock, ExternalLink, X } from 'lucide-react';
import { Link } from 'react-router-dom';

export const MeetingsPage: React.FC = () => {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);

  // Schedule Modal
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [creatingInstant, setCreatingInstant] = useState(false);

  const fetchMeetings = async () => {
    try {
      const res = await fetch('/api/v1/meetings', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMeetings(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMeetings();
    fetch('/api/v1/users', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then(setUsersList)
      .catch(console.error);
  }, []);

  const handleInstantMeeting = async () => {
    setCreatingInstant(true);
    try {
      const res = await fetch('/api/v1/meetings/instant', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const meeting = await res.json();
        await fetchMeetings();
        if (meeting.googleMeetUrl) {
          window.open(meeting.googleMeetUrl, '_blank');
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingInstant(false);
    }
  };

  const handleScheduleMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startTime || !endTime) return;

    try {
      const res = await fetch('/api/v1/meetings/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          startTime,
          endTime,
          participantUserIds: selectedParticipants,
        }),
      });

      if (res.ok) {
        setIsScheduleOpen(false);
        setTitle('');
        setDescription('');
        setStartTime('');
        setEndTime('');
        setSelectedParticipants([]);
        await fetchMeetings();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Video className="w-6 h-6 text-emerald-400" />
            <span>Meetings & Google Meet</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Genuine Google Meet rooms, collaborative agendas, live notes, and action items converted to tickets.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleInstantMeeting}
            disabled={creatingInstant}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            <Video className="w-4 h-4" />
            <span>{creatingInstant ? 'Provisioning...' : 'Instant Meet'}</span>
          </button>

          <button
            onClick={() => setIsScheduleOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Meeting</span>
          </button>
        </div>
      </div>

      {/* Meetings List */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <span>Scheduled & Active Rooms</span>
          <span>{meetings.length} Total</span>
        </div>

        {meetings.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No meetings scheduled yet. Click <strong>Instant Meet</strong> to create a room.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {meetings.map((m) => (
              <div key={m.id} className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-slate-800/30 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-base">{m.title}</span>
                    {m.isInstant && (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                        Instant
                      </span>
                    )}
                  </div>
                  {m.description && <p className="text-xs text-slate-400 line-clamp-1">{m.description}</p>}
                  <div className="text-xs text-slate-400 flex items-center gap-4 pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(m.startTime).toLocaleString()}</span>
                    </span>
                    <span>Organizer: {m.organizerName}</span>
                    <span>Participants: {m.participants?.length || 1}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  {m.googleMeetUrl && (
                    <a
                      href={m.googleMeetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <span>Join Meet</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <Link
                    to={`/meetings/${m.id}/workspace`}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
                  >
                    Open Workspace &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schedule Meeting Modal */}
      {isScheduleOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">Schedule Meeting & Google Meet</h3>
              <button onClick={() => setIsScheduleOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleMeeting} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Weekly Team Stand-up & Sprint Planning"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Meeting agenda notes..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Start Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">End Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Invite Team Members</label>
                <select
                  multiple
                  value={selectedParticipants}
                  onChange={(e) =>
                    setSelectedParticipants(Array.from(e.target.selectedOptions, (option) => option.value))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:border-indigo-500 focus:outline-none h-24"
                >
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.email})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500">Hold Ctrl / Cmd to select multiple.</span>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsScheduleOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20"
                >
                  Create & Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
