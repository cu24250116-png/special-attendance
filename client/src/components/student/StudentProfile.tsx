import React from 'react';
import { Student } from '../../types';
import { User, Mail, Phone, BookOpen, ShieldAlert, Award, FileText, CheckCircle2 } from 'lucide-react';

interface StudentProfileProps {
  student: Student;
}

export const StudentProfile: React.FC<StudentProfileProps> = ({ student }) => {
  return (
    <div className="space-y-6 animate-fadeIn pb-24 md:pb-8">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 p-0.5 flex items-center justify-center">
            <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
              <User className="w-7 h-7 text-sky-400" />
            </div>
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white font-['Outfit']">
              {student.student_name}
            </h2>
            <p className="text-xs text-slate-400 font-mono">CU ID: {student.cu_id}</p>
          </div>
        </div>
      </div>

      {/* Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Academic Details */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-sky-400 font-mono flex items-center space-x-2">
            <BookOpen className="w-4 h-4" />
            <span>Academic Enrollment</span>
          </h3>

          <div className="space-y-3 text-xs divide-y divide-slate-800/80">
            <div className="pt-2 flex justify-between">
              <span className="text-slate-400">Roll Number</span>
              <span className="font-semibold text-sky-400 font-mono">{student.roll_number || '—'}</span>
            </div>
            <div className="pt-2 flex justify-between">
              <span className="text-slate-400">Father's Name</span>
              <span className="font-semibold text-white">{student.father_name || '—'}</span>
            </div>
            <div className="pt-2 flex justify-between">
              <span className="text-slate-400">Course / Program</span>
              <span className="font-semibold text-white">{student.course}</span>
            </div>
            <div className="pt-2 flex justify-between">
              <span className="text-slate-400">Current Semester</span>
              <span className="font-semibold text-white">Semester {student.semester}</span>
            </div>
            <div className="pt-2 flex justify-between">
              <span className="text-slate-400">Class Section</span>
              <span className="font-semibold text-white">Section {student.section}</span>
            </div>
          </div>
        </div>

        {/* Official College Regulations */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 font-mono flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4" />
            <span>Academic Regulations</span>
          </h3>

          <div className="space-y-2.5 text-xs text-slate-300">
            <div className="flex items-start space-x-2 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>
                <strong>75% Mandatory Attendance:</strong> Under college statutes, students must maintain at least 75% verified attendance to be eligible for end-semester examinations.
              </span>
            </div>

            <div className="flex items-start space-x-2 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Special Assignments:</strong> All special assignment tasks must be submitted prior to the stipulated cutoff to be counted towards internal continuous assessment.
              </span>
            </div>

            <div className="flex items-start space-x-2 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Data Synchronization:</strong> All attendance sessions and assignment marks are updated directly by course coordinators via central master Excel sheets.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
