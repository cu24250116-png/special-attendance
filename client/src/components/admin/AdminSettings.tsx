import React, { useEffect, useState } from 'react';
import { Settings, Server, Radio, Database, ShieldCheck, Key, RefreshCw, Lock, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { api } from '../../services/api';

interface AdminSettingsProps {
  currentUser?: any;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({ currentUser }) => {
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealthData(data);
    } catch (err) {
      console.error('Failed to load health status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setPassError('Please enter your current password.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setPassError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('New password and confirmation do not match.');
      return;
    }

    setPassLoading(true);
    setPassError(null);
    setPassSuccess(null);

    try {
      const res = await api.adminChangePassword({
        currentPassword,
        newPassword,
      });
      setPassSuccess(res.message || 'Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPassSuccess(null), 5000);
    } catch (err: any) {
      setPassError(err.message || 'Failed to update password. Verify your current password.');
    } finally {
      setPassLoading(false);
    }
  };

  const [customUrl, setCustomUrl] = useState(() => localStorage.getItem('custom_api_url') || '');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (customUrl.trim()) {
      localStorage.setItem('custom_api_url', customUrl.trim());
    } else {
      localStorage.removeItem('custom_api_url');
    }
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      window.location.reload();
    }, 1200);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            <Settings className="w-4 h-4" />
            <span>ERP Infrastructure Controls</span>
          </div>
          <h1 className="text-2xl font-bold text-white font-['Outfit']">System Settings &amp; Security</h1>
          <p className="text-xs text-slate-400 mt-1">
            Account security, password management, and database infrastructure.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchHealth}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition self-start sm:self-auto"
          title="Refresh server health"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Admin Password Change Card */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
        <div className="flex items-center space-x-2.5 text-indigo-400">
          <Key className="w-5 h-5" />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-white">
              Change Administrator Password
            </h3>
            <p className="text-xs text-slate-400">
              Update password for signed-in administrator ({currentUser?.username || currentUser?.email || 'Admin'}).
            </p>
          </div>
        </div>

        {passError && (
          <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-800/60 text-red-200 text-xs flex items-start space-x-2.5 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <span>{passError}</span>
          </div>
        )}

        {passSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-200 text-xs flex items-start space-x-2.5 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>{passSuccess}</span>
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-xl text-xs">
          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrentPass ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full px-3.5 py-2.5 pr-10 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPass(!showCurrentPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                tabIndex={-1}
              >
                {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                New Password (min 8 chars)
              </label>
              <div className="relative">
                <input
                  type={showNewPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full px-3.5 py-2.5 pr-10 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  tabIndex={-1}
                >
                  {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Confirm New Password
              </label>
              <input
                type={showNewPass ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={passLoading || !currentPassword || !newPassword}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-semibold shadow-md transition disabled:opacity-50 flex items-center space-x-2"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{passLoading ? 'Updating Password...' : 'Update Password'}</span>
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Realtime Streaming Health */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 font-mono flex items-center space-x-2">
            <Radio className="w-4 h-4" />
            <span>Realtime Server-Sent Events (SSE) Stream</span>
          </h3>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Stream Connection Endpoint</span>
              <span className="font-mono text-sky-400">/api/realtime/stream</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Server Health Status</span>
              <span className="text-emerald-400 font-semibold uppercase">
                {healthData?.status || 'Active'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Active Connected Clients</span>
              <span className="font-mono text-white font-bold">
                {healthData?.realtimeClients?.totalConnected || 1} Total Clients
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Heartbeat Interval</span>
              <span className="text-slate-300">Every 20 seconds</span>
            </div>
          </div>
        </div>

        {/* Database & Hosting Architecture */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-sky-400 font-mono flex items-center space-x-2">
            <Database className="w-4 h-4" />
            <span>Database Storage Engine</span>
          </h3>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Storage Driver</span>
              <span className="text-white font-semibold">
                PostgreSQL &amp; SQLite Dual Mode Engine
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Production Cloud Database</span>
              <span className="text-emerald-400 font-semibold">PostgreSQL (Connected via DATABASE_URL)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Local Database File</span>
              <span className="font-mono text-slate-300">server/data/college_attendance.sqlite</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Atomicity &amp; Idempotency</span>
              <span className="text-emerald-400 font-semibold">Strict CU_ID Unique Constraint</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
