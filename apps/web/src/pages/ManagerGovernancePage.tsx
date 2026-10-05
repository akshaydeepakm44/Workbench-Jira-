import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RoleCode } from '@workdesk/shared';
import {
  Users,
  CheckCircle2,
  Clock,
  UserPlus,
  Shield,
  Search,
  Sparkles,
  Award,
  RefreshCw,
  Mail,
  Calendar,
  X,
  ExternalLink,
  Copy,
  Check,
  Send,
  Trash2,
  FolderPlus,
  AlertCircle,
} from 'lucide-react';

interface ProjectOption {
  id: string;
  name: string;
  key: string;
  status: string;
  lead?: { id: string; fullName: string; email: string } | null;
}

interface InvitationItem {
  id: string;
  email: string;
  fullName: string;
  employeeId: string;
  roleCode: RoleCode;
  roleName: string;
  invitationStatus: string;
  invitationSentAt: string | null;
  invitationExpiresAt: string | null;
  projects: Array<{
    id: string;
    name: string;
    key: string;
    roleInProject: string;
    isLead: boolean;
  }>;
}

export const ManagerGovernancePage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const approveUserId = searchParams.get('approveUser');

  const [users, setUsers] = useState<any[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Approval Modal State
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [empIdInput, setEmpIdInput] = useState('');
  const [roleInput, setRoleInput] = useState<RoleCode>(RoleCode.ROLE_EMPLOYEE);
  const [approving, setApproving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Onboard / Invite Modal
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
  const [onboardEmail, setOnboardEmail] = useState('');
  const [onboardName, setOnboardName] = useState('');
  const [onboardEmpId, setOnboardEmpId] = useState('');
  const [onboardProjectId, setOnboardProjectId] = useState('');
  const [onboardIsLead, setOnboardIsLead] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [onboardError, setOnboardError] = useState<string | null>(null);

  // Invitation Success Modal
  const [createdInviteLink, setCreatedInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Quick Project Modal
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectKey, setNewProjectKey] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, pendingRes, invitesRes, projectsRes] = await Promise.all([
        fetch('/api/v1/users', { credentials: 'include' }),
        fetch('/api/v1/users/pending-approvals', { credentials: 'include' }),
        fetch('/api/v1/users/invitations', { credentials: 'include' }),
        fetch('/api/v1/projects', { credentials: 'include' }),
      ]);

      if (usersRes.ok) {
        setUsers(await usersRes.json());
      }
      if (pendingRes.ok) {
        setPendingUsers(await pendingRes.json());
      }
      if (invitesRes.ok) {
        setInvitations(await invitesRes.json());
      }
      if (projectsRes.ok) {
        const projData = await projectsRes.json();
        setProjects(Array.isArray(projData) ? projData : projData.items || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openApprovalModal = (targetUser: any) => {
    setSelectedUser(targetUser);
    setActionError(null);
    if (targetUser.employeeId) {
      setEmpIdInput(targetUser.employeeId);
    } else {
      const prefix = targetUser.role?.code === RoleCode.ROLE_MANAGER ? 'MGR' : 'EMP';
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      setEmpIdInput(`${prefix}-${randomNum}`);
    }
    const currentRole = targetUser.role?.code || targetUser.roleCode;
    setRoleInput(currentRole || RoleCode.ROLE_EMPLOYEE);
  };

  const closeApprovalModal = () => {
    setSelectedUser(null);
    setEmpIdInput('');
    setActionError(null);
    if (searchParams.has('approveUser')) {
      searchParams.delete('approveUser');
      setSearchParams(searchParams);
    }
  };

  // Deep-link: automatically open details modal if ?approveUser=<id> is present
  useEffect(() => {
    if (!approveUserId) return;

    const existing = [...pendingUsers, ...users].find((u) => u.id === approveUserId);
    if (existing) {
      openApprovalModal(existing);
    } else {
      fetch(`/api/v1/users/${approveUserId}`, { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : null))
        .then((found) => {
          if (found) {
            openApprovalModal(found);
          }
        })
        .catch(console.error);
    }
  }, [approveUserId, pendingUsers.length, users.length]);

  const handleGenerateEmpId = (forRole?: RoleCode) => {
    const role = forRole || roleInput;
    const prefix = role === RoleCode.ROLE_MANAGER ? 'MGR' : role === RoleCode.ROLE_LEAD ? 'LEAD' : 'EMP';
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${randomNum}`;
  };

  const openOnboardModal = () => {
    setOnboardEmail('');
    setOnboardName('');
    setOnboardEmpId(handleGenerateEmpId(RoleCode.ROLE_EMPLOYEE));
    setOnboardProjectId(projects.length > 0 ? projects[0].id : '');
    setOnboardIsLead(false);
    setOnboardError(null);
    setIsOnboardModalOpen(true);
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardEmail.trim() || !onboardName.trim() || !onboardEmpId.trim()) {
      setOnboardError('Email, Full Name, and Employee ID are required');
      return;
    }

    try {
      setOnboarding(true);
      setOnboardError(null);
      const res = await fetch('/api/v1/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: onboardEmail.trim(),
          fullName: onboardName.trim(),
          employeeId: onboardEmpId.trim(),
          projectId: onboardProjectId || undefined,
          isLead: Boolean(onboardProjectId && onboardIsLead),
          isProjectLead: Boolean(onboardProjectId && onboardIsLead),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to onboard candidate');
      }

      setIsOnboardModalOpen(false);
      setCreatedInviteLink(`${window.location.origin}/accept-invitation?token=${data.token}`);
      fetchData();
    } catch (err: any) {
      setOnboardError(err.message || 'Onboarding failed');
    } finally {
      setOnboarding(false);
    }
  };

  const handleResendInvite = async (userId: string) => {
    try {
      const res = await fetch(`/api/v1/users/invitations/${userId}/resend`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Failed to resend invitation');
        return;
      }
      setCreatedInviteLink(`${window.location.origin}/accept-invitation?token=${data.token}`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to resend invitation');
    }
  };

  const handleRevokeInvite = async (userId: string) => {
    if (!window.confirm('Are you sure you want to revoke this invitation token? The link and OTP will be invalidated.')) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/users/invitations/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        fetchData();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to revoke invitation');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to revoke invitation');
    }
  };

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !newProjectKey.trim()) {
      setProjectError('Project name and key are required');
      return;
    }
    try {
      setCreatingProject(true);
      setProjectError(null);
      const res = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newProjectName.trim(),
          key: newProjectKey.toUpperCase().trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create project');
      }

      setIsNewProjectOpen(false);
      setNewProjectName('');
      setNewProjectKey('');
      await fetchData();
      setOnboardProjectId(data.id);
    } catch (err: any) {
      setProjectError(err.message || 'Failed to create project');
    } finally {
      setCreatingProject(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedUser || !empIdInput.trim()) {
      setActionError('Employee ID is required');
      return;
    }

    try {
      setApproving(true);
      setActionError(null);
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
      if (!res.ok) {
        throw new Error(data.message || 'Approval failed');
      }

      closeApprovalModal();
      fetchData();
    } catch (err: any) {
      setActionError(err.message || 'Approval failed');
    } finally {
      setApproving(false);
    }
  };

  const handleRoleChange = async (userId: string, newRoleCode: RoleCode) => {
    try {
      const res = await fetch(`/api/v1/users/${userId}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ roleCode: newRoleCode }),
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleActive = async (userId: string) => {
    try {
      const res = await fetch(`/api/v1/users/${userId}/toggle-active`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyLink = () => {
    if (!createdInviteLink) return;
    navigator.clipboard.writeText(createdInviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.employeeId && u.employeeId.toLowerCase().includes(q))
    );
  });

  const pendingInvites = invitations.filter(
    (i) => i.invitationStatus === 'INVITED' || i.invitationStatus === 'PENDING_VERIFY'
  );

  return (
    <div className="space-y-6">
      {/* Super Admin Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950/80 via-purple-950/40 to-slate-900 border border-indigo-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Super Administrator Control Tower
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Supreme Governance & Organization Authority</span>
          </h1>
          <p className="text-xs text-slate-300">
            Authenticated as <strong className="text-white font-mono">{user?.email}</strong>. You possess absolute authority over organization onboarding, employee IDs, and product leads.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setIsNewProjectOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow"
          >
            <FolderPlus className="w-4 h-4 text-indigo-400" />
            <span>New Product</span>
          </button>
          <button
            onClick={openOnboardModal}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Onboard & Invite Employee</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <Users className="w-4 h-4 text-indigo-400" />
            <span>Total Accounts</span>
          </div>
          <div className="text-2xl font-bold text-white">{users.length}</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-blue-500/30 space-y-1">
          <div className="text-xs text-blue-400 font-medium flex items-center gap-1.5">
            <Mail className="w-4 h-4 text-blue-400" />
            <span>Pending Invitations</span>
          </div>
          <div className="text-2xl font-bold text-blue-300">{pendingInvites.length}</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-amber-500/30 space-y-1">
          <div className="text-xs text-amber-400 font-medium flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Pending Approvals</span>
          </div>
          <div className="text-2xl font-bold text-amber-300">{pendingUsers.length}</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-emerald-500/30 space-y-1">
          <div className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
            <Award className="w-4 h-4 text-emerald-400" />
            <span>Product Leads</span>
          </div>
          <div className="text-2xl font-bold text-emerald-300">
            {users.filter((u) => u.roleCode === RoleCode.ROLE_LEAD).length}
          </div>
        </div>
      </div>

      {/* Onboarded & Pending Invitations Section */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">
              Onboarded & Pending Invitations ({invitations.length})
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            Manager-governed candidate invitations with 6-digit OTP identity verification
          </span>
        </div>

        {invitations.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-950/40 border border-slate-800/80 text-center space-y-2">
            <UserPlus className="w-8 h-8 text-indigo-400 mx-auto" />
            <div className="text-sm font-semibold text-white">No Invitations Sent</div>
            <div className="text-xs text-slate-400">
              Click &quot;Onboard & Invite Employee&quot; above to issue candidate credentials and invite links.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Candidate</th>
                  <th className="px-4 py-3">Employee ID</th>
                  <th className="px-4 py-3">Product / Scope</th>
                  <th className="px-4 py-3">Project Role</th>
                  <th className="px-4 py-3">Invitation Status</th>
                  <th className="px-4 py-3">Sent / Expires</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/30">
                {invitations.map((inv) => {
                  const assignedProj = inv.projects?.[0];
                  return (
                    <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold text-xs">
                            {inv.fullName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-white">{inv.fullName}</div>
                            <div className="text-slate-500 font-mono text-[11px]">{inv.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-indigo-300 font-semibold">{inv.employeeId}</span>
                      </td>
                      <td className="px-4 py-3">
                        {assignedProj ? (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200 font-mono text-[11px]">
                              {assignedProj.key}
                            </span>
                            <span className="text-slate-300 font-medium">{assignedProj.name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">No project assigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {assignedProj?.isLead || inv.roleCode === RoleCode.ROLE_LEAD ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 w-max">
                            <Award className="w-3 h-3 text-amber-400" />
                            <span>Product Lead</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700 w-max">
                            Contributor
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.invitationStatus === 'ACCEPTED'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : inv.invitationStatus === 'PENDING_VERIFY'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : inv.invitationStatus === 'REVOKED'
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {inv.invitationStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-[11px]">
                        <div>Sent: {inv.invitationSentAt ? new Date(inv.invitationSentAt).toLocaleDateString() : 'N/A'}</div>
                        {inv.invitationExpiresAt && (
                          <div className="text-[10px] text-slate-500">
                            Exp: {new Date(inv.invitationExpiresAt).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {inv.invitationStatus !== 'ACCEPTED' && inv.invitationStatus !== 'REVOKED' && (
                            <>
                              <button
                                onClick={() => handleResendInvite(inv.id)}
                                title="Rotate invitation token and resend email"
                                className="px-2.5 py-1 rounded text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer flex items-center gap-1"
                              >
                                <RefreshCw className="w-3 h-3 text-indigo-400" />
                                <span>Resend</span>
                              </button>
                              <button
                                onClick={() => handleRevokeInvite(inv.id)}
                                title="Revoke and invalidate invitation"
                                className="px-2 py-1 rounded text-[11px] font-semibold bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 transition-all cursor-pointer flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3 text-rose-400" />
                                <span>Revoke</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Approvals Section (Google SSO) */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">Pending Approval Queue ({pendingUsers.length})</h2>
          </div>
          <span className="text-xs text-slate-400">Directly registered accounts awaiting Manager employee ID review</span>
        </div>

        {pendingUsers.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-950/40 border border-slate-800/80 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <div className="text-sm font-semibold text-white">Queue Clear</div>
            <div className="text-xs text-slate-400">All registered corporate accounts have been provisioned and approved.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingUsers.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 flex items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{p.fullName}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold">
                      Awaiting Employee ID
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">{p.email}</div>
                  <div className="text-[11px] text-slate-500">
                    Registered: {new Date(p.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <button
                  onClick={() => openApprovalModal(p)}
                  className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer whitespace-nowrap"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Review & Accept</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Complete User Roster */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">All Platform Accounts ({filteredUsers.length})</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchData()}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by name, email, EMP ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Employee ID</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Approval</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Super Admin Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/30">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt={u.fullName} className="w-7 h-7 rounded-full object-cover border border-slate-700" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold text-xs">
                          {u.fullName.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-white">{u.fullName}</div>
                        <div className="text-slate-500 font-mono text-[11px]">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.employeeId ? (
                      <span className="font-mono text-indigo-300 font-semibold">{u.employeeId}</span>
                    ) : (
                      <span className="text-slate-600 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.roleCode}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as RoleCode)}
                      className="px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white font-medium focus:outline-none focus:border-indigo-500"
                    >
                      <option value={RoleCode.ROLE_MANAGER}>Manager</option>
                      <option value={RoleCode.ROLE_LEAD}>Team Lead</option>
                      <option value={RoleCode.ROLE_EMPLOYEE}>Employee</option>
                    </select>
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
                        u.isActive
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      {u.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openApprovalModal(u)}
                        className="px-2.5 py-1 rounded text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
                      >
                        Inspect / Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(u.id)}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                          u.isActive
                            ? 'bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 border border-rose-800/40'
                            : 'bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-800/40'
                        }`}
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Onboard & Invite Employee Modal */}
      {isOnboardModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={handleOnboardSubmit}
            className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Onboard & Invite Employee</h3>
                  <p className="text-[11px] text-slate-400">Issue candidate access, assign product scope, and dispatch invitation</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOnboardModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {onboardError && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{onboardError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={onboardName}
                    onChange={(e) => setOnboardName(e.target.value)}
                    placeholder="e.g. Sarah Chen"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Corporate Email *</label>
                  <input
                    type="email"
                    required
                    value={onboardEmail}
                    onChange={(e) => setOnboardEmail(e.target.value)}
                    placeholder="sarah.chen@datai2i.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">Unique Employee ID *</label>
                  <button
                    type="button"
                    onClick={() => setOnboardEmpId(handleGenerateEmpId(RoleCode.ROLE_EMPLOYEE))}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Auto-Generate</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={onboardEmpId}
                  onChange={(e) => setOnboardEmpId(e.target.value)}
                  placeholder="e.g. EMP-2041"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">Assigned Product / Project</label>
                  <button
                    type="button"
                    onClick={() => setIsNewProjectOpen(true)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
                  >
                    <FolderPlus className="w-3 h-3" />
                    <span>+ New Product</span>
                  </button>
                </div>
                <select
                  value={onboardProjectId}
                  onChange={(e) => setOnboardProjectId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">(No product assignment / Unscoped Employee)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.key}] {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {onboardProjectId && (
                <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-800/60 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={onboardIsLead}
                      onChange={(e) => setOnboardIsLead(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      Designate as Lead for this Product
                    </span>
                  </label>
                  <p className="text-[11px] text-indigo-200/80 leading-relaxed pl-6">
                    {onboardIsLead ? (
                      <>
                        <strong className="text-amber-300 font-semibold">ROLE_LEAD Synchronization Activated:</strong>{' '}
                        The candidate will automatically receive the Lead Dashboard, sprint planning, and backlog authority strictly scoped to this product.
                      </>
                    ) : (
                      <>
                        Standard employee onboarding. The user will be assigned as a product contributor with access to tasks and daily standups.
                      </>
                    )}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsOnboardModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={onboarding}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                {onboarding ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Dispatching Invitation...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Invitation & Generate Link</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Invitation Success Modal */}
      {createdInviteLink && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Employee Invitation Ready</h3>
                  <p className="text-[11px] text-slate-400">Secure link generated with corporate OTP identity verification</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreatedInviteLink(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="text-xs text-slate-300 font-medium">Candidate Invitation Link:</div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={createdInviteLink}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-emerald-300 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                An invitation email was dispatched to the employee. They will visit this link and enter a 6-digit OTP code sent to their corporate inbox to verify identity and activate their workspace session.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setCreatedInviteLink(null)}
                className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Product / Project Modal */}
      {isNewProjectOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateProjectSubmit}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Create New Product / Project</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewProjectOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {projectError && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs">
                {projectError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Product / Project Name *</label>
              <input
                type="text"
                required
                value={newProjectName}
                onChange={(e) => {
                  setNewProjectName(e.target.value);
                  if (!newProjectKey) {
                    const words = e.target.value.split(/\s+/).filter(Boolean);
                    if (words.length >= 2) {
                      setNewProjectKey(words.map((w) => w[0]).join('').toUpperCase().slice(0, 4));
                    } else if (words.length === 1 && words[0].length >= 3) {
                      setNewProjectKey(words[0].slice(0, 3).toUpperCase());
                    }
                  }
                }}
                placeholder="e.g. Core Enterprise System"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Product Key (Uppercase) *</label>
              <input
                type="text"
                required
                maxLength={6}
                value={newProjectKey}
                onChange={(e) => setNewProjectKey(e.target.value.toUpperCase())}
                placeholder="e.g. CES"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono uppercase focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-500">2-6 letters used as task key prefix (e.g. CES-1001)</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsNewProjectOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingProject}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5"
              >
                {creatingProject ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Create Product</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* User Details & Approval Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Identity Verification & Access Approval</h3>
                  <p className="text-[11px] text-slate-400">Review user credentials and authorize platform entrance</p>
                </div>
              </div>
              <button
                onClick={closeApprovalModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Overview Card */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center gap-3.5">
                {selectedUser.avatarUrl ? (
                  <img
                    src={selectedUser.avatarUrl}
                    alt={selectedUser.fullName}
                    className="w-12 h-12 rounded-full object-cover border-2 border-indigo-500/40 shadow"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold text-lg flex items-center justify-center shadow">
                    {selectedUser.fullName?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="space-y-0.5">
                  <div className="font-bold text-white text-sm flex items-center gap-2">
                    <span>{selectedUser.fullName}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedUser.approvalStatus === 'APPROVED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                      }`}
                    >
                      {selectedUser.approvalStatus || 'PENDING'}
                    </span>
                  </div>
                  <div className="text-xs text-indigo-300 font-mono flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedUser.email}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Joined: {new Date(selectedUser.createdAt || Date.now()).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                  <span>Auth: Google Workspace SSO</span>
                </div>
              </div>
            </div>

            {/* Error Banner */}
            {actionError && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs">
                {actionError}
              </div>
            )}

            {/* Assignment Form */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">Assign Unique Employee ID *</label>
                  <button
                    type="button"
                    onClick={() => setEmpIdInput(handleGenerateEmpId(roleInput))}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Auto-Generate</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={empIdInput}
                  onChange={(e) => setEmpIdInput(e.target.value)}
                  placeholder="e.g. EMP-1042, MGR-002, or HR-001"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Designated Role *</label>
                <select
                  value={roleInput}
                  onChange={(e) => setRoleInput(e.target.value as RoleCode)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value={RoleCode.ROLE_EMPLOYEE}>Employee (Daily Standup & Task Execution)</option>
                  <option value={RoleCode.ROLE_LEAD}>Team Lead (Sprint Supervision & Delegation)</option>
                  <option value={RoleCode.ROLE_MANAGER}>Manager (Department Governance & Capability Administration)</option>
                </select>
                <p className="text-[11px] text-slate-500">
                  {roleInput === RoleCode.ROLE_EMPLOYEE && 'Grants hyper-personalized employee workspace, 2-phase standup, and task creation.'}
                  {roleInput === RoleCode.ROLE_LEAD && 'Grants team supervision, review queue access, and project guidance.'}
                  {roleInput === RoleCode.ROLE_MANAGER && 'Grants team management, project lead appointments, user approvals, and organization governance.'}
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={closeApprovalModal}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                {approving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Activating Access...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Authorize & Accept Access</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
