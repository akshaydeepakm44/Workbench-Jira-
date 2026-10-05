import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  RoleCode,
  UserWorkloadDto,
  TeamWorkloadDto,
  WorkloadStatus,
} from '@workdesk/shared';
import {
  Clock,
  Briefcase,
  CheckCircle,
  Activity,
  Edit2,
  Layers,
} from 'lucide-react';

export const WorkloadCapacityPage: React.FC = () => {
  const { user } = useAuth();
  const [teamWorkload, setTeamWorkload] = useState<TeamWorkloadDto | null>(null);
  const [myWorkload, setMyWorkload] = useState<UserWorkloadDto | null>(null);
  const [loading, setLoading] = useState(true);

  // Capacity edit modal state
  const [isEditingCapacity, setIsEditingCapacity] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [capacityInput, setCapacityInput] = useState<number>(40);
  const [savingCapacity, setSavingCapacity] = useState(false);

  const fetchWorkloadData = async () => {
    try {
      setLoading(true);
      // Fetch user's own workload and team info
      if (user?.id) {
        const myRes = await fetch(`/api/v1/workload/user/${user.id}`, { credentials: 'include' });
        if (myRes.ok) {
          setMyWorkload(await myRes.json());
        }

        const userDetailRes = await fetch(`/api/v1/users/${user.id}`, { credentials: 'include' });
        if (userDetailRes.ok) {
          const detail = await userDetailRes.json();
          if (detail.teamId) {
            const teamRes = await fetch(`/api/v1/workload/team/${detail.teamId}`, { credentials: 'include' });
            if (teamRes.ok) {
              setTeamWorkload(await teamRes.json());
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching workload data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkloadData();
  }, [user?.id]);

  const handleSaveCapacity = async () => {
    if (!selectedUserId || capacityInput <= 0) return;
    try {
      setSavingCapacity(true);
      const res = await fetch(`/api/v1/workload/user/${selectedUserId}/capacity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ weeklyCapacity: capacityInput }),
      });
      if (res.ok) {
        setIsEditingCapacity(false);
        fetchWorkloadData();
      }
    } catch (err) {
      console.error('Failed to save capacity:', err);
    } finally {
      setSavingCapacity(false);
    }
  };

  const getStatusBadge = (status: WorkloadStatus, ratio: number) => {
    switch (status) {
      case 'UNDER_ALLOCATED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            Under-allocated ({Math.round(ratio * 100)}%)
          </span>
        );
      case 'OPTIMAL':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Balanced ({Math.round(ratio * 100)}%)
          </span>
        );
      case 'OVER_ALLOCATED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Over-allocated ({Math.round(ratio * 100)}%)
          </span>
        );
      case 'CRITICAL':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            Capacity Critical ({Math.round(ratio * 100)}%)
          </span>
        );
    }
  };

  const getUtilizationBarColor = (ratio: number) => {
    if (ratio < 0.7) return 'bg-cyan-500';
    if (ratio <= 1.0) return 'bg-emerald-500';
    if (ratio <= 1.25) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-400" />
            <span>Workload & Capacity Management</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time effort allocation vs weekly capacity thresholds based on canonical task estimates.
          </p>
        </div>
        {loading && (
          <span className="text-xs text-amber-400 font-mono animate-pulse">Calculating workload...</span>
        )}
      </div>

      {/* Individual Workload Summary Card */}
      {myWorkload && (
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                My Operational Workstation
              </div>
              <h2 className="text-lg font-bold text-white mt-1">
                {myWorkload.userName} ({myWorkload.roleCode})
              </h2>
            </div>
            <div>{getStatusBadge(myWorkload.status, myWorkload.utilizationRatio)}</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Weekly Capacity Budget</span>
              </div>
              <div className="text-2xl font-bold text-white mt-2">
                {myWorkload.weeklyCapacityHours} <span className="text-xs font-normal text-slate-500">hrs/wk</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                <span>Planned Estimated Hours</span>
              </div>
              <div className="text-2xl font-bold text-white mt-2">
                {myWorkload.allocatedEstimatedHours} <span className="text-xs font-normal text-slate-500">hrs</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Actual Hours Expended</span>
              </div>
              <div className="text-2xl font-bold text-white mt-2">
                {myWorkload.allocatedActualHours} <span className="text-xs font-normal text-slate-500">hrs</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                <span>Active Work Items</span>
              </div>
              <div className="text-2xl font-bold text-white mt-2">
                {myWorkload.openTaskCount} <span className="text-xs font-normal text-slate-500">tasks</span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Workload Utilization</span>
              <span className="font-semibold text-white">
                {Math.round(myWorkload.utilizationRatio * 100)}% ({myWorkload.allocatedEstimatedHours} / {myWorkload.weeklyCapacityHours} hrs)
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getUtilizationBarColor(myWorkload.utilizationRatio)}`}
                style={{ width: `${Math.min(100, Math.round(myWorkload.utilizationRatio * 100))}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Team Capacity Distribution (Leads & Managers) */}
      {user?.roleCode !== RoleCode.ROLE_EMPLOYEE && teamWorkload && (
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">{teamWorkload.teamName} Workload Allocation</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Total Allocated: {teamWorkload.totalAllocatedHours} hrs | Total Capacity: {teamWorkload.totalCapacityHours} hrs
              </p>
            </div>
            {getStatusBadge(teamWorkload.status, teamWorkload.utilizationRatio)}
          </div>

          <div className="divide-y divide-slate-800 pt-2">
            {teamWorkload.members.map((member) => (
              <div key={member.userId} className="py-3 flex items-center justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm">{member.userName}</span>
                    <span className="text-xs text-slate-500">({member.roleCode})</span>
                    {getStatusBadge(member.status, member.utilizationRatio)}
                  </div>
                  <div className="w-full max-w-md bg-slate-800 h-2 rounded-full overflow-hidden mt-1.5">
                    <div
                      className={`h-full rounded-full ${getUtilizationBarColor(member.utilizationRatio)}`}
                      style={{ width: `${Math.min(100, Math.round(member.utilizationRatio * 100))}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-right">
                  <div>
                    <div className="font-bold text-white">{member.allocatedEstimatedHours} hrs</div>
                    <div className="text-slate-500">of {member.weeklyCapacityHours} hrs</div>
                  </div>

                  {(user?.roleCode === RoleCode.ROLE_MANAGER || user?.roleCode === RoleCode.ROLE_LEAD) && (
                    <button
                      onClick={() => {
                        setSelectedUserId(member.userId);
                        setCapacityInput(member.weeklyCapacityHours);
                        setIsEditingCapacity(true);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
                      title="Adjust Capacity"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Capacity Edit Modal */}
      {isEditingCapacity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-400" />
              <span>Configure Weekly Capacity</span>
            </h3>
            <p className="text-xs text-slate-400">
              Set the standard available hours per working week for this employee.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Weekly Hours Budget</label>
              <input
                type="number"
                min="1"
                max="80"
                value={capacityInput}
                onChange={(e) => setCapacityInput(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsEditingCapacity(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCapacity}
                disabled={savingCapacity || capacityInput <= 0}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50 transition-all"
              >
                {savingCapacity ? 'Saving...' : 'Save Capacity'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
