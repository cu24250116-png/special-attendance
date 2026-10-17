import React, { useEffect, useState } from 'react';
import { CloudSyncConfig } from '../../types';
import { api } from '../../services/api';
import { Cloud, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck, Folder, FileSpreadsheet, Clock } from 'lucide-react';

export const AdminCloudSync: React.FC = () => {
  const [config, setConfig] = useState<CloudSyncConfig>({
    id: '',
    provider: 'google_drive',
    folder_or_file_id: '',
    file_name: 'Master_College_Attendance.xlsx',
    sync_interval_minutes: 15,
    status: 'idle',
    is_enabled: true,
  });
  const [lastSyncJob, setLastSyncJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const data = await api.getCloudSyncStatus();
      if (data.config) setConfig(data.config);
      if (data.lastSyncJob) setLastSyncJob(data.lastSyncJob);
    } catch (err) {
      console.error('Failed to load cloud sync status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await api.updateCloudSyncConfig(config);
      setFeedback('Cloud sync parameters updated successfully.');
      await fetchStatus();
    } catch (err: any) {
      setFeedback(`Failed to save configuration: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setFeedback(null);
    try {
      const res = await api.triggerCloudSync();
      setFeedback(res.message || 'Synchronization successfully executed.');
      await fetchStatus();
    } catch (err: any) {
      setFeedback(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-sky-400 mb-1">
            <Cloud className="w-4 h-4" />
            <span>Automated File Watcher</span>
          </div>
          <h1 className="text-2xl font-bold text-white font-['Outfit']">Cloud Drive Synchronization</h1>
          <p className="text-xs text-slate-400 mt-1">
            Connect a cloud master file (Google Drive or OneDrive) to automatically import new attendance records without manual uploads.
          </p>
        </div>

        <button
          type="button"
          disabled={syncing}
          onClick={handleSyncNow}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-sky-900/30 flex items-center space-x-2 transition disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? 'Synchronizing...' : 'Sync Master File Now'}</span>
        </button>
      </div>

      {feedback && (
        <div className="p-4 rounded-xl bg-blue-950/80 border border-blue-800 text-blue-200 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{feedback}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Form */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-slate-800 space-y-5">
          <h2 className="text-base font-bold text-white font-['Outfit'] flex items-center space-x-2">
            <Folder className="w-4 h-4 text-indigo-400" />
            <span>Cloud Repository Connection</span>
          </h2>

          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                Cloud Provider
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, provider: 'google_drive' })}
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-2 transition ${
                    config.provider === 'google_drive'
                      ? 'bg-blue-950/80 border-blue-600 text-blue-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <Cloud className="w-4 h-4 text-blue-400" />
                  <span>Google Drive Folder</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfig({ ...config, provider: 'onedrive' })}
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-2 transition ${
                    config.provider === 'onedrive'
                      ? 'bg-blue-950/80 border-blue-600 text-blue-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <Cloud className="w-4 h-4 text-sky-400" />
                  <span>Microsoft OneDrive Folder</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                Target Folder ID / Shared Folder URL
              </label>
              <input
                type="text"
                value={config.folder_or_file_id}
                onChange={(e) => setConfig({ ...config, folder_or_file_id: e.target.value })}
                placeholder="e.g. 1A2B3C4D_DemoFolderId or folder link"
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                  Master File Name
                </label>
                <input
                  type="text"
                  value={config.file_name}
                  onChange={(e) => setConfig({ ...config, file_name: e.target.value })}
                  placeholder="Master_College_Attendance.xlsx"
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                  Automated Polling Interval
                </label>
                <select
                  value={config.sync_interval_minutes}
                  onChange={(e) => setConfig({ ...config, sync_interval_minutes: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none"
                >
                  <option value={5}>Every 5 minutes</option>
                  <option value={15}>Every 15 minutes (Standard)</option>
                  <option value={30}>Every 30 minutes</option>
                  <option value={60}>Every 1 hour</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(config.is_enabled)}
                  onChange={(e) => setConfig({ ...config, is_enabled: e.target.checked })}
                  className="rounded border-slate-700 text-blue-600 focus:ring-0 w-4 h-4"
                />
                <span>Enable automated periodic cloud sync daemon</span>
              </label>

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>

        {/* Live Daemon Status Widget */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-white font-['Outfit'] mb-3">Daemon Status</h2>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Daemon Health</span>
                <span className="flex items-center space-x-1.5 text-emerald-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 live-indicator" />
                  <span>Online & Active</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Last Sync Time</span>
                <span className="text-slate-200 font-mono">
                  {config.last_sync_time ? new Date(config.last_sync_time).toLocaleTimeString() : 'Pending sync'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Security Sandbox</span>
                <span className="text-sky-300 font-medium">Backend Isolated</span>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-blue-950/30 border border-blue-900/40 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center space-x-1.5 text-sky-300 font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Zero-Client Cloud Credentials</span>
              </div>
              <p>
                Student devices never contact cloud storage directly. The secure backend process parses master files and dispatches updates via SSE.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
