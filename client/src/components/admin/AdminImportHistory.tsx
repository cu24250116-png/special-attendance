import React, { useEffect, useState } from 'react';
import { ImportJob } from '../../types';
import { api } from '../../services/api';
import { History, Download, RefreshCw, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react';

export const AdminImportHistory: React.FC = () => {
  const [history, setHistory] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await api.getImportHistory();
      setHistory(data.history || []);
    } catch (err) {
      console.error('Failed to load import history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1">
            <History className="w-4 h-4" />
            <span>Audit Trail & Ingestion Logs</span>
          </div>
          <h1 className="text-2xl font-bold text-white font-['Outfit']">Excel Import History</h1>
          <p className="text-xs text-slate-400 mt-1">
            Historical log of all Excel uploads and cloud synchronization jobs, records committed, and error reports.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchHistory}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* History Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Upload Timestamp</th>
                <th className="py-3.5 px-4">Source File</th>
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
                    No import jobs found.
                  </td>
                </tr>
              ) : (
                history.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {new Date(job.created_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-white flex items-center space-x-2">
                      <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                      <span>{job.filename}</span>
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
                    <td className="py-3.5 px-4 text-center font-mono">
                      <span>{job.students_updated} stds</span> •{' '}
                      <span>{job.attendance_updated} attd</span> •{' '}
                      <span>{job.assignments_updated} asns</span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono">
                      <span className={job.errors_count > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                        {job.errors_count}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {job.errors_count > 0 ? (
                        <a
                          href={api.downloadErrorReportUrl(job.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 text-[11px] font-medium transition inline-flex items-center space-x-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>Error Report</span>
                        </a>
                      ) : (
                        <span className="text-[11px] text-emerald-500 font-medium">Clean</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
