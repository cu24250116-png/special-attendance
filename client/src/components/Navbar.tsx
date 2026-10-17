import React from 'react';
import { GraduationCap, ShieldCheck, UserCheck, RefreshCw, LogOut, Radio, BookOpen } from 'lucide-react';

interface NavbarProps {
  currentView: 'student' | 'admin';
  onSwitchView: (view: 'student' | 'admin') => void;
  isRealtimeConnected: boolean;
  studentCuId: string | null;
  adminUser: any | null;
  onStudentLogout: () => void;
  onAdminLogout: () => void;
  onQuickDemoStudent: (cuId: string) => void;
  onQuickDemoAdmin: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onSwitchView,
  isRealtimeConnected,
  studentCuId,
  adminUser,
  onStudentLogout,
  onAdminLogout,
  onQuickDemoStudent,
  onQuickDemoAdmin,
}) => {
  return (
    <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & College Title */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onSwitchView('student')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-sky-400 p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-sky-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-white tracking-tight font-['Outfit']">
                  CAMPUS<span className="text-sky-400">SYNC</span>
                </span>
                <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-semibold bg-blue-900/60 text-blue-300 border border-blue-700/50 rounded-full">
                  ERP v2.6
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Special Attendance & Assignment Dashboard</p>
            </div>
          </div>

          {/* Center: Live Sync Status Badge */}
          <div className="flex items-center space-x-2">
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                isRealtimeConnected
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50'
                  : 'bg-amber-950/60 text-amber-300 border-amber-800/50'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isRealtimeConnected ? 'bg-emerald-400 live-indicator' : 'bg-amber-400 animate-pulse'
                }`}
              />
              <span className="hidden md:inline">{isRealtimeConnected ? 'Real-Time Sync Active' : 'Connecting Stream...'}</span>
              <span className="md:hidden">{isRealtimeConnected ? 'Live' : 'Sync'}</span>
            </div>
          </div>

          {/* Right: Panel Switcher & Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* View Switcher Toggle */}
            <div className="flex p-1 bg-slate-950/80 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => onSwitchView('student')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  currentView === 'student'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Student</span>
              </button>

              <button
                type="button"
                onClick={() => onSwitchView('admin')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  currentView === 'admin'
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
            </div>

            {/* Admin Quick Login Helper (if not logged in) */}
            {currentView === 'admin' && !adminUser && (
              <button
                type="button"
                onClick={onQuickDemoAdmin}
                className="hidden lg:flex items-center space-x-1 px-2.5 py-1.5 bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-300 border border-indigo-700/40 rounded-lg text-xs font-medium transition"
                title="Log in as College Administrator"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Demo Admin</span>
              </button>
            )}

            {/* Logout Buttons */}
            {currentView === 'student' && studentCuId && (
              <button
                type="button"
                onClick={onStudentLogout}
                className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-800/80 hover:bg-red-950/60 text-slate-300 hover:text-red-300 border border-slate-700 hover:border-red-800/50 rounded-lg text-xs font-medium transition"
                title="Exit student session"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}

            {currentView === 'admin' && adminUser && (
              <button
                type="button"
                onClick={onAdminLogout}
                className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-800/80 hover:bg-red-950/60 text-slate-300 hover:text-red-300 border border-slate-700 hover:border-red-800/50 rounded-lg text-xs font-medium transition"
                title="Sign out administrator"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
