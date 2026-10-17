import React from 'react';
import { Student } from '../../types';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Calendar,
  FileCheck2,
  AlertTriangle,
  Award,
  ChevronRight,
  TrendingUp,
  GraduationCap
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface StudentDashboardProps {
  student: Student;
  onNavigateTab: (tab: 'attendance' | 'assignments' | 'profile') => void;
  lastSyncNotice: string | null;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  student,
  onNavigateTab,
  lastSyncNotice,
}) => {
  const percentage = Math.round(student.overall_percentage * 10) / 10;
  const isSafe = percentage >= 75;
  const isWarning = percentage >= 65 && percentage < 75;

  const triggerCelebration = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#3b82f6', '#10b981', '#6366f1', '#f59e0b'],
    });
  };

  // Circular progress calculations
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getStatusColor = () => {
    if (isSafe) return 'text-emerald-400 stroke-emerald-500';
    if (isWarning) return 'text-amber-400 stroke-amber-500';
    return 'text-rose-400 stroke-rose-500';
  };

  const formattedDate = student.last_updated
    ? new Date(student.last_updated).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
      })
    : 'Just now';

  return (
    <div className="space-y-6 animate-fadeIn pb-24 md:pb-8">
      {/* Realtime Live Update Banner (pops up when admin updates records or sync fires) */}
      {lastSyncNotice && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-blue-950/80 to-slate-900 border border-emerald-500/40 shadow-xl flex items-center justify-between animate-bounceOnce">
          <div className="flex items-center space-x-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div>
              <p className="text-xs sm:text-sm font-semibold text-emerald-300">
                Live Data Synchronized
              </p>
              <p className="text-[11px] text-slate-300">{lastSyncNotice}</p>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-200 border border-emerald-700/50">
            Realtime
          </span>
        </div>
      )}

      {/* Student Welcome Header Card */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-sky-400 mb-1">
              <GraduationCap className="w-4 h-4" />
              <span>{student.course} • {student.branch}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-['Outfit']">
              {student.student_name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="px-2.5 py-1 rounded-md bg-slate-800/80 text-slate-200 text-xs font-mono font-medium border border-slate-700">
                CU ID: {student.cu_id}
              </span>
              {student.roll_number && (
                <span className="px-2.5 py-1 rounded-md bg-slate-800/80 text-sky-300 text-xs font-mono font-medium border border-slate-700">
                  Roll No: {student.roll_number}
                </span>
              )}
              {student.father_name && (
                <span className="px-2.5 py-1 rounded-md bg-slate-800/80 text-slate-300 text-xs font-medium border border-slate-700">
                  Father: {student.father_name}
                </span>
              )}
              <span className="px-2.5 py-1 rounded-md bg-slate-800/80 text-slate-300 text-xs font-medium border border-slate-700">
                Sem {student.semester} • Sec {student.section}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-400 self-start sm:self-auto bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Updated: {formattedDate}</span>
          </div>
        </div>
      </div>

      {/* Main Attendance KPI Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Ring Meter */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 sm:p-8 border border-slate-800 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white font-['Outfit']">Overall Attendance Standing</h2>
              <p className="text-xs text-slate-400">Calculated across verified sessions</p>
            </div>
            <span
              className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                isSafe
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                  : isWarning
                  ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                  : 'bg-rose-950/60 text-rose-300 border-rose-800/60'
              }`}
            >
              {isSafe ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Good Standing (≥75%)</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{isWarning ? 'Attendance Warning' : 'Defaulter Alert (<75%)'}</span>
                </>
              )}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-around py-4 gap-6">
            {/* SVG Progress Ring */}
            <div className="relative flex items-center justify-center">
              <svg className="w-44 h-44 transform -rotate-90">
                {/* Background Ring */}
                <circle
                  cx="88"
                  cy="88"
                  r={radius}
                  className="stroke-slate-800"
                  strokeWidth="12"
                  fill="transparent"
                />
                {/* Value Ring */}
                <circle
                  cx="88"
                  cy="88"
                  r={radius}
                  className={`progress-ring__circle ${getStatusColor()}`}
                  strokeWidth="12"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-4xl font-extrabold text-white tracking-tight font-['Outfit']">
                  {percentage}%
                </span>
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  Overall
                </span>
              </div>
            </div>

            {/* Session Breakdown Metrics */}
            <div className="grid grid-cols-2 gap-4 w-full sm:w-auto sm:min-w-[240px]">
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  <span>Total Classes</span>
                </div>
                <p className="text-2xl font-bold text-white font-mono">{student.total_sessions}</p>
                <p className="text-[10px] text-slate-500">Scheduled sessions</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <div className="flex items-center space-x-2 text-xs text-emerald-400 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Present</span>
                </div>
                <p className="text-2xl font-bold text-emerald-400 font-mono">{student.present_sessions}</p>
                <p className="text-[10px] text-emerald-500/80">Attended</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <div className="flex items-center space-x-2 text-xs text-rose-400 mb-1">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Absent</span>
                </div>
                <p className="text-2xl font-bold text-rose-400 font-mono">{student.absent_sessions}</p>
                <p className="text-[10px] text-rose-500/80">Missed classes</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-center">
                <button
                  type="button"
                  onClick={triggerCelebration}
                  className="w-full py-2 px-2 bg-gradient-to-r from-blue-600/30 to-indigo-600/30 hover:from-blue-600/50 hover:to-indigo-600/50 border border-blue-500/30 text-sky-300 rounded-lg text-xs font-semibold transition flex items-center justify-center space-x-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Celebrate</span>
                </button>
              </div>
            </div>
          </div>

          {/* Linear Progress Bar for Mobile/Quick Reference */}
          <div className="mt-4 pt-4 border-t border-slate-800/80">
            <div className="flex justify-between text-xs text-slate-400 mb-1.5 font-medium">
              <span>Threshold Requirement: 75%</span>
              <span className={percentage >= 75 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                {percentage >= 75 ? `+${(percentage - 75).toFixed(1)}% Safe Margin` : `-${(75 - percentage).toFixed(1)}% Deficit`}
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden relative">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  isSafe
                    ? 'bg-gradient-to-r from-blue-500 to-emerald-400'
                    : isWarning
                    ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                    : 'bg-gradient-to-r from-rose-600 to-rose-400'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
              />
              {/* 75% marker line */}
              <div className="absolute top-0 bottom-0 left-[75%] w-0.5 bg-white/40 shadow" />
            </div>
          </div>
        </div>

        {/* Quick Navigation Cards */}
        <div className="space-y-4 flex flex-col justify-between">
          <div
            onClick={() => onNavigateTab('attendance')}
            className="glass-card glass-card-interactive rounded-2xl p-5 border border-slate-800 cursor-pointer flex-1 flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-blue-950 text-blue-400 flex items-center justify-center border border-blue-800/60">
                <Calendar className="w-5 h-5" />
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500" />
            </div>
            <div className="mt-4">
              <h3 className="text-base font-bold text-white font-['Outfit']">Last 5 Days Attendance</h3>
              <p className="text-xs text-slate-400 mt-1">
                View day-by-day session breakdowns, subject totals, and present/absent status indicators.
              </p>
            </div>
            <div className="mt-3 flex items-center text-xs font-semibold text-blue-400">
              <span>Inspect Daily Log</span>
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>

          <div
            onClick={() => onNavigateTab('assignments')}
            className="glass-card glass-card-interactive rounded-2xl p-5 border border-slate-800 cursor-pointer flex-1 flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-indigo-950 text-indigo-400 flex items-center justify-center border border-indigo-800/60">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500" />
            </div>
            <div className="mt-4">
              <h3 className="text-base font-bold text-white font-['Outfit']">Special Assignments</h3>
              <p className="text-xs text-slate-400 mt-1">
                Track submission status, pending requirements, verified faculty remarks, and upcoming deadlines.
              </p>
            </div>
            <div className="mt-3 flex items-center text-xs font-semibold text-indigo-400">
              <span>View Assignments Tracker</span>
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
