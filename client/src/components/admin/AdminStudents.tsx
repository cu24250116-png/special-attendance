import React, { useEffect, useState } from 'react';
import { Student } from '../../types';
import { api } from '../../services/api';
import {
  Users,
  Search,
  Filter,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sparkles,
  X
} from 'lucide-react';

export const AdminStudents: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('all');
  const [semester, setSemester] = useState('all');
  const [threshold, setThreshold] = useState('all');
  const [filterOptions, setFilterOptions] = useState<{ branches: string[]; semesters: string[] }>({
    branches: [],
    semesters: [],
  });

  // Edit Modal State
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editPercentage, setEditPercentage] = useState('');
  const [editTotalSessions, setEditTotalSessions] = useState('');
  const [editPresentSessions, setEditPresentSessions] = useState('');
  const [saving, setSaving] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminStudents({
        search,
        branch,
        semester,
        threshold,
        page,
        limit: 15,
      });
      setStudents(data.students || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setFilterOptions(data.filterOptions || { branches: [], semesters: [] });
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [page, branch, semester, threshold]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchStudents();
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setEditPercentage(String(student.overall_percentage));
    setEditTotalSessions(String(student.total_sessions));
    setEditPresentSessions(String(student.present_sessions));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    setSaving(true);
    try {
      const res = await api.updateStudentAttendance(editingStudent.cu_id, {
        overall_percentage: parseFloat(editPercentage),
        total_sessions: parseInt(editTotalSessions, 10),
        present_sessions: parseInt(editPresentSessions, 10),
      });

      setSuccessBanner(
        `Updated ${editingStudent.student_name} (${editingStudent.cu_id}) to ${editPercentage}%. Broadcast pushed live to student screen!`
      );
      setEditingStudent(null);
      await fetchStudents();
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Banner */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1">
            <Users className="w-4 h-4" />
            <span>Master Enrollment Records</span>
          </div>
          <h1 className="text-2xl font-bold text-white font-['Outfit']">Student Directory & Attendance</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage student metadata, view overall attendance percentages, and perform instant record updates.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchStudents}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition self-start sm:self-auto"
          title="Refresh table"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Success Notification */}
      {successBanner && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-700/60 text-emerald-200 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-slate-400 hover:text-white text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-slate-800 flex flex-col md:flex-row gap-3">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 transform -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by CU ID or Student Name..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </form>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Branch */}
          <select
            value={branch}
            onChange={(e) => {
              setBranch(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">All Departments</option>
            {filterOptions.branches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          {/* Semester */}
          <select
            value={semester}
            onChange={(e) => {
              setSemester(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">All Semesters</option>
            {filterOptions.semesters.map((s) => (
              <option key={s} value={s}>Semester {s}</option>
            ))}
          </select>

          {/* Threshold */}
          <select
            value={threshold}
            onChange={(e) => {
              setThreshold(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">All Thresholds</option>
            <option value="below_75">Below 75% (Defaulters)</option>
            <option value="above_75">75% and Above (Safe)</option>
          </select>
        </div>
      </div>

      {/* Students Data Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Student ID / Roll No</th>
                <th className="py-3.5 px-4">Student Name</th>
                <th className="py-3.5 px-4">Father's Name</th>
                <th className="py-3.5 px-4">Course / Sem / Sec</th>
                <th className="py-3.5 px-4 text-center">Sessions (P / Total)</th>
                <th className="py-3.5 px-4 text-center">Overall %</th>
                <th className="py-3.5 px-4 text-center">Standing</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    Loading student records...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No student records found. Upload an Excel spreadsheet to import students.
                  </td>
                </tr>
              ) : (
                students.map((student) => {
                  const pct = Math.round(student.overall_percentage * 10) / 10;
                  const isSafe = pct >= 75;
                  return (
                    <tr key={student.cu_id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-mono">
                        <span className="font-semibold text-sky-400">{student.cu_id}</span>
                        {student.roll_number && student.roll_number !== student.cu_id && (
                          <span className="block text-[11px] text-slate-400">Roll: {student.roll_number}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-white">
                        {student.student_name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        {student.father_name || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {student.course} • Sem {student.semester}-{student.section}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono">
                        <span className="text-emerald-400">{student.present_sessions}</span> /{' '}
                        <span>{student.total_sessions}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-sm">
                        <span className={isSafe ? 'text-emerald-400' : 'text-rose-400'}>
                          {pct}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isSafe
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                              : 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
                          }`}
                        >
                          {isSafe ? 'Safe' : 'Defaulter'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openEditModal(student)}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-900/40 hover:bg-indigo-900/70 text-indigo-300 border border-indigo-700/50 text-[11px] font-medium transition inline-flex items-center space-x-1"
                          title="Quick update attendance percentage"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Quick Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Showing page {page} of {totalPages} ({total} total students)</span>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono">{page}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Edit Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full glass-panel rounded-2xl p-6 border border-slate-700 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setEditingStudent(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-950 text-indigo-400 flex items-center justify-center border border-indigo-800">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-['Outfit']">
                  Edit Student Attendance
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  {editingStudent.student_name} ({editingStudent.cu_id})
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                  Overall Attendance Percentage (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={editPercentage}
                  onChange={(e) => setEditPercentage(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  E.g. Change from 88% to 92% to test instant propagation to student screen.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                    Present Sessions
                  </label>
                  <input
                    type="number"
                    value={editPresentSessions}
                    onChange={(e) => setEditPresentSessions(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                    Total Sessions
                  </label>
                  <input
                    type="number"
                    value={editTotalSessions}
                    onChange={(e) => setEditTotalSessions(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-indigo-900/30 flex items-center justify-center space-x-2 transition disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{saving ? 'Broadcasting Update...' : 'Save & Broadcast Live'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
