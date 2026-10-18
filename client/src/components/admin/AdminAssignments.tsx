import React, { useEffect, useState } from 'react';
import { Assignment } from '../../types';
import { api } from '../../services/api';
import { FileCheck2, Search, CheckCircle2, AlertTriangle, Clock, RefreshCw } from 'lucide-react';

export const AdminAssignments: React.FC = () => {
  const [assignments, setAssignments] = useState<(Assignment & { student_name: string; branch: string; section: string })[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [cuIdSearch, setCuIdSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminAssignments({
        status: statusFilter,
        subject: subjectFilter,
        cu_id: cuIdSearch,
      });
      setAssignments(data.assignments || []);
    } catch (err) {
      console.error('Failed to load admin assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [statusFilter, subjectFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAssignments();
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('submit')) {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 uppercase">
          <CheckCircle2 className="w-3 h-3" />
          <span>Submitted</span>
        </span>
      );
    }
    if (s.includes('late')) {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/60 text-rose-300 border border-rose-800/60 uppercase">
          <AlertTriangle className="w-3 h-3" />
          <span>Late</span>
        </span>
      );
    }
    if (s.includes('na') || s.includes('not')) {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 uppercase">
          <span>N/A</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-800/60 uppercase">
        <Clock className="w-3 h-3" />
        <span>Pending</span>
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <FileCheck2 className="w-4 h-4" />
            <span>Coursework Management</span>
          </div>
          <h1 className="text-2xl font-bold text-white font-['Outfit']">Special Assignments Submission Master</h1>
          <p className="text-xs text-slate-400 mt-1">
            Track student assignment compliance, verified submission timestamps, and evaluator feedback.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchAssignments}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-slate-800 flex flex-col md:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            value={cuIdSearch}
            onChange={(e) => setCuIdSearch(e.target.value)}
            placeholder="Search by student CU ID..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">All Submission Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="pending">Pending</option>
            <option value="late">Late</option>
          </select>
        </div>
      </div>

      {/* Mobile Touch Cards View (< md) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="glass-panel rounded-2xl p-8 text-center text-slate-500 text-xs">
            Loading assignment records...
          </div>
        ) : assignments.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center text-slate-500 text-xs">
            No assignment records match the selected criteria.
          </div>
        ) : (
          assignments.map((a) => (
            <div key={a.id} className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-white break-words">{a.assignment_name}</h4>
                  <div className="flex items-center space-x-2 mt-0.5 text-[11px] font-mono">
                    <span className="text-sky-400 font-bold">{a.cu_id}</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-300 font-sans">{a.student_name}</span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {getStatusBadge(a.submission_status)}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">Subject:</span>
                  <span className="text-slate-200 font-medium">{a.subject}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">Deadline:</span>
                  <span className="text-slate-300 font-mono">{a.submission_deadline}</span>
                </div>
                {a.submission_date && (
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">Submitted On:</span>
                    <span className="text-emerald-400 font-mono">{a.submission_date}</span>
                  </div>
                )}
                {a.remarks && (
                  <div className="text-[11px] pt-1 border-t border-slate-800/60 text-slate-400">
                    <span className="font-semibold text-slate-300">Remarks: </span>
                    {a.remarks}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table (hidden on mobile, visible md+) */}
      <div className="hidden md:block glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Assignment ID</th>
                <th className="py-3.5 px-4">CU ID</th>
                <th className="py-3.5 px-4">Student Name</th>
                <th className="py-3.5 px-4">Assignment Title & Subject</th>
                <th className="py-3.5 px-4">Deadline</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Submitted Date</th>
                <th className="py-3.5 px-4">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    Loading assignment records...
                  </td>
                </tr>
              ) : assignments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No assignment records match the selected criteria.
                  </td>
                </tr>
              ) : (
                assignments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-300">
                      {a.assignment_id}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-sky-400">
                      {a.cu_id}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-white">
                      {a.student_name}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{a.assignment_name}</div>
                      <div className="text-[11px] text-slate-400">{a.subject}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {a.submission_deadline}
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(a.submission_status)}</td>
                    <td className="py-3.5 px-4 font-mono text-emerald-400">
                      {a.submission_date || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 max-w-xs truncate">
                      {a.remarks || '—'}
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
