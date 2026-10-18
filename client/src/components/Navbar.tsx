import React from 'react';
import { GraduationCap, ShieldCheck, UserCheck, RefreshCw, LogOut, Radio, BookOpen, Smartphone } from 'lucide-react';
import { api, isNativeApp } from '../services/api';


interface NavbarProps {
  currentView: 'student' | 'admin';
  onSwitchView: (view: 'student' | 'admin') => void;
  isRealtimeConnected: boolean;
  studentCuId: string | null;
  adminUser: any | null;
  onStudentLogout: () => void;
  onAdminLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onSwitchView,
  isRealtimeConnected,
  studentCuId,
  adminUser,
  onStudentLogout,
  onAdminLogout,
}) => {
  return (
    <header className="sticky top-0 z-50 w-full max-w-full bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-md overflow-hidden">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
          {/* Logo & College Title */}
          <div
            className="flex items-center space-x-2 sm:space-x-3 cursor-pointer flex-shrink min-w-0"
            onClick={() => onSwitchView('student')}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 p-0.5 shadow-md flex items-center justify-center flex-shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <GraduationCap className="w-4 h-4 sm:w-6 sm:h-6 text-sky-400" />
              </div>
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-base sm:text-lg text-white tracking-tight font-['Outfit'] truncate">
                  CAMPUS<span className="text-sky-400">SYNC</span>
                </span>
                <span className="hidden lg:inline-flex px-1.5 py-0.2 text-[9px] font-semibold bg-blue-900/60 text-blue-300 border border-blue-700/50 rounded-full">
                  ERP
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden md:block truncate">Special Attendance & Assignment</p>
            </div>
          </div>

          {/* Right Action Controls - Ultra-compact on mobile */}
          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            {/* Live Sync Status Indicator */}
            <div
              className={`flex items-center space-x-1 px-2 py-1 rounded-full text-[10px] sm:text-xs font-medium border ${
                isRealtimeConnected
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50'
                  : 'bg-amber-950/60 text-amber-300 border-amber-800/50'
              }`}
              title={isRealtimeConnected ? 'Real-Time Sync Active' : 'Connecting stream...'}
            >
              <span
                className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                  isRealtimeConnected ? 'bg-emerald-400 live-indicator' : 'bg-amber-400 animate-pulse'
                }`}
              />
              <span className="hidden sm:inline">{isRealtimeConnected ? 'Live' : 'Sync'}</span>
            </div>

            {/* Download APK - Compact icon button on mobile, only shown in browser */}
            {!isNativeApp() ? (
              <a
                href={api.downloadApkUrl}
                download="SpecialAttendance.apk"
                className="flex items-center space-x-1 p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-semibold bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-700/60 transition shadow-sm"
                title="Download Android APK"
              >
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden md:inline text-[11px]">APK</span>
              </a>
            ) : (
              <span className="hidden sm:inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                <Smartphone className="w-3 h-3 text-emerald-400" />
                <span>v1.0</span>
              </span>
            )}


            {/* View Switcher Toggle */}
            <div className="flex p-0.5 bg-slate-950/90 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => onSwitchView('student')}
                className={`flex items-center space-x-1 px-2 py-1 rounded-md text-[11px] sm:text-xs font-medium transition-all ${
                  currentView === 'student'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Student Panel"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Student</span>
              </button>

              <button
                type="button"
                onClick={() => onSwitchView('admin')}
                className={`flex items-center space-x-1 px-2 py-1 rounded-md text-[11px] sm:text-xs font-medium transition-all ${
                  currentView === 'admin'
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Admin Panel"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Admin</span>
              </button>
            </div>

            {/* Logout Buttons */}
            {currentView === 'student' && studentCuId && (
              <button
                type="button"
                onClick={onStudentLogout}
                className="flex items-center p-1.5 sm:px-2 sm:py-1 bg-slate-800/80 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800/60 rounded-lg text-xs transition"
                title="Exit student session"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}

            {currentView === 'admin' && adminUser && (
              <button
                type="button"
                onClick={onAdminLogout}
                className="flex items-center p-1.5 sm:px-2 sm:py-1 bg-slate-800/80 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800/60 rounded-lg text-xs transition"
                title="Sign out administrator"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
