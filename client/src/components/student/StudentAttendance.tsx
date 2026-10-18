import React, { useEffect, useState } from 'react';
import { DailyAttendanceSummary, AttendanceRecord, SpecialClassAttendance } from '../../types';
import { api } from '../../services/api';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  BookOpen,
  Layers,
  Award,
  TrendingUp,
  FileCheck2,
  Download
} from 'lucide-react';
import { Student } from '../../types';

interface StudentAttendanceProps {
  cuId: string;
  student?: Student;
}

export const StudentAttendance: React.FC<StudentAttendanceProps> = ({ cuId, student }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dailySummaries, setDailySummaries] = useState<DailyAttendanceSummary[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [specialAttendance, setSpecialAttendance] = useState<SpecialClassAttendance | null>(null);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(student || null);


  const fetchAttendance = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getStudentAttendance(cuId);
      setDailySummaries(data.dailySummaries || []);
      setTotalRecords(data.totalRecords || 0);
      if (data.specialClassAttendance) {
        setSpecialAttendance(data.specialClassAttendance);
      }
      if (!currentStudent) {
        try {
          const prof = await api.getStudentProfile(cuId);
          if (prof?.student) setCurrentStudent(prof.student);
        } catch (e) {}
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load attendance logs.');
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchAttendance();
  }, [cuId]);

  const getStatusBadge = (status: string, percentage: number, assignmentsUploaded?: number) => {
    const isUploaded = (assignmentsUploaded !== undefined && assignmentsUploaded > 0) || status === 'Present' || percentage === 100;
    if (isUploaded) {
      return (
        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Uploaded • Present</span>
        </span>
      );
    }
    if (status === 'Absent' || percentage === 0) {
      return (
        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-950/60 text-rose-300 border border-rose-800/60">
          <XCircle className="w-3.5 h-3.5" />
          <span>Not Uploaded • Absent</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/60">
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

  const totalSpecialDates = specialAttendance?.totalSpecialDates ?? (specialAttendance?.specialDates?.length || 0);
  const weightPerDay = specialAttendance?.weightPerDay ?? (totalSpecialDates > 0 ? Math.round((100 / totalSpecialDates) * 100) / 100 : 0);
  const uploadedCount = specialAttendance?.uploadedCount ?? 0;
  const specialPct = specialAttendance?.specialAttendancePercentage ?? 0;

  return (
    <div className="w-full max-w-full space-y-5 animate-fadeIn pb-24 md:pb-8 overflow-x-hidden">
      {/* Attendance for Special Class Summary Banner */}
      <div className="glass-panel rounded-2xl p-6 border border-indigo-900/40 bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1">
              <Award className="w-4 h-4" />
              <span>Special Classes & Exam Dates Attendance</span>
            </div>
            <h2 className="text-2xl font-bold text-white font-['Outfit']">
              Attendance for Special Classes:{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-sky-300 font-black">
                {uploadedCount} of {totalSpecialDates} Present
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Special class attendance verification based on official college records (1 = Present, 0 = Absent).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <div className="px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-center">
              <div className="text-slate-400 text-[10px] uppercase">Uploaded / Present</div>
              <div className="text-emerald-400 font-bold font-mono text-base">{uploadedCount} / {totalSpecialDates}</div>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-center">
              <div className="text-slate-400 text-[10px] uppercase">Pending / Absent</div>
              <div className="text-amber-400 font-bold font-mono text-base">{Math.max(0, totalSpecialDates - uploadedCount)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-sky-400 mb-1">
            <Calendar className="w-4 h-4" />
            <span>Special Exam & Assignment Dates Attendance Tracker</span>
          </div>
          <h2 className="text-2xl font-bold text-white font-['Outfit']">Daily Log & Assignment Uploads</h2>
          <p className="text-xs text-slate-400 mt-1">
            Detailed breakdown of scheduled special exam dates, showing attendance status and number of assignments uploaded on that day.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {currentStudent && (
            <button
              type="button"
              onClick={() => api.downloadAttendanceSlip(currentStudent)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-950/40 transition active:scale-95 group"
              title="Download official college attendance and clearance slip"
            >
              <Download className="w-3.5 h-3.5 text-emerald-100 group-hover:-translate-y-0.5 transition-transform" />
              <span>Download Slip (.TXT)</span>
            </button>
          )}
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
            <Layers className="w-4 h-4 text-blue-400" />
            <span>Total Historical Sessions: {totalRecords}</span>
          </div>
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
              {/* Day Header with Number of Assignments Uploaded on that Day */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800/80">
                <div className="flex items-center space-x-3">
                  <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center font-mono border ${
                    day.assignmentsUploaded && day.assignmentsUploaded > 0
                      ? 'bg-gradient-to-tr from-emerald-950 to-blue-900 border-emerald-700/50 text-emerald-300'
                      : 'bg-gradient-to-tr from-rose-950 to-slate-900 border-rose-800/50 text-rose-300'
                  }`}>
                    <span className="text-[9px] font-bold leading-none">DAY</span>
                    <span className="text-sm font-extrabold leading-none mt-0.5">{idx + 1}</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white font-['Outfit'] flex items-center space-x-2">
                      <span>{day.formattedDate || formatDateDisplay(day.date)}</span>
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">{day.date}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
                  {/* Number of assignments uploaded on special day (Exact User Voice Requirement) */}
                  <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-left sm:text-right">
                    <div className="text-xs font-semibold text-slate-200">
                      Number of assignments uploaded on special day:{' '}
                      <strong className={day.assignmentsUploaded && day.assignmentsUploaded > 0 ? 'text-emerald-400 font-mono text-sm' : 'text-rose-400 font-mono text-sm'}>
                        {day.assignmentsUploaded !== undefined ? day.assignmentsUploaded : (day.status === 'Present' ? 1 : 0)}
                      </strong>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Class Record: {day.status === 'Present' || (day.assignmentsUploaded && day.assignmentsUploaded > 0) ? 'Present (1)' : 'Absent (0)'}
                    </div>
                  </div>

                  {getStatusBadge(day.status, day.percentage, day.assignmentsUploaded)}
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
                      {getStatusBadge(session.status, session.attendance_percentage, day.assignmentsUploaded)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
