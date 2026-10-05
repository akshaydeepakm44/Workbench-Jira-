import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { RoleCode } from '@workdesk/shared';
import {
  Calendar,
  CheckCircle,
  AlertTriangle,
  Plus,
  Clock,
  Users,
} from 'lucide-react';

export const StandupPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'my' | 'team'>('my');

  // My Stand-up state
  const [todayStandup, setTodayStandup] = useState<any>(null);
  const [yesterdayText, setYesterdayText] = useState('');
  const [todayText, setTodayText] = useState('');
  const [blockerInputs, setBlockerInputs] = useState<string[]>(['']);
  const [submitting, setSubmitting] = useState(false);

  // Team Stand-up state
  const [teamData, setTeamData] = useState<any[]>([]);

  const fetchMyToday = async () => {
    try {
      const res = await fetch('/api/v1/standups/my-today', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTodayStandup(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTeam = async () => {
    try {
      const res = await fetch('/api/v1/standups/team', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTeamData(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    Promise.all([fetchMyToday(), fetchTeam()]);
  }, []);

  const handleAddBlockerInput = () => {
    setBlockerInputs([...blockerInputs, '']);
  };

  const handleBlockerChange = (index: number, val: string) => {
    const updated = [...blockerInputs];
    updated[index] = val;
    setBlockerInputs(updated);
  };

  const handleSubmitStandup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yesterdayText.trim() || !todayText.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/standups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          yesterday: yesterdayText.trim(),
          today: todayText.trim(),
          blockers: blockerInputs.filter((b) => b.trim()),
        }),
      });

      if (res.ok) {
        await Promise.all([fetchMyToday(), fetchTeam()]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConvertBlocker = async (blockerId: string) => {
    try {
      const res = await fetch(`/api/v1/standups/blockers/${blockerId}/convert`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        await fetchTeam();
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
            <Calendar className="w-6 h-6 text-emerald-500" />
            <span>Daily Stand-up & Team Sync</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Yesterday's delivery, today's commitments, and active blockers with one-click ticket conversion.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('my')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'my'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            My Stand-up
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'team'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Team Overview</span>
          </button>
        </div>
      </div>

      {activeTab === 'my' ? (
        <div className="max-w-3xl space-y-6">
          {todayStandup ? (
            /* Already Submitted Card */
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-emerald-500/30 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                  <CheckCircle className="w-5 h-5" />
                  <span>Stand-up Submitted for Today ({todayStandup.standupDate})</span>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {new Date(todayStandup.submittedAt).toLocaleTimeString()}
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Yesterday's Accomplishments
                  </div>
                  <p className="text-sm text-slate-200 bg-slate-950 p-4 rounded-xl border border-slate-800">
                    {todayStandup.yesterday}
                  </p>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Today's Commitments
                  </div>
                  <p className="text-sm text-slate-200 bg-slate-950 p-4 rounded-xl border border-slate-800">
                    {todayStandup.today}
                  </p>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Blockers / Impediments
                  </div>
                  {todayStandup.blockers && todayStandup.blockers.length > 0 ? (
                    <div className="space-y-2">
                      {todayStandup.blockers.map((b: any) => (
                        <div
                          key={b.id}
                          className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center justify-between"
                        >
                          <span>{b.blockerText}</span>
                          {b.convertedTaskId && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300">
                              Converted to Ticket
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No blockers reported.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Submission Form */
            <form onSubmit={handleSubmitStandup} className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-base font-bold text-white">Today's Daily Stand-up</h3>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Cutoff at 11:00 AM</span>
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  1. What did you accomplish yesterday? *
                </label>
                <textarea
                  rows={3}
                  required
                  value={yesterdayText}
                  onChange={(e) => setYesterdayText(e.target.value)}
                  placeholder="Completed tasks, pull requests, key milestones..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  2. What are your key commitments for today? *
                </label>
                <textarea
                  rows={3}
                  required
                  value={todayText}
                  onChange={(e) => setTodayText(e.target.value)}
                  placeholder="Tasks to pick up, meetings, reviews..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  3. Any blockers or dependencies? (Optional)
                </label>
                {blockerInputs.map((val, idx) => (
                  <input
                    key={idx}
                    type="text"
                    value={val}
                    onChange={(e) => handleBlockerChange(idx, e.target.value)}
                    placeholder="Describe any impediment preventing progress..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-rose-500 focus:outline-none mb-1.5"
                  />
                ))}
                <button
                  type="button"
                  onClick={handleAddBlockerInput}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-medium mt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add another blocker</span>
                </button>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Daily Stand-up'}
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        /* Team Overview Tab */
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-300">
              Team Participation Today: {teamData.filter((t) => t.hasSubmitted).length} / {teamData.length} Submitted
            </div>
            <div className="text-xs font-mono font-bold text-emerald-400">
              {teamData.length > 0
                ? Math.round((teamData.filter((t) => t.hasSubmitted).length / teamData.length) * 100)
                : 0}
              %
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teamData.map((member) => (
              <div
                key={member.userId}
                className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4 shadow-sm"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <div className="font-semibold text-white text-sm">{member.userName}</div>
                    <div className="text-xs text-slate-400">{member.userEmail}</div>
                  </div>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                      member.hasSubmitted
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {member.hasSubmitted ? 'Submitted' : 'Pending'}
                  </span>
                </div>

                {member.hasSubmitted && member.standup ? (
                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="text-slate-400 font-semibold mb-0.5">Yesterday:</div>
                      <p className="text-slate-200 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                        {member.standup.yesterday}
                      </p>
                    </div>

                    <div>
                      <div className="text-slate-400 font-semibold mb-0.5">Today:</div>
                      <p className="text-slate-200 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                        {member.standup.today}
                      </p>
                    </div>

                    {member.standup.blockers && member.standup.blockers.length > 0 && (
                      <div>
                        <div className="text-rose-400 font-semibold mb-0.5 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Blockers:</span>
                        </div>
                        <div className="space-y-1.5">
                          {member.standup.blockers.map((b: any) => (
                            <div
                              key={b.id}
                              className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center justify-between gap-2"
                            >
                              <span className="truncate">{b.blockerText}</span>
                              {user?.roleCode !== RoleCode.ROLE_EMPLOYEE && !b.convertedTaskId ? (
                                <button
                                  onClick={() => handleConvertBlocker(b.id)}
                                  className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] shrink-0"
                                >
                                  Convert to Task &rarr;
                                </button>
                              ) : b.convertedTaskId ? (
                                <span className="text-[10px] text-emerald-400 font-semibold">
                                  Converted
                                </span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 py-4 text-center">
                    Awaiting today's update.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
