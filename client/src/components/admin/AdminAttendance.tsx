import React, { useEffect, useState } from 'react';
import { AttendanceRecord } from '../../types';
import { api } from '../../services/api';
import { Calendar, Search, Filter, CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

export const AdminAttendance: React.FC = () => {
  const [records, setRecords] = useState<(AttendanceRecord & { student_name: string; branch: string; section: string })[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [cuIdSearch, setCuIdSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminAttendance({
        date: selectedDate,
        subject: selectedSubject,
        cu_id: cuIdSearch,
      });
      setRecords(data.records || []);
      setDates(data.dates || []);
      setSubjects(data.subjects || []);
    } catch (err) {
      console.error('Failed to load admin attendance records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [selectedDate, selectedSubject]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRecords();
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-sky-400 mb-1">
            <Calendar className="w-4 h-4" />
            <span>Attendance Log Explorer</span>
          </div>
          <h1 className="text-2xl font-bold text-white font-['Outfit']">Attendance Sessions Master Record</h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse and filter historical session attendance by date, subject module, and student CU ID.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchRecords}
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
          {/* Date Selector */}
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-300 focus:outline-none"
          >
            <option value="">All Attendance Dates</option>
            {dates.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Subject Selector */}
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="px-3 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">All Course Subjects</option>
            {subjects.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">CU ID</th>
                <th className="py-3.5 px-4">Student Name</th>
                <th className="py-3.5 px-4">Subject</th>
                <th className="py-3.5 px-4 text-center">Sessions Held</th>
                <th className="py-3.5 px-4 text-center">Attended (P / A)</th>
                <th className="py-3.5 px-4 text-center">Percentage</th>
                <th className="py-3.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    Loading records...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No attendance records match the selected filters.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-mono text-slate-300">{r.attendance_date}</td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-sky-400">{r.cu_id}</td>
                    <td className="py-3.5 px-4 font-medium text-white">{r.student_name}</td>
                    <td className="py-3.5 px-4 text-slate-300">{r.subject}</td>
                    <td className="py-3.5 px-4 text-center font-mono">{r.total_sessions}</td>
                    <td className="py-3.5 px-4 text-center font-mono">
                      <span className="text-emerald-400">{r.present_sessions}</span> /{' '}
                      <span className="text-rose-400">{r.absent_sessions}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-100">
                      {r.attendance_percentage}%
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          r.status === 'Present'
                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                            : r.status === 'Absent'
                            ? 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
                            : 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
                        }`}
                      >
                        {r.status}
                      </span>
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
