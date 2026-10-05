import React, { useState, useEffect } from 'react';
import { RoleCode } from '@workdesk/shared';
import { Shield, Clock, CheckCircle2, UserPlus, Award } from 'lucide-react';

interface UserItem {
  id: string;
  email: string;
  fullName: string;
  employeeId?: string | null;
  approvalStatus: string;
  roleCode: RoleCode;
  roleName: string;
  isActive: boolean;
}

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UserItem[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  // Approval Modal
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [empIdInput, setEmpIdInput] = useState('');
  const [roleInput, setRoleInput] = useState<RoleCode>(RoleCode.ROLE_EMPLOYEE);
  const [approving, setApproving] = useState(false);

  // Pre-provision Modal
  const [isPreOpen, setIsPreOpen] = useState(false);
  const [preEmail, setPreEmail] = useState('');
  const [preName, setPreName] = useState('');
  const [preEmpId, setPreEmpId] = useState('');
  const [preRole, setPreRole] = useState<RoleCode>(RoleCode.ROLE_EMPLOYEE);

  const fetchUsers = async () => {
    try {
      const [resAll, resPending] = await Promise.all([
        fetch('/api/v1/users', { credentials: 'include' }),
        fetch('/api/v1/users/pending-approvals', { credentials: 'include' }),
      ]);
      if (resAll.ok) setUsers(await resAll.json());
      if (resPending.ok) setPendingUsers(await resPending.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleApprove = async () => {
    if (!selectedUser || !empIdInput.trim()) {
      alert('Employee ID is required');
      return;
    }

    try {
      setApproving(true);
      const res = await fetch(`/api/v1/users/${selectedUser.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          employeeId: empIdInput.trim(),
          roleCode: roleInput,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Approval failed');

      setSelectedUser(null);
      setEmpIdInput('');
      setMsg(`Account approved with Employee ID: ${empIdInput.trim()}`);
      fetchUsers();
      setTimeout(() => setMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Approval failed');
    } finally {
      setApproving(false);
    }
  };

  const handlePromoteLead = async (userId: string) => {
    try {
      const res = await fetch(`/api/v1/users/${userId}/promote-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setMsg('User promoted to Team Lead');
        fetchUsers();
        setTimeout(() => setMsg(null), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePreProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/users/pre-provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: preEmail.trim(),
          fullName: preName.trim(),
          employeeId: preEmpId.trim(),
          roleCode: preRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Pre-provision failed');

      setIsPreOpen(false);
      setPreEmail('');
      setPreName('');
      setPreEmpId('');
      setMsg(`Pre-approved Employee ID: ${preEmpId.trim()}`);
      fetchUsers();
      setTimeout(() => setMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Pre-provision failed');
    }
  };

  const handleToggleActive = async (userId: string) => {
    try {
      const res = await fetch(`/api/v1/users/${userId}/toggle-active`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (res.ok) fetchUsers();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-purple-400" />
            <span>Organization User Management & Employee IDs</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Assign Employee IDs, approve pending corporate Google logins, and appoint Team Leads.
          </p>
        </div>

        <button
          onClick={() => setIsPreOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Pre-Approve Employee</span>
        </button>
      </div>

      {msg && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs">
          {msg}
        </div>
      )}

      {/* Pending Approvals */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-bold text-white">Pending Employee Approvals ({pendingUsers.length})</h2>
        </div>

        {pendingUsers.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-950/40 border border-slate-800/80 text-center text-xs text-slate-400">
            No employees awaiting approval.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingUsers.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 flex items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-white">{p.fullName}</div>
                  <div className="text-xs text-slate-400 font-mono">{p.email}</div>
                  <div className="text-[11px] text-amber-400 font-medium">Pending Employee ID Assignment</div>
                </div>

                <button
                  onClick={() => {
                    setSelectedUser(p);
                    setEmpIdInput(`EMP-${Math.floor(1000 + Math.random() * 9000)}`);
                    setRoleInput(RoleCode.ROLE_EMPLOYEE);
                  }}
                  className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Assign ID & Approve</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Complete User Table */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <h2 className="text-base font-bold text-white">Organization Directory ({users.length})</h2>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Employee ID</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Approval</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Lead Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/30">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-white">{u.fullName}</div>
                    <div className="text-slate-500 font-mono text-[11px]">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {u.employeeId ? (
                      <span className="font-mono text-indigo-300 font-semibold">{u.employeeId}</span>
                    ) : (
                      <span className="text-slate-600 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                      {u.roleName || u.roleCode}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.approvalStatus === 'APPROVED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {u.approvalStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      {u.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {u.roleCode === RoleCode.ROLE_EMPLOYEE && u.approvalStatus === 'APPROVED' && (
                      <button
                        onClick={() => handlePromoteLead(u.id)}
                        className="px-2.5 py-1 rounded bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-700/50 text-[11px] font-semibold transition-all inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>Promote to Lead</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleActive(u.id)}
                      className={`px-2 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                        u.isActive
                          ? 'bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 border border-rose-800/40'
                          : 'bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-800/40'
                      }`}
                    >
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approval Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-indigo-400" />
              <span>Approve & Assign Employee ID</span>
            </h3>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
              <div className="font-semibold text-white">{selectedUser.fullName}</div>
              <div className="text-slate-400 font-mono">{selectedUser.email}</div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Assign Unique Employee ID *</label>
              <input
                type="text"
                value={empIdInput}
                onChange={(e) => setEmpIdInput(e.target.value)}
                placeholder="e.g. EMP-1042"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Role Designation</label>
              <select
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value as RoleCode)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value={RoleCode.ROLE_EMPLOYEE}>Employee (Developer / Contributor)</option>
                <option value={RoleCode.ROLE_LEAD}>Team Lead (Supervises Team)</option>
              </select>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setSelectedUser(null)}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                {approving ? 'Saving...' : 'Grant Dashboard Access'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Provision Modal */}
      {isPreOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handlePreProvision}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-400" />
              <span>Pre-Approve Corporate Account</span>
            </h3>
            <p className="text-xs text-slate-400">
              Pre-provisioning allows the employee to instantly access the dashboard upon their first Google sign-in.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Corporate Email *</label>
              <input
                type="email"
                required
                value={preEmail}
                onChange={(e) => setPreEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Full Name *</label>
              <input
                type="text"
                required
                value={preName}
                onChange={(e) => setPreName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Employee ID *</label>
              <input
                type="text"
                required
                value={preEmpId}
                onChange={(e) => setPreEmpId(e.target.value)}
                placeholder="e.g. EMP-2024-001"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Role Designation</label>
              <select
                value={preRole}
                onChange={(e) => setPreRole(e.target.value as RoleCode)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value={RoleCode.ROLE_EMPLOYEE}>Employee</option>
                <option value={RoleCode.ROLE_LEAD}>Team Lead</option>
              </select>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsPreOpen(false)}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                Save & Pre-Approve
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
