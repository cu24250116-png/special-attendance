import React, { useEffect, useState } from 'react';
import { Assignment } from '../../types';
import { api } from '../../services/api';
import {
  FileCheck2,
  Clock,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  BookOpen,
  MessageSquareQuote,
  ShieldCheck,
  Check
} from 'lucide-react';

interface StudentAssignmentsProps {
  cuId: string;
}

export const StudentAssignments: React.FC<StudentAssignmentsProps> = ({ cuId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [stats, setStats] = useState({
    totalSpecialAssignments: 0,
    submittedCount: 0,
    pendingCount: 0,
    lateCount: 0,
    naCount: 0,
  });

  const fetchAssignments = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getStudentAssignments(cuId);
      setAssignments(data.assignments || []);
      setStats({
        totalSpecialAssignments: data.totalSpecialAssignments,
        submittedCount: data.submittedCount,
        pendingCount: data.pendingCount,
        lateCount: data.lateCount,
        naCount: data.naCount,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load special assignments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [cuId]);

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('submit')) {
      return (
        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Submitted</span>
        </span>
      );
    }
    if (s.includes('late')) {
      return (
        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-950/60 text-rose-300 border border-rose-800/60">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Late Submission</span>
        </span>
      );
    }
    if (s.includes('na') || s.includes('not')) {
      return (
        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
          <span>Not Applicable</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/60">
        <Clock className="w-3.5 h-3.5" />
        <span>Pending Submission</span>
      </span>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse pb-24 md:pb-8">
        <div className="h-28 bg-slate-800/60 rounded-2xl" />
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
          onClick={fetchAssignments}
          className="mt-4 px-4 py-2 bg-red-900/60 hover:bg-red-900 text-red-100 rounded-xl text-xs font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-24 md:pb-8">
      {/* Header & Stats Banner */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1">
              <FileCheck2 className="w-4 h-4" />
              <span>Special Evaluation Tracking</span>
            </div>
            <h2 className="text-2xl font-bold text-white font-['Outfit']">Special Assignments</h2>
            <p className="text-xs text-slate-400 mt-1">
              Mandatory project submissions and coursework evaluations recorded by faculty.
            </p>
          </div>
        </div>

        {/* 4 Stat KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-xs text-slate-400">Total Assignments</span>
            <p className="text-2xl font-bold text-white font-mono mt-0.5">
              {stats.totalSpecialAssignments}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40">
            <span className="text-xs text-emerald-400 flex items-center space-x-1">
              <Check className="w-3 h-3" />
              <span>Submitted</span>
            </span>
            <p className="text-2xl font-bold text-emerald-300 font-mono mt-0.5">
              {stats.submittedCount}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/40">
            <span className="text-xs text-amber-400 flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>Pending</span>
            </span>
            <p className="text-2xl font-bold text-amber-300 font-mono mt-0.5">
              {stats.pendingCount}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-800/40">
            <span className="text-xs text-rose-400 flex items-center space-x-1">
              <AlertTriangle className="w-3 h-3" />
              <span>Late</span>
            </span>
            <p className="text-2xl font-bold text-rose-300 font-mono mt-0.5">
              {stats.lateCount}
            </p>
          </div>
        </div>
      </div>

      {/* Assignment List */}
      {assignments.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center border border-slate-800">
          <FileCheck2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No Special Assignments Listed</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            No special assignment obligations are registered under your CU ID at this time.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((asn) => (
            <div
              key={asn.id}
              className="glass-panel rounded-2xl p-5 sm:p-6 border border-slate-800 hover:border-slate-700 transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-900/60 text-blue-300 border border-blue-700/50">
                      {asn.assignment_id}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">{asn.subject}</span>
                  </div>
                  <h3 className="text-base font-bold text-white font-['Outfit'] pt-1">
                    {asn.assignment_name}
                  </h3>
                </div>

                <div className="self-start sm:self-auto">
                  {getStatusBadge(asn.submission_status)}
                </div>
              </div>

              {/* Deadline & Submission timestamps */}
              <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex items-center space-x-2 text-slate-400">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span>
                    Deadline:{' '}
                    <strong className="text-slate-200 font-medium">
                      {asn.submission_deadline || 'Not Specified'}
                    </strong>
                  </span>
                </div>

                {asn.submission_date && (
                  <div className="flex items-center space-x-2 text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      Submitted On:{' '}
                      <strong className="text-emerald-300 font-medium">
                        {asn.submission_date}
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Faculty Remarks */}
              {asn.remarks && (
                <div className="mt-3 p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs flex items-start space-x-2.5">
                  <MessageSquareQuote className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-300">Faculty Remarks: </span>
                    <span className="text-slate-400">{asn.remarks}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
