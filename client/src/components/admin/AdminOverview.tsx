import React, { useEffect, useState } from 'react';
import { AdminAnalytics } from '../../types';
import { api } from '../../services/api';
import {
  Users,
  Percent,
  AlertTriangle,
  FileCheck2,
  FileSpreadsheet,
  Cloud,
  RefreshCw,
  Clock,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Megaphone
} from 'lucide-react';

interface AdminOverviewProps {
  onNavigateTab: (tab: any) => void;
  currentUser?: any;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({ onNavigateTab, currentUser }) => {
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      const data = await api.getAdminAnalytics();
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load admin analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await api.triggerCloudSync();
      setSyncFeedback(res.message || 'Cloud sync finished successfully.');
      await fetchAnalytics();
    } catch (err: any) {
      setSyncFeedback(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  if (loading || !analytics) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-14 bg-slate-800/60 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="h-28 bg-slate-800/40 rounded-2xl" />
          <div className="h-28 bg-slate-800/40 rounded-2xl" />
          <div className="h-28 bg-slate-800/40 rounded-2xl" />
          <div className="h-28 bg-slate-800/40 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1.5 flex-wrap gap-y-1">
            <h1 className="text-2xl font-bold text-white font-['Outfit']">Administrative Analytics</h1>
            {currentUser?.role === 'hod' ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-mono">
                HOD • {currentUser.department}
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800/60 font-mono">
                Super Admin • College-Wide
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            {currentUser?.role === 'hod'
              ? `Authorized view for ${currentUser.department}. Showing metrics and student compliance for your department.`
              : 'Real-time college attendance posture, special assignment compliance, and cloud synchronization health across all departments.'}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={fetchAnalytics}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Refresh statistics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('messages')}
            className="px-3.5 py-2.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 text-xs font-semibold flex items-center space-x-1.5 transition"
            title="Broadcast notice to students"
          >
            <Megaphone className="w-4 h-4 text-purple-400" />
            <span>Send Notice</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('excel_import')}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-900/30 flex items-center space-x-2 transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Upload New Excel</span>
          </button>
        </div>
      </div>

      {/* Sync feedback notice */}
      {syncFeedback && (
        <div className="p-3.5 rounded-xl bg-blue-950/80 border border-blue-800/60 text-blue-200 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{syncFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncFeedback(null)}
            className="text-slate-400 hover:text-white text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div
          onClick={() => onNavigateTab('students')}
          className="glass-card glass-card-interactive rounded-2xl p-5 border border-slate-800 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Total Enrolled Students</span>
            <div className="w-8 h-8 rounded-lg bg-blue-950 text-blue-400 flex items-center justify-center border border-blue-800/50">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-white font-mono mt-3">
            {analytics.totalStudents}
          </p>
          <div className="mt-2 flex items-center text-[11px] text-blue-400 font-medium">
            <span>View all enrolled students</span>
            <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
          </div>
        </div>

        {/* College Avg Attendance */}
        <div className="glass-card rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">College Average Attendance</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-950 text-indigo-400 flex items-center justify-center border border-indigo-800/50">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-indigo-400 font-mono mt-3">
            {analytics.averageAttendance}%
          </p>
          <div className="mt-2 text-[11px] text-slate-400">
            Mandatory cutoff: {analytics.attendanceThreshold}%
          </div>
        </div>

        {/* Defaulters Below 75% */}
        <div
          onClick={() => onNavigateTab('students')}
          className="glass-card glass-card-interactive rounded-2xl p-5 border border-slate-800 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Defaulters (&lt;75% Attendance)</span>
            <div className="w-8 h-8 rounded-lg bg-rose-950 text-rose-400 flex items-center justify-center border border-rose-800/50">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-rose-400 font-mono mt-3">
            {analytics.defaultersCount}
          </p>
          <div className="mt-2 flex items-center text-[11px] text-rose-400 font-medium">
            <span>Filter defaulter students</span>
            <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
          </div>
        </div>

        {/* Special Assignments */}
        <div
          onClick={() => onNavigateTab('assignments')}
          className="glass-card glass-card-interactive rounded-2xl p-5 border border-slate-800 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Special Assignments</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-950 text-emerald-400 flex items-center justify-center border border-emerald-800/50">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-white font-mono mt-3">
            {analytics.totalAssignments}
          </p>
          <div className="mt-2 text-[11px] flex items-center space-x-2 text-slate-400">
            <span className="text-emerald-400">{analytics.submittedAssignments} Submitted</span>
            <span>•</span>
            <span className="text-amber-400">{analytics.pendingAssignments} Pending</span>
          </div>
        </div>
      </div>

      {/* Cloud Sync Status & Recent Imports Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cloud Sync Quick Control Card */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Cloud className="w-5 h-5 text-sky-400" />
                <h3 className="text-base font-bold text-white font-['Outfit']">Cloud Sync Service</h3>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  analytics.cloudSync.isCurrentlySyncing
                    ? 'bg-amber-950 text-amber-300 border border-amber-700 animate-pulse'
                    : analytics.cloudSync.config.status === 'success'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {analytics.cloudSync.isCurrentlySyncing ? 'Syncing...' : analytics.cloudSync.config.status}
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Continuous background daemon monitoring master Excel sheet on Google Drive / OneDrive.
            </p>

            <div className="mt-4 p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Provider</span>
                <span className="font-semibold text-white uppercase">{analytics.cloudSync.config.provider}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Master File</span>
                <span className="font-mono text-sky-300 truncate max-w-[160px]">
                  {analytics.cloudSync.config.file_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sync Interval</span>
                <span className="text-slate-300 font-medium">Every {analytics.cloudSync.config.sync_interval_minutes} mins</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Last Synced</span>
                <span className="text-slate-300 font-mono text-[11px]">
                  {analytics.cloudSync.config.last_sync_time
                    ? new Date(analytics.cloudSync.config.last_sync_time).toLocaleTimeString()
                    : 'Awaiting sync'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 flex space-x-3">
            <button
              type="button"
              disabled={syncing}
              onClick={handleSyncNow}
              className="flex-1 py-2.5 px-3 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center justify-center space-x-1.5 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing Drive...' : 'Trigger Sync Now'}</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('cloud_sync')}
              className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
            >
              Configure
            </button>
          </div>
        </div>

        {/* Recent Excel Imports */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white font-['Outfit']">Recent Excel Uploads</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('import_history')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center"
              >
                <span>View Full History</span>
                <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
              </button>
            </div>

            {analytics.recentImports.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">No Excel imports recorded yet.</p>
            ) : (
              <div className="space-y-2.5">
                {analytics.recentImports.map((job) => (
                  <div
                    key={job.id}
                    className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-white">{job.filename}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                            job.status === 'success'
                              ? 'bg-emerald-950 text-emerald-300'
                              : 'bg-amber-950 text-amber-300'
                          }`}
                        >
                          {job.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        By {job.uploaded_by} • {new Date(job.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                      </p>
                    </div>

                    <div className="flex items-center space-x-3 text-slate-300 self-end sm:self-auto font-mono text-[11px]">
                      <span>{job.students_updated} stds</span>
                      <span>•</span>
                      <span>{job.attendance_updated} attd</span>
                      <span>•</span>
                      <span>{job.assignments_updated} asns</span>
                      {job.errors_count > 0 && (
                        <span className="text-rose-400">({job.errors_count} errs)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>All imports are atomic and update students via CU ID match.</span>
            <button
              type="button"
              onClick={() => onNavigateTab('excel_import')}
              className="text-sky-400 hover:text-sky-300 font-semibold"
            >
              + Upload Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
