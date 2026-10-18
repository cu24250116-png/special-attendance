import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  Key,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Lock,
  Building,
  Mail,
  Copy,
  Check,
  Filter
} from 'lucide-react';
import { api } from '../../services/api';
import { AdminUser } from '../../types';

interface AdminUserManagementProps {
  currentUser: any;
}

export const AdminUserManagement: React.FC<AdminUserManagementProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'super_admin' | 'hod'>('all');

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDepartment, setNewDepartment] = useState('Computer Science');
  const [newRole, setNewRole] = useState<'hod' | 'super_admin'>('hod');
  const [newPassword, setNewPassword] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createModalError, setCreateModalError] = useState<string | null>(null);

  // Created Success Dialog (shows temporary password for copying)
  const [createdResult, setCreatedResult] = useState<{
    user: AdminUser;
    temporaryPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset Password Modal
  const [resetModalUser, setResetModalUser] = useState<AdminUser | null>(null);
  const [resetTempPassword, setResetTempPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccessNotice, setResetSuccessNotice] = useState<{
    user: AdminUser;
    tempPass: string;
  } | null>(null);

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#%!';
    let pass = 'HOD@';
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, deptsRes] = await Promise.all([
        api.getAdminUsers(),
        api.getAdminDepartments().catch(() => ({ departments: [] })),
      ]);
      setUsers(usersRes.users || []);
      const deptNames = (deptsRes.departments || []).map((d: any) => d.name).filter(Boolean);
      if (deptNames.length > 0) {
        setDepartments(deptNames);
        if (!deptNames.includes(newDepartment)) {
          setNewDepartment(deptNames[0]);
        }
      } else {
        setDepartments(['Computer Science', 'Electronics & Comm', 'Mechanical Engineering', 'Civil Engineering', 'AI & Data Science', 'Management']);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load administrator accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setNewUsername('');
    setNewEmail('');
    setNewRole('hod');
    setNewPassword(generateRandomPassword());
    setCreateModalError(null);
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newEmail.trim()) {
      setCreateModalError('Name and email are required.');
      return;
    }

    setCreateLoading(true);
    setCreateModalError(null);
    try {
      const res = await api.createAdminUser({
        username: newUsername.trim(),
        email: newEmail.trim().toLowerCase(),
        department: newRole === 'super_admin' ? 'ALL' : newDepartment,
        role: newRole,
        password: newPassword,
      });

      setShowCreateModal(false);
      setCreatedResult({
        user: res.user,
        temporaryPassword: res.temporaryPassword || newPassword,
      });
      loadData();
    } catch (err: any) {
      setCreateModalError(err.message || 'Failed to create administrator account.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleToggleStatus = async (user: AdminUser) => {
    const nextStatus = user.status === 'active' ? 'disabled' : 'active';
    try {
      await api.updateAdminUser(user.id, { status: nextStatus });
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u))
      );
      setSuccess(`Account status for ${user.username} changed to ${nextStatus}.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update account status.');
    }
  };

  const handleOpenResetModal = (user: AdminUser) => {
    setResetModalUser(user);
    setResetTempPassword(generateRandomPassword());
  };

  const handleConfirmResetPassword = async () => {
    if (!resetModalUser) return;
    setResetLoading(true);
    try {
      const res = await api.resetAdminPassword(resetModalUser.id, resetTempPassword);
      setResetSuccessNotice({
        user: resetModalUser,
        tempPass: res.temporaryPassword || resetTempPassword,
      });
      setResetModalUser(null);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleDeleteUser = async (user: AdminUser) => {
    if (String(user.id) === String(currentUser?.id) || user.email === currentUser?.email) {
      alert('You cannot delete your own active administrator account.');
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete admin account "${user.username}" (${user.email})?`)) {
      return;
    }

    try {
      await api.deleteAdminUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setSuccess(`Account for ${user.username} deleted.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete account.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole =
      roleFilter === 'all' ? true : u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const totalAdmins = users.length;
  const activeHods = users.filter((u) => u.role === 'hod' && u.status === 'active').length;
  const disabledCount = users.filter((u) => u.status === 'disabled').length;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-purple-400 mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Super Admin Console</span>
          </div>
          <h1 className="text-2xl font-bold text-white font-['Outfit']">Multi-Admin &amp; HOD Security</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage individual Head of Department (HOD) accounts, departmental scoping, and administrative credentials.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={loadData}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Refresh Account List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-purple-900/30 flex items-center space-x-2 transition transform active:scale-[0.98]"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create HOD / Admin</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-950/70 border border-purple-800/60 flex items-center justify-center text-purple-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase font-semibold text-slate-400">Total Administrators</p>
            <p className="text-xl font-bold text-white font-mono">{totalAdmins}</p>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-950/70 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase font-semibold text-slate-400">Active HOD Accounts</p>
            <p className="text-xl font-bold text-emerald-300 font-mono">{activeHods}</p>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-950/70 border border-amber-800/60 flex items-center justify-center text-amber-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase font-semibold text-slate-400">Disabled Accounts</p>
            <p className="text-xl font-bold text-amber-300 font-mono">{disabledCount}</p>
          </div>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-800/60 text-red-200 text-xs flex items-start space-x-2.5 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-200 text-xs flex items-start space-x-2.5 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email or department..."
            className="w-full pl-9 pr-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px] text-slate-400">Role:</span>
          {(['all', 'super_admin', 'hod'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                roleFilter === r
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {r === 'all' ? 'All Roles' : r === 'super_admin' ? 'Super Admin' : 'HOD'}
            </button>
          ))}
        </div>
      </div>

      {/* Accounts Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Administrator / HOD</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Authorized Department</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4">Security Flags</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-400" />
                    Loading administrator accounts...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No administrators found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = String(u.id) === String(currentUser?.id) || u.email === currentUser?.email;
                  return (
                    <tr key={u.id} className="hover:bg-slate-900/50 transition">
                      {/* Name & Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                            u.role === 'super_admin'
                              ? 'bg-purple-950/80 text-purple-300 border border-purple-800/60'
                              : 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/60'
                          }`}>
                            {u.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center space-x-1.5">
                              <span>{u.username}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 text-[9px] rounded bg-sky-950 text-sky-300 border border-sky-800/60">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        {u.role === 'super_admin' ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-950/80 text-purple-300 border border-purple-800/60">
                            <ShieldCheck className="w-3 h-3 text-purple-400" />
                            <span>Super Admin</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-800/60">
                            <Building className="w-3 h-3 text-indigo-400" />
                            <span>HOD</span>
                          </span>
                        )}
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800/80 text-slate-300 border border-slate-700/60">
                          {u.department || 'ALL'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          disabled={isCurrent}
                          onClick={() => handleToggleStatus(u)}
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition ${
                            u.status === 'active'
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 hover:bg-emerald-900/60'
                              : 'bg-red-950/80 text-red-300 border border-red-800/60 hover:bg-red-900/60'
                          } ${isCurrent ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                          title={isCurrent ? 'Cannot disable own account' : 'Click to toggle account status'}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          <span className="capitalize">{u.status}</span>
                        </button>
                      </td>

                      {/* Security Flags */}
                      <td className="py-3.5 px-4">
                        {u.must_change_password ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60 text-[10px] font-medium">
                            <Key className="w-3 h-3 text-amber-400" />
                            <span>First-Login Password Required</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono">Password Set</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenResetModal(u)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 transition"
                            title="Reset Password to Temporary Key"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            disabled={isCurrent}
                            onClick={() => handleDeleteUser(u)}
                            className={`p-1.5 rounded-lg transition ${
                              isCurrent
                                ? 'bg-slate-900 text-slate-600 cursor-not-allowed'
                                : 'bg-slate-800 hover:bg-rose-950/70 text-slate-400 hover:text-rose-400'
                            }`}
                            title={isCurrent ? 'Cannot delete own account' : 'Delete Account'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE ACCOUNT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="glass-panel max-w-md w-full rounded-2xl p-6 border border-slate-700 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-purple-950/80 border border-purple-800/60 text-purple-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Create Administrator / HOD</h3>
                  <p className="text-[10px] text-slate-400">Assign departmental scope and temporary password</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            {createModalError && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/60 text-red-200 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <span>{createModalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Full Name / Title
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. Dr. R. K. Sharma (HOD CSE)"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Official College Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="e.g. hod.cse@college.edu"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Role &amp; Privilege
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="hod">HOD (Departmental Scope)</option>
                    <option value="super_admin">Super Admin (All Departments)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Department
                  </label>
                  <select
                    disabled={newRole === 'super_admin'}
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                  >
                    {newRole === 'super_admin' ? (
                      <option value="ALL">ALL (College-wide)</option>
                    ) : (
                      departments.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-300">
                    Temporary Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewPassword(generateRandomPassword())}
                    className="text-[11px] text-purple-400 hover:text-purple-300"
                  >
                    Regenerate
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  The HOD will be required to change this password on their first login.
                </p>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-md transition disabled:opacity-50"
                >
                  {createLoading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACCOUNT CREATED CREDENTIAL DIALOG */}
      {createdResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="glass-panel max-w-md w-full rounded-2xl p-6 border border-emerald-600/60 shadow-2xl space-y-4">
            <div className="flex items-center space-x-2.5 text-emerald-400">
              <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-white">Administrator Account Created!</h3>
                <p className="text-[11px] text-slate-400">Please provide these initial credentials to the authorized HOD.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Email:</span>
                <span className="text-white font-bold">{createdResult.user.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Department:</span>
                <span className="text-sky-300">{createdResult.user.department}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Role:</span>
                <span className="text-purple-300">{createdResult.user.role}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-800">
                <span className="text-slate-400">Temp Password:</span>
                <span className="text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
                  {createdResult.temporaryPassword}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    `College Portal HOD Credentials:\nPortal: https://college-special-attendance.onrender.com\nEmail: ${createdResult.user.email}\nTemporary Password: ${createdResult.temporaryPassword}\nDepartment: ${createdResult.user.department}`
                  )
                }
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center justify-center space-x-1.5"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Credentials'}</span>
              </button>
              <button
                type="button"
                onClick={() => setCreatedResult(null)}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="glass-panel max-w-sm w-full rounded-2xl p-6 border border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Key className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold text-white">Reset Password</h3>
              </div>
              <button
                type="button"
                onClick={() => setResetModalUser(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Reset temporary password for <strong>{resetModalUser.username}</strong> ({resetModalUser.email}).
              They will be required to change it on their next login.
            </p>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Temporary Password</label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={resetTempPassword}
                  onChange={(e) => setResetTempPassword(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={() => setResetTempPassword(generateRandomPassword())}
                  className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-semibold border border-slate-700"
                  title="Generate new password"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setResetModalUser(null)}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resetLoading || !resetTempPassword.trim()}
                onClick={handleConfirmResetPassword}
                className="flex-1 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-50"
              >
                {resetLoading ? 'Resetting...' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET SUCCESS NOTICE */}
      {resetSuccessNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="glass-panel max-w-sm w-full rounded-2xl p-6 border border-emerald-600/60 shadow-2xl space-y-4">
            <div className="flex items-center space-x-2 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              <h3 className="text-sm font-bold text-white">Password Reset Successful</h3>
            </div>
            <p className="text-xs text-slate-300">
              Temporary password for <strong>{resetSuccessNotice.user.username}</strong>:
            </p>
            <div className="p-3 bg-slate-900 border border-slate-700 rounded-xl text-center font-mono font-bold text-emerald-400 text-sm">
              {resetSuccessNotice.tempPass}
            </div>
            <button
              type="button"
              onClick={() => {
                copyToClipboard(resetSuccessNotice.tempPass);
                setResetSuccessNotice(null);
              }}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
            >
              Copy Password &amp; Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
