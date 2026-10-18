import React, { useEffect, useState } from 'react';
import { ImportJob } from '../../types';
import { api } from '../../services/api';
import {
  History,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Trash2,
  X,
  AlertCircle
} from 'lucide-react';

export const AdminImportHistory: React.FC = () => {
  const [history, setHistory] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Deletion modal state
  const [jobToDelete, setJobToDelete] = useState<ImportJob | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await api.getImportHistory();
      setHistory(data.history || []);
    } catch (err: any) {
      console.error('Failed to load import history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Handle single job deletion
  const handleDeleteJob = async () => {
    if (!jobToDelete) return;
    setDeleting(true);
    setActionNotice(null);
    try {
      const res = await api.deleteImportJob(jobToDelete.id);
      setActionNotice({
        type: 'success',
        message: res.message || `Deleted dataset "${jobToDelete.filename}" and its associated records.`,
      });
      setJobToDelete(null);
      await fetchHistory();
    } catch (err: any) {
      setActionNotice({
        type: 'error',
        message: err.message || 'Failed to delete import dataset.',
      });
    } finally {
      setDeleting(false);
    }
  };

  // Handle clear all datasets
  const handleClearAll = async () => {
    setClearingAll(true);
    setActionNotice(null);
    try {
      const res = await api.clearAllImportData();
      setActionNotice({
        type: 'success',
        message: res.message || 'All imported Excel datasets and student records have been reset successfully.',
      });
      setShowClearAllModal(false);
      await fetchHistory();
    } catch (err: any) {
      setActionNotice({
        type: 'error',
        message: err.message || 'Failed to reset data.',
      });
    } finally {
      setClearingAll(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1">
            <History className="w-4 h-4" />
            <span>Audit Trail & Ingestion Logs</span>
          </div>
          <h1 className="text-2xl font-bold text-white font-['Outfit']">Excel Import History & Datasets</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage uploaded Excel sheets, delete outdated datasets, inspect ingestion logs, or reset all imported data.
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearAllModal(true)}
              className="px-3.5 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 text-xs font-semibold flex items-center space-x-1.5 transition"
              title="Delete all uploaded sheets and student records"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All Data</span>
            </button>
          )}

          <button
            type="button"
            onClick={fetchHistory}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Refresh history"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionNotice && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-start justify-between space-x-2.5 animate-fadeIn ${
            actionNotice.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
              : 'bg-red-950/80 border-red-800 text-red-200'
          }`}
        >
          <div className="flex items-start space-x-2.5">
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">{actionNotice.type === 'success' ? 'Operation Completed' : 'Operation Error'}</p>
              <p className="mt-0.5">{actionNotice.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mobile Touch Cards View (< md) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="glass-panel rounded-2xl p-8 text-center text-slate-500 text-xs">
            Loading history logs...
          </div>
        ) : history.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center text-slate-500 text-xs">
            No import jobs found. Upload an Excel file to get started.
          </div>
        ) : (
          history.map((job) => (
            <div key={job.id} className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-950/60 border border-blue-800/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-white break-words" title={job.filename}>
                      {job.filename}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {new Date(job.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${
                    job.status === 'success'
                      ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                      : 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
                  }`}
                >
                  {job.status}
                </span>
              </div>

              {/* Stats badges */}
              <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-xl bg-slate-900/80 border border-slate-800/80 text-[11px] text-center font-mono">
                <div>
                  <div className="text-slate-400 text-[9px] uppercase">Students</div>
                  <div className="text-sky-300 font-bold">{job.students_updated}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[9px] uppercase">Attendance</div>
                  <div className="text-emerald-300 font-bold">{job.attendance_updated}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[9px] uppercase">Assignments</div>
                  <div className="text-indigo-300 font-bold">{job.assignments_updated}</div>
                </div>
              </div>

              {/* Errors & Type */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <div className="flex items-center space-x-2">
                  <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono bg-slate-800 text-slate-300 border border-slate-700">
                    {job.import_type}
                  </span>
                  <span className="text-[10px] text-slate-400">By: {job.uploaded_by}</span>
                </div>
                {job.errors_count > 0 ? (
                  <span className="text-rose-400 font-bold font-mono">
                    {job.errors_count} errors
                  </span>
                ) : (
                  <span className="text-emerald-400 font-mono text-[10px]">0 errors</span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                {job.errors_count > 0 && (
                  <a
                    href={api.downloadErrorReportUrl(job.id)}
                    className="flex-1 py-2 px-3 rounded-xl bg-rose-950/50 hover:bg-rose-900 text-rose-300 border border-rose-800/60 text-xs font-semibold flex items-center justify-center space-x-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Errors</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setJobToDelete(job)}
                  className="flex-1 py-2 px-3 rounded-xl bg-red-950/40 hover:bg-red-900 text-red-300 border border-red-800/50 text-xs font-semibold flex items-center justify-center space-x-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span>Delete Sheet</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop History Table (hidden on mobile, visible md+) */}
      <div className="hidden md:block glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Upload Timestamp</th>
                <th className="py-3.5 px-4">Source Excel Sheet</th>
                <th className="py-3.5 px-4">Admin / Origin</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Records Updated</th>
                <th className="py-3.5 px-4 text-center">Errors</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    Loading history logs...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No import jobs found. Upload an Excel file to get started.
                  </td>
                </tr>
              ) : (
                history.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {new Date(job.created_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-white flex items-center space-x-2">
                      <FileSpreadsheet className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <span className="truncate max-w-[200px]" title={job.filename}>{job.filename}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">{job.uploaded_by}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono bg-slate-800 text-slate-300 border border-slate-700">
                        {job.import_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          job.status === 'success'
                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                            : 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-[11px]">
                      <span className="text-sky-300">{job.students_updated} stds</span> •{' '}
                      <span className="text-emerald-300">{job.attendance_updated} attd</span> •{' '}
                      <span className="text-indigo-300">{job.assignments_updated} asns</span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono">
                      <span className={job.errors_count > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                        {job.errors_count}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {job.errors_count > 0 && (
                          <a
                            href={api.downloadErrorReportUrl(job.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 text-[11px] font-medium transition inline-flex items-center space-x-1"
                            title="Download Excel error log"
                          >
                            <Download className="w-3 h-3" />
                            <span>Errors</span>
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => setJobToDelete(job)}
                          className="px-2.5 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900 text-red-300 border border-red-800/50 text-[11px] font-semibold transition inline-flex items-center space-x-1"
                          title="Delete this uploaded Excel sheet and its imported attendance data"
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                          <span>Delete Sheet</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal: Delete Single Job */}
      {jobToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="glass-panel max-w-md w-full rounded-2xl p-6 border border-rose-800/60 bg-slate-900 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-800 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-['Outfit']">Delete Uploaded Excel Sheet</h3>
                <p className="text-xs text-rose-300/80">Permanent removal of imported records</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Are you sure you want to delete <strong className="text-white font-mono">{jobToDelete.filename}</strong>?
            </p>

            <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] space-y-1 text-slate-300">
              <p>• Associated Attendance Records: <strong className="text-emerald-300 font-mono">{jobToDelete.attendance_updated}</strong></p>
              <p>• Associated Assignments: <strong className="text-indigo-300 font-mono">{jobToDelete.assignments_updated}</strong></p>
              <p>• Associated Students: <strong className="text-sky-300 font-mono">{jobToDelete.students_updated}</strong></p>
              <p className="text-amber-400 pt-1 text-[10px]">
                ⚠ This will permanently purge attendance and assignment records imported from this Excel file.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-end space-x-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setJobToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteJob}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-lg shadow-red-900/40 flex items-center space-x-1.5 transition disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleting ? 'Deleting Records...' : 'Yes, Delete Sheet & Data'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Clear All Data */}
      {showClearAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="glass-panel max-w-md w-full rounded-2xl p-6 border border-rose-800/80 bg-slate-900 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-800 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-['Outfit']">Reset & Clear All Data?</h3>
                <p className="text-xs text-rose-300/80">College ERP complete data wipe</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              This will completely wipe all imported student rosters, attendance records, assignments, and import history from the database.
            </p>

            <p className="text-xs text-emerald-400 mt-2 font-medium">
              ✓ Admin login accounts will NOT be deleted.
            </p>

            <div className="mt-5 flex items-center justify-end space-x-3">
              <button
                type="button"
                disabled={clearingAll}
                onClick={() => setShowClearAllModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={clearingAll}
                onClick={handleClearAll}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-lg shadow-red-900/40 flex items-center space-x-1.5 transition disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{clearingAll ? 'Clearing Database...' : 'Confirm Clear All Data'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
