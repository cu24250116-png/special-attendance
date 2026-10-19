import React, { useState, useEffect } from 'react';
import { Student, SpecialClassAttendance, AdminMessage } from '../../types';
import { api } from '../../services/api';
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
  ChevronLeft,
  TrendingUp,
  GraduationCap,
  BookOpen,
  Download,
  Megaphone,
  Bell,
  X,
  RefreshCw
} from 'lucide-react';

import confetti from 'canvas-confetti';

interface StudentDashboardProps {
  student: Student;
  onNavigateTab: (tab: 'attendance' | 'assignments' | 'profile') => void;
  lastSyncNotice: string | null;
  onRefreshStudent?: () => Promise<void>;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  student,
  onNavigateTab,
  lastSyncNotice,
  onRefreshStudent,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [specialAttendance, setSpecialAttendance] = useState<SpecialClassAttendance | null>(
    student.special_class_attendance || null
  );
  const [displayLastUpdated, setDisplayLastUpdated] = useState<string>(
    student.last_updated || ''
  );
  const [latestFileName, setLatestFileName] = useState<string>('');

  // Synchronize specialAttendance and displayLastUpdated whenever student prop updates
  useEffect(() => {
    if (student.special_class_attendance) {
      setSpecialAttendance(student.special_class_attendance);
    }
    if (student.last_updated) {
      setDisplayLastUpdated(prev => {
        if (!prev) return student.last_updated;
        return new Date(student.last_updated) > new Date(prev) ? student.last_updated : prev;
      });
    }
  }, [student.special_class_attendance, student.last_updated]);

  // Admin / HOD Broadcast Messages State
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [seenNoticeIds, setSeenNoticeIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('seen_admin_notice_ids') || '[]');
    } catch {
      return [];
    }
  });
  const [activeNoticeIdx, setActiveNoticeIdx] = useState(0);
  const [showNoticePopup, setShowNoticePopup] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchFreshData = async () => {
      try {
        const [attRes, profRes] = await Promise.all([
          api.getStudentAttendance(student.cu_id).catch(() => null),
          api.getStudentProfile(student.cu_id).catch(() => null),
        ]);
        if (!mounted) return;
        if (attRes?.specialClassAttendance) {
          setSpecialAttendance(attRes.specialClassAttendance);
        }
        const candidates = [
          attRes?.lastUpdated,
          attRes?.latestImport?.created_at,
          profRes?.student?.last_updated,
          profRes?.latestImport?.created_at,
          student.last_updated,
        ].filter(Boolean) as string[];

        if (candidates.length > 0) {
          candidates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
          setDisplayLastUpdated(candidates[0]);
        }
        const filename = attRes?.latestImport?.filename || profRes?.latestImport?.filename;
        if (filename) {
          setLatestFileName(filename);
        }
      } catch (e) {}
    };

    fetchFreshData();

    // Fetch messages for this student's department or all
    api.getStudentMessages(student.cu_id)
      .then(res => {
        if (mounted && res.messages) {
          setMessages(res.messages);
        }
      })
      .catch(() => {});

    // Real-time listener for live broadcast notices from Admin / HOD
    const handleLiveNotice = (e: any) => {
      const newNotice = e.detail;
      if (
        newNotice &&
        (newNotice.target_type === 'all' ||
          newNotice.target_value === student.branch ||
          newNotice.target_value === student.course)
      ) {
        setMessages(prev => [newNotice, ...prev.filter(m => m.id !== newNotice.id)]);
        setShowNoticePopup(true);
      }
    };

    // Live update when new Excel is uploaded or attendance is committed by admin
    const handleLiveCollegeUpdate = () => {
      if (onRefreshStudent) onRefreshStudent();
      fetchFreshData();
    };

    const handleResumeOrFocus = () => {
      if (document.visibilityState === 'visible') {
        if (onRefreshStudent) onRefreshStudent();
        fetchFreshData();
      }
    };

    window.addEventListener('college_admin_message', handleLiveNotice);
    window.addEventListener('college_data_updated', handleLiveCollegeUpdate);
    window.addEventListener('visibilitychange', handleResumeOrFocus);
    window.addEventListener('focus', handleResumeOrFocus);
    window.addEventListener('online', handleResumeOrFocus);
    document.addEventListener('resume', handleResumeOrFocus);

    return () => {
      mounted = false;
      window.removeEventListener('college_admin_message', handleLiveNotice);
      window.removeEventListener('college_data_updated', handleLiveCollegeUpdate);
      window.removeEventListener('visibilitychange', handleResumeOrFocus);
      window.removeEventListener('focus', handleResumeOrFocus);
      window.removeEventListener('online', handleResumeOrFocus);
      document.removeEventListener('resume', handleResumeOrFocus);
    };
  }, [student.cu_id, student.branch, student.course, student.last_updated, lastSyncNotice]);

  const unreadNotices = messages.filter(m => !seenNoticeIds.includes(m.id));
  const currentNotice = unreadNotices[activeNoticeIdx] || unreadNotices[0];

  const handleMarkNoticeAsSeen = (id: string) => {
    const updated = [...seenNoticeIds, id];
    setSeenNoticeIds(updated);
    try {
      localStorage.setItem('seen_admin_notice_ids', JSON.stringify(updated));
    } catch {}
    if (activeNoticeIdx >= unreadNotices.length - 1) {
      setActiveNoticeIdx(0);
    }
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (onRefreshStudent) {
        await onRefreshStudent();
      }
      const [attRes, profRes] = await Promise.all([
        api.getStudentAttendance(student.cu_id).catch(() => null),
        api.getStudentProfile(student.cu_id).catch(() => null),
      ]);
      if (attRes?.specialClassAttendance) {
        setSpecialAttendance(attRes.specialClassAttendance);
      }
      const candidates = [
        attRes?.lastUpdated,
        attRes?.latestImport?.created_at,
        profRes?.student?.last_updated,
        profRes?.latestImport?.created_at,
        student.last_updated,
      ].filter(Boolean) as string[];

      if (candidates.length > 0) {
        candidates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        setDisplayLastUpdated(candidates[0]);
      }
      const filename = attRes?.latestImport?.filename || profRes?.latestImport?.filename;
      if (filename) {
        setLatestFileName(filename);
      }
    } catch (e) {
      console.error('Refresh error:', e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const percentage = Math.round(student.overall_percentage * 10) / 10;
  const isSafe = percentage >= 75;
  const isWarning = percentage >= 65 && percentage < 75;

  // Special Class Attendance derived metrics - purely dynamic from imported dataset
  const totalSpecialDates = specialAttendance?.totalSpecialDates ?? (specialAttendance?.specialDates?.length || 0);
  const weightPerDay = specialAttendance?.weightPerDay ?? (totalSpecialDates > 0 ? Math.round((100 / totalSpecialDates) * 100) / 100 : 0);
  const uploadedCount = specialAttendance?.uploadedCount ?? 0;
  const specialPct = specialAttendance?.specialAttendancePercentage ?? (totalSpecialDates > 0 ? Math.min(100, Math.round((uploadedCount * weightPerDay) * 10) / 10) : 0);
  const pendingCount = specialAttendance?.pendingCount ?? Math.max(0, totalSpecialDates - uploadedCount);

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

  const effectiveDate = displayLastUpdated || student.last_updated;
  const formattedDate = effectiveDate
    ? new Date(effectiveDate).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
      })
    : 'Just now';

  return (
    <div className="w-full max-w-full space-y-5 animate-fadeIn pb-24 md:pb-8 overflow-x-hidden">
      {/* Realtime Live Update Banner */}
      {lastSyncNotice && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-950/90 via-blue-950/80 to-slate-900 border border-emerald-500/50 shadow-xl flex items-center justify-between animate-bounceOnce">
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            <span className="relative flex h-3 w-3 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-emerald-300 truncate">
                Live Data Synchronized
              </p>
              <p className="text-[10px] sm:text-[11px] text-slate-300 truncate">{lastSyncNotice}</p>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/70 text-emerald-200 border border-emerald-700/60 flex-shrink-0">
            Live
          </span>
        </div>
      )}

      {/* Student Welcome Header Card - Vibrant College Profile */}
      <div className="w-full rounded-2xl p-5 sm:p-7 relative overflow-hidden bg-gradient-to-br from-indigo-950/60 via-slate-900/90 to-blue-950/60 border border-indigo-500/30 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-purple-500/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 text-sky-300 border border-blue-400/30 text-[11px] font-semibold uppercase tracking-wider mb-2">
              <GraduationCap className="w-3.5 h-3.5 text-sky-400" />
              <span>{student.course} • {student.branch}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-['Outfit'] drop-shadow-sm">
              {student.student_name}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2.5">
              <span className="px-2.5 py-1 rounded-lg bg-indigo-950/80 text-indigo-200 text-xs font-mono font-semibold border border-indigo-700/60 shadow-sm">
                CU ID: {student.cu_id}
              </span>
              {student.roll_number && (
                <span className="px-2.5 py-1 rounded-lg bg-sky-950/80 text-sky-300 text-xs font-mono font-medium border border-sky-700/60 shadow-sm">
                  Roll: {student.roll_number}
                </span>
              )}
              {student.father_name && (
                <span className="px-2.5 py-1 rounded-lg bg-slate-900/90 text-slate-200 text-xs font-medium border border-slate-700">
                  Father: {student.father_name}
                </span>
              )}
              <span className="px-2.5 py-1 rounded-lg bg-purple-950/70 text-purple-200 text-xs font-medium border border-purple-700/50">
                Sem {student.semester} • Sec {student.section}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => api.downloadAttendanceSlip(student)}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-950/50 transition active:scale-95 group"
              title="Download official college attendance and clearance slip"
            >
              <Download className="w-3.5 h-3.5 text-emerald-100 group-hover:-translate-y-0.5 transition-transform" />
              <span>Download Attendance Slip</span>
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center space-x-1.5 text-[11px] text-slate-300 hover:text-white bg-slate-900/90 hover:bg-slate-800 px-3 py-2 rounded-xl border border-slate-700/70 shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-75"
              title={effectiveDate ? `Latest college attendance update: ${new Date(effectiveDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST${latestFileName ? ` (${latestFileName})` : ''}` : 'Click to check for latest attendance updates from college'}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : `Updated: ${formattedDate}`}</span>
            </button>
          </div>
        </div>
      </div>


      {/* Main Attendance KPI Card - Luminous, Colorful, Light-infused Aesthetic */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 w-full">
        {/* Attendance Ring Meter - Luminous Theme (User: 'overall percentage 45% hai toh thoda sa usko light me banao, colorful banao') */}
        <div className="lg:col-span-2 luminous-gauge-card rounded-2xl p-5 sm:p-7 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle light glow in the center */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-gradient-to-tr from-indigo-500/10 via-sky-500/15 to-rose-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between mb-3 relative z-10">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white font-['Outfit'] flex items-center space-x-2">
                <span>Overall Attendance Standing</span>
              </h2>
              <p className="text-xs text-slate-300">Verified session attendance percentage</p>
            </div>
            <span
              className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold border shadow-sm ${
                isSafe
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/60'
                  : isWarning
                  ? 'bg-amber-950/80 text-amber-300 border-amber-500/60'
                  : 'bg-rose-950/90 text-rose-200 border-rose-500/70'
              }`}
            >
              {isSafe ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Good Standing (≥75%)</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>{isWarning ? 'Warning (65-74%)' : 'Defaulter (<75%)'}</span>
                </>
              )}
            </span>
          </div>

          {/* Luminous Gauge & Metric Grid - Responsive Mobile & Desktop Layout */}
          <div className="flex flex-col sm:flex-row items-center justify-around py-3 gap-6 relative z-10">
            {/* Luminous SVG Progress Ring */}
            <div className="relative flex items-center justify-center flex-shrink-0">
              {/* Soft luminous circular backdrop */}
              <div className="w-40 h-40 sm:w-44 sm:h-44 rounded-full bg-gradient-to-br from-white/10 via-slate-800/60 to-slate-900/90 shadow-2xl flex items-center justify-center border border-white/10">
                <svg className="w-36 h-36 sm:w-40 sm:h-40 transform -rotate-90">
                  {/* Background Track with soft luminous ring */}
                  <circle
                    cx="50%"
                    cy="50%"
                    r={radius}
                    className="stroke-slate-700/60"
                    strokeWidth="11"
                    fill="transparent"
                  />
                  {/* Animated Value Ring with Colorful Gradient Effect */}
                  <circle
                    cx="50%"
                    cy="50%"
                    r={radius}
                    className={`progress-ring__circle ${
                      isSafe
                        ? 'stroke-emerald-400 text-emerald-400'
                        : isWarning
                        ? 'stroke-amber-400 text-amber-400'
                        : 'stroke-rose-500 text-rose-500'
                    }`}
                    strokeWidth="11"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>

                {/* Inner Luminous Center Display */}
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-3xl sm:text-4xl font-black text-white tracking-tight font-['Outfit'] drop-shadow-md">
                    {percentage}%
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-0.5 ${
                    isSafe ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                  }`}>
                    {isSafe ? 'Above Target' : 'Deficit (<75%)'}
                  </span>
                </div>
              </div>
            </div>

            {/* 4 Colorful Session Metric Cards (2x2 Grid) */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 w-full sm:max-w-xs">
              {/* Total Classes */}
              <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/30 shadow-sm">
                <div className="flex items-center space-x-1.5 text-xs text-blue-300 mb-1">
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                  <span className="font-medium">Total Classes</span>
                </div>
                <p className="text-2xl font-black text-white font-mono">{student.total_sessions}</p>
                <p className="text-[10px] text-blue-300/80">Scheduled</p>
              </div>

              {/* Present Sessions */}
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 shadow-sm">
                <div className="flex items-center space-x-1.5 text-xs text-emerald-300 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-medium">Present</span>
                </div>
                <p className="text-2xl font-black text-emerald-300 font-mono">{student.present_sessions}</p>
                <p className="text-[10px] text-emerald-400/80">Attended</p>
              </div>

              {/* Absent Sessions */}
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 shadow-sm">
                <div className="flex items-center space-x-1.5 text-xs text-rose-300 mb-1">
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span className="font-medium">Absent</span>
                </div>
                <p className="text-2xl font-black text-rose-300 font-mono">{student.absent_sessions}</p>
                <p className="text-[10px] text-rose-400/80">Missed</p>
              </div>

              {/* Celebrate / Confetti Action */}
              <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-950/50 to-purple-950/50 border border-indigo-500/40 flex flex-col justify-center">
                <button
                  type="button"
                  onClick={triggerCelebration}
                  className="w-full py-1.5 px-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold transition shadow flex items-center justify-center space-x-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                  <span>Celebrate</span>
                </button>
                <span className="text-[9px] text-indigo-300 text-center mt-1">Tap to blast</span>
              </div>
            </div>
          </div>

          {/* Linear Progress Bar with Color Gradients */}
          <div className="mt-3 pt-3 border-t border-slate-700/60 relative z-10">
            <div className="flex justify-between text-xs text-slate-300 mb-1.5 font-medium">
              <span>Required: <strong>75%</strong></span>
              <span className={percentage >= 75 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {percentage >= 75 ? `+${(percentage - 75).toFixed(1)}% Safe` : `-${(75 - percentage).toFixed(1)}% Below Target`}
              </span>
            </div>
            <div className="w-full h-3 bg-slate-800/90 rounded-full overflow-hidden relative border border-slate-700/60">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  isSafe
                    ? 'bg-gradient-to-r from-blue-500 via-sky-400 to-emerald-400'
                    : isWarning
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                    : 'bg-gradient-to-r from-rose-600 to-orange-400'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
              />
              <div className="absolute top-0 bottom-0 left-[75%] w-0.5 bg-white shadow-lg" title="75% Target Line" />
            </div>
          </div>
        </div>

        {/* Quick Navigation Cards */}
        <div className="space-y-3.5 flex flex-col justify-between">
          <div
            onClick={() => onNavigateTab('attendance')}
            className="glass-card glass-card-interactive rounded-2xl p-5 border border-indigo-900/40 cursor-pointer flex-1 flex flex-col justify-between hover:border-indigo-500/50"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-sky-400 flex items-center justify-center border border-blue-500/40">
                <Calendar className="w-5 h-5" />
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </div>
            <div className="mt-3">
              <h3 className="text-base font-bold text-white font-['Outfit']">Special Dates Attendance</h3>
              <p className="text-xs text-slate-300 mt-1">
                Inspect daily attendance logs, exam dates timeline, and assignments uploaded on each date.
              </p>
            </div>
            <div className="mt-3 flex items-center text-xs font-semibold text-sky-400">
              <span>Inspect Daily Log</span>
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>

          <div
            onClick={() => onNavigateTab('assignments')}
            className="glass-card glass-card-interactive rounded-2xl p-5 border border-purple-900/40 cursor-pointer flex-1 flex flex-col justify-between hover:border-purple-500/50"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center border border-purple-500/40">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </div>
            <div className="mt-3">
              <h3 className="text-base font-bold text-white font-['Outfit']">Special Assignments</h3>
              <p className="text-xs text-slate-300 mt-1">
                Track {totalSpecialDates} special assignments and verify your submission clearance.
              </p>
            </div>
            <div className="mt-3 flex items-center text-xs font-semibold text-purple-400">
              <span>View Assignments Tracker</span>
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>
        </div>
      </div>

      {/* Attendance for Special Class Card - Vibrant Stepped Attendance Module */}
      <div className="w-full rounded-2xl p-5 sm:p-7 border border-indigo-500/30 relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950/60 to-purple-950/40 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div>
            <div className="inline-flex items-center space-x-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-1">
              <Award className="w-4 h-4 text-indigo-400" />
              <span>Special Classes & Exam Dates Attendance</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white font-['Outfit'] flex flex-wrap items-center gap-2">
              <span>Attendance for Special Classes</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/40 font-sans font-semibold">
                {uploadedCount} of {totalSpecialDates} Classes Attended
              </span>
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Special class attendance recorded across {totalSpecialDates} scheduled dates (<strong className="text-indigo-300">1 = Present, 0 = Absent</strong>).
            </p>
          </div>

          <div className="flex items-center space-x-3 self-start sm:self-auto bg-slate-900/90 px-4 py-2.5 rounded-2xl border border-indigo-500/40 shadow-inner">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-slate-300 font-medium">
                Classes Status
              </div>
              <div className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-sky-300 font-mono">
                {uploadedCount} / {totalSpecialDates}
              </div>
            </div>
            <div className={`p-2.5 rounded-xl ${uploadedCount >= totalSpecialDates && totalSpecialDates > 0 ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50' : 'bg-indigo-950/80 text-indigo-300 border border-indigo-500/50'}`}>
              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>

        {/* 3 Clean KPI Cards: Total Exam Dates, Uploaded, Pending (User Requirement) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 mb-5">
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80">
            <span className="text-[11px] text-slate-300">Total Exam Dates</span>
            <p className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">{totalSpecialDates}</p>
            <p className="text-[10px] text-slate-400">Scheduled Exam Dates</p>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40">
            <span className="text-[11px] text-emerald-300 flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Uploaded / Present</span>
            </span>
            <p className="text-xl sm:text-2xl font-black text-emerald-300 font-mono mt-0.5">
              {uploadedCount} <span className="text-xs text-emerald-400/80 font-sans">/ {totalSpecialDates}</span>
            </p>
            <p className="text-[10px] text-emerald-300/80">Submitted & Present (1)</p>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40">
            <span className="text-[11px] text-amber-300 flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Pending / Absent</span>
            </span>
            <p className="text-xl sm:text-2xl font-black text-amber-300 font-mono mt-0.5">{pendingCount}</p>
            <p className="text-[10px] text-amber-300/80">Awaiting Submission (0)</p>
          </div>
        </div>

        {/* Stepped Progress Tracker - Number of classes present, step advances 1 by 1 (Exact User Requirement) */}
        <div className="space-y-2.5 mb-5 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs">
            <span className="font-bold text-white flex items-center space-x-1.5">
              <Award className="w-4 h-4 text-emerald-400" />
              <span>Classes Attended: Step <strong className="text-emerald-300 font-mono text-sm">{uploadedCount}</strong> of <span className="font-mono">{totalSpecialDates}</span></span>
            </span>
            <span className="text-slate-300 font-medium">
              Progress: <strong className={uploadedCount === totalSpecialDates && totalSpecialDates > 0 ? 'text-emerald-400' : 'text-sky-300'}>{uploadedCount} Present</strong> ({pendingCount} Pending)
            </span>
          </div>

          {/* Stepped Visual Step Bar */}
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 pt-1">
            {Array.from({ length: totalSpecialDates || 8 }).map((_, i) => {
              const stepNumber = i + 1;
              const isCompleted = stepNumber <= uploadedCount;
              return (
                <div
                  key={stepNumber}
                  className={`py-2 px-1 rounded-lg text-center transition-all border flex flex-col items-center justify-center ${
                    isCompleted
                      ? 'bg-gradient-to-b from-emerald-600/30 to-teal-800/40 border-emerald-500/60 text-emerald-200 shadow-sm shadow-emerald-950'
                      : 'bg-slate-900/60 border-slate-800 text-slate-500'
                  }`}
                >
                  <span className="text-[10px] font-mono font-bold leading-none">STEP {stepNumber}</span>
                  <div className="mt-1 flex items-center justify-center">
                    {isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <span className="text-[10px] text-slate-500 font-mono">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Track Bar */}
          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800 mt-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-500 via-emerald-500 to-sky-400 transition-all duration-700"
              style={{ width: `${totalSpecialDates > 0 ? (uploadedCount / totalSpecialDates) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Special Exam Dates Interactive Timeline Grid (Clean 2-col on mobile, 4-col on tablet, 8-col on desktop) */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>Special Exam Dates Log ({totalSpecialDates} Dates)</span>
            </h3>
            <span className="text-[11px] text-slate-400">
              1 = Present • 0 = Absent
            </span>
          </div>

          {specialAttendance?.specialDates && specialAttendance.specialDates.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 w-full">
              {specialAttendance.specialDates.map((item, idx) => (
                <div
                  key={item.date || idx}
                  className={`p-2.5 sm:p-3 rounded-xl border transition flex flex-col justify-between ${
                    item.isUploaded
                      ? 'bg-emerald-950/40 border-emerald-500/50 hover:border-emerald-400'
                      : 'bg-rose-950/30 border-rose-500/40 hover:border-rose-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono font-bold uppercase text-slate-300">
                      Day {idx + 1}
                    </span>
                    {item.isUploaded ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-rose-400" />
                    )}
                  </div>

                  <div className="font-bold text-white text-xs font-['Outfit'] mb-1 truncate">
                    {item.formattedDate || item.date}
                  </div>

                  <div className="mt-1 pt-1.5 border-t border-slate-700/60 text-[10px] flex items-center justify-between">
                    <span className={item.isUploaded ? 'text-emerald-300 font-semibold' : 'text-rose-300 font-medium'}>
                      {item.isUploaded ? 'Present (1)' : 'Absent (0)'}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase font-mono ${
                      item.isUploaded
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}>
                      {item.isUploaded ? 'Attended' : 'Pending'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 text-xs">
              No special class attendance dates recorded yet.
            </div>
          )}
        </div>

        <div className="mt-4 pt-3.5 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-300">
            Recorded directly from official attendance dataset (<strong className="text-white">1 = Present, 0 = Absent</strong>).
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('assignments')}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600/40 hover:bg-indigo-600/60 border border-indigo-400/50 text-indigo-100 text-xs font-semibold flex items-center space-x-1.5 transition"
          >
            <span>Track Special Assignments</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Floating Notification Popup: "Message from Admin" / "Message from HOD" (Exact User Voice Requirement) */}
      {currentNotice && showNoticePopup && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-50 animate-slideUp">
          <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-indigo-500/50 bg-slate-900/98 shadow-2xl backdrop-blur-2xl relative overflow-hidden ring-1 ring-white/10">
            {/* Glow backdrop */}
            <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-indigo-500/20 via-purple-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />

            {/* Header with Title */}
            <div className="flex items-start justify-between gap-3 mb-2.5 relative">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-600/30">
                  <Megaphone className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white font-['Outfit'] flex items-center gap-1.5">
                    <span>{currentNotice.sender_title || 'Message from Admin'}</span>
                    {currentNotice.priority === 'urgent' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold uppercase tracking-wider">
                        Urgent
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-slate-400 flex items-center space-x-1 mt-0.5">
                    <span>
                      {new Date(currentNotice.created_at).toLocaleDateString()} at{' '}
                      {new Date(currentNotice.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {currentNotice.target_type === 'department' && (
                      <span className="text-sky-300 font-medium truncate max-w-[150px]" title={currentNotice.target_value || ''}>
                        • {currentNotice.target_value}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleMarkNoticeAsSeen(currentNotice.id)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Notice Message Body */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap max-h-48 overflow-y-auto">
              {currentNotice.message}
            </div>

            {/* Footer Navigation & Mark Seen */}
            <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-800/60">
              <span className="text-[11px] text-slate-400 font-mono">
                Notice {activeNoticeIdx + 1} of {unreadNotices.length}
              </span>
              <div className="flex items-center space-x-2">
                {unreadNotices.length > 1 && (
                  <div className="flex items-center space-x-1 mr-1">
                    <button
                      type="button"
                      onClick={() => setActiveNoticeIdx(prev => (prev > 0 ? prev - 1 : unreadNotices.length - 1))}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      title="Previous notice"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveNoticeIdx(prev => (prev < unreadNotices.length - 1 ? prev + 1 : 0))}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      title="Next notice"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleMarkNoticeAsSeen(currentNotice.id)}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-indigo-600/30 transition active:scale-95"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark as Seen</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
