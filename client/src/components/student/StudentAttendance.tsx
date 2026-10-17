import React, { useEffect, useState } from 'react';
import { DailyAttendanceSummary, AttendanceRecord } from '../../types';
import { api } from '../../services/api';
import { Calendar, CheckCircle2, XCircle, AlertCircle, Clock, BookOpen, Layers } from 'lucide-react';

interface StudentAttendanceProps {
  cuId: string;
}

export const StudentAttendance: React.FC<StudentAttendanceProps> = ({ cuId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dailySummaries, setDailySummaries] = useState<DailyAttendanceSummary[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchAttendance = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getStudentAttendance(cuId);
      setDailySummaries(data.dailySummaries || []);
      setTotalRecords(data.totalRecords || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load attendance logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [cuId]);

  const getStatusBadge = (status: string, percentage: number) => {
    if (status === 'Present' || percentage === 100) {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Present</span>
        </span>
      );
    }
    if (status === 'Absent' || percentage === 0) {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950/60 text-rose-300 border border-rose-800/60">
          <XCircle className="w-3.5 h-3.5" />
          <span>Absent</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/60">
        <AlertCircle className="w-3.5 h-3.5" />
        <span>Partial ({percentage}%)</span>
      </span>
    );
  };

  const formatDateDisplay = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      }
    } catch (e) {}
    return dateStr;
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse pb-24 md:pb-8">
        <div className="h-20 bg-slate-800/60 rounded-2xl" />
        <div className="h-32 bg-slate-800/40 rounded-2xl" />
        <div className="h-32 bg-slate-800/40 rounded-2xl" />
        <div className="h-32 bg-slate-800/40 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-red-950/40 border border-red-800/60 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-red-200 font-medium">{error}</p>
        <button
          type="button"
          onClick={fetchAttendance}
          className="mt-4 px-4 py-2 bg-red-900/60 hover:bg-red-900 text-red-100 rounded-xl text-xs font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-24 md:pb-8">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-sky-400 mb-1">
            <Calendar className="w-4 h-4" />
            <span>Attendance Timeline</span>
          </div>
          <h2 className="text-2xl font-bold text-white font-['Outfit']">Last Five Available Days</h2>
          <p className="text-xs text-slate-400 mt-1">
            Detailed breakdown of scheduled classes and attendance status for the 5 most recent dates.
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
          <Layers className="w-4 h-4 text-blue-400" />
          <span>Total Historical Records: {totalRecords}</span>
        </div>
      </div>

      {/* Days List */}
      {dailySummaries.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center border border-slate-800">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No Record Available</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            No attendance sessions have been logged for this student yet. Attendance will appear here once the admin imports records.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {dailySummaries.map((day, idx) => (
            <div
              key={day.date}
              className="glass-panel rounded-2xl p-5 sm:p-6 border border-slate-800/90 relative overflow-hidden transition-all hover:border-slate-700"
            >
              {/* Day Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800/80">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-900 to-indigo-900 border border-blue-700/50 flex flex-col items-center justify-center font-mono">
                    <span className="text-[10px] text-blue-300 font-bold leading-none">DAY</span>
                    <span className="text-sm text-white font-extrabold leading-none">{idx + 1}</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white font-['Outfit']">
                      {formatDateDisplay(day.date)}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">{day.date}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 self-end sm:self-auto">
                  <div className="text-right">
                    <div className="text-xs font-semibold text-slate-300">
                      Day Total: {day.totalPresent} / {day.totalHeld} Sessions
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Daily: {day.percentage}%
                    </div>
                  </div>
                  {getStatusBadge(day.status, day.percentage)}
                </div>
              </div>

              {/* Individual Session Breakdown */}
              <div className="mt-4 space-y-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center space-x-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                  <span>Subject Sessions Conducted:</span>
                </p>

                {day.sessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5"
                  >
                    <div>
                      <h4 className="text-sm font-semibold text-white">{session.subject}</h4>
                      <div className="flex items-center space-x-3 text-xs text-slate-400 mt-0.5">
                        <span>Sessions Held: {session.total_sessions}</span>
                        <span>•</span>
                        <span className="text-emerald-400">Present: {session.present_sessions}</span>
                        <span>•</span>
                        <span className="text-rose-400">Absent: {session.absent_sessions}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 self-end sm:self-auto">
                      <span className="text-xs font-mono font-medium text-slate-300">
                        {session.attendance_percentage}%
                      </span>
                      {getStatusBadge(session.status, session.attendance_percentage)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Missing days fill notice */}
          {dailySummaries.length < 5 && (
            <div className="p-4 rounded-xl bg-slate-900/60 border border-dashed border-slate-800 text-center text-xs text-slate-500">
              {5 - dailySummaries.length} earlier attendance date(s) have no record available yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
