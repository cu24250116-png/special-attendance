import React, { useEffect, useState, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { StudentWelcome } from './components/student/StudentWelcome';
import { StudentDashboard } from './components/student/StudentDashboard';
import { StudentAttendance } from './components/student/StudentAttendance';
import { StudentAssignments } from './components/student/StudentAssignments';
import { StudentProfile } from './components/student/StudentProfile';
import { StudentBottomNav } from './components/student/StudentBottomNav';

import { AdminLogin } from './components/admin/AdminLogin';
import { AdminNavDrawer, AdminTab } from './components/admin/AdminNavDrawer';
import { AdminOverview } from './components/admin/AdminOverview';
import { AdminStudents } from './components/admin/AdminStudents';
import { AdminAttendance } from './components/admin/AdminAttendance';
import { AdminAssignments } from './components/admin/AdminAssignments';
import { AdminExcelImport } from './components/admin/AdminExcelImport';
import { AdminCloudSync } from './components/admin/AdminCloudSync';
import { AdminImportHistory } from './components/admin/AdminImportHistory';
import { AdminSettings } from './components/admin/AdminSettings';
import { AdminMessages } from './components/admin/AdminMessages';
import { AdminUserManagement } from './components/admin/AdminUserManagement';

import { Student } from './types';
import { api, isNativeApp, getApiBase } from './services/api';
import { LayoutDashboard, Calendar, FileCheck2, User, Menu, Lock, AlertCircle } from 'lucide-react';


export function App() {
  const [currentView, setCurrentView] = useState<'student' | 'admin'>('student');
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [lastSyncNotice, setLastSyncNotice] = useState<string | null>(null);

  // Student State
  const [studentCuId, setStudentCuId] = useState<string | null>(() => {
    return localStorage.getItem('college_student_cuid');
  });
  const [studentToken, setStudentToken] = useState<string | null>(() => {
    return localStorage.getItem('college_student_token');
  });
  const [studentData, setStudentData] = useState<Student | null>(null);
  const [studentTab, setStudentTab] = useState<'dashboard' | 'attendance' | 'assignments' | 'profile'>('dashboard');

  // Admin State
  const [adminUser, setAdminUser] = useState<any | null>(() => {
    const saved = localStorage.getItem('college_admin_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    return localStorage.getItem('college_admin_token');
  });
  const [adminTab, setAdminTab] = useState<AdminTab>('overview');
  const [isAdminSidebarCollapsed, setIsAdminSidebarCollapsed] = useState(false);
  const [isAdminMobileDrawerOpen, setIsAdminMobileDrawerOpen] = useState(false);

  // Load student profile if logged in
  const fetchCurrentStudent = async (idToFetch?: string) => {
    const id = idToFetch || studentCuId;
    if (!id) return;
    try {
      const res = await api.getStudentProfile(id);
      setStudentData(res.student);
    } catch (err) {
      console.error('Failed to fetch student profile:', err);
    }
  };

  useEffect(() => {
    if (studentCuId && studentToken) {
      fetchCurrentStudent();
    }
  }, [studentCuId, studentToken]);

  // Realtime Server-Sent Events (SSE) Listener
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    const connectSSE = () => {
      const params = new URLSearchParams();
      if (studentCuId) params.append('cu_id', studentCuId);
      if (adminUser) params.append('role', 'admin');

      const base = getApiBase();
      const streamUrl = `${base}/realtime/stream?${params.toString()}`;

      try {
        eventSource = new EventSource(streamUrl);

        eventSource.addEventListener('connected', () => {
          setIsRealtimeConnected(true);
        });

        // Broadcast when college Excel records are updated
        eventSource.addEventListener('college_data_updated', (event) => {
          try {
            const data = JSON.parse(event.data);
            const time = new Date().toLocaleTimeString();
            setLastSyncNotice(`Latest Excel records synchronized from college server at ${time}`);
            if (studentCuId) {
              fetchCurrentStudent();
            }
          } catch (e) {}
        });

        // Targeted student update (e.g. Admin updates Rahul Raj attendance from 88% to 92%)
        eventSource.addEventListener('student_updated', (event) => {
          try {
            const data = JSON.parse(event.data);
            if (studentCuId && data.cuId === studentCuId.toUpperCase().trim()) {
              const time = new Date().toLocaleTimeString();
              setLastSyncNotice(`Your attendance record was directly updated by college admin at ${time}`);
              if (data.student) {
                setStudentData(data.student);
              } else {
                fetchCurrentStudent();
              }
            }
          } catch (e) {}
        });

        // Broadcast Notice from Admin or HOD
        eventSource.addEventListener('admin_message', (event) => {
          try {
            const data = JSON.parse(event.data);
            window.dispatchEvent(new CustomEvent('college_admin_message', { detail: data }));
          } catch (e) {}
        });

        eventSource.onerror = () => {
          setIsRealtimeConnected(false);
          eventSource?.close();
          reconnectTimeout = setTimeout(connectSSE, 20000);
        };
      } catch (e) {
        setIsRealtimeConnected(false);
        reconnectTimeout = setTimeout(connectSSE, 30000);
      }
    };

    connectSSE();

    // Re-fetch on window focus / app resume to ensure instant fresh data
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && studentCuId) {
        fetchCurrentStudent();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    // Periodic live sync poll every 15 seconds while active
    const pollInterval = setInterval(() => {
      if (studentCuId) {
        fetchCurrentStudent();
      }
    }, 15000);

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      clearInterval(pollInterval);
    };
  }, [studentCuId, adminUser]);

  // Handlers for Student
  const handleStudentLoginSuccess = (cuId: string, token: string, initialStudent?: Student) => {
    setStudentCuId(cuId);
    setStudentToken(token);
    if (initialStudent) {
      setStudentData(initialStudent);
    }
    fetchCurrentStudent(cuId);
  };

  const handleStudentLogout = () => {
    localStorage.removeItem('college_student_cuid');
    localStorage.removeItem('college_student_token');
    setStudentCuId(null);
    setStudentToken(null);
    setStudentData(null);
  };

  // Handlers for Admin
  const handleAdminLoginSuccess = (user: any, token: string) => {
    localStorage.setItem('college_admin_user', JSON.stringify(user));
    localStorage.setItem('college_admin_token', token);
    setAdminUser(user);
    setAdminToken(token);
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('college_admin_user');
    localStorage.removeItem('college_admin_token');
    setAdminUser(null);
    setAdminToken(null);
  };

  // Force change password state (if must_change_password === true)
  const [firstLoginNewPass, setFirstLoginNewPass] = useState('');
  const [firstLoginConfirmPass, setFirstLoginConfirmPass] = useState('');
  const [firstLoginLoading, setFirstLoginLoading] = useState(false);
  const [firstLoginError, setFirstLoginError] = useState<string | null>(null);

  const handleFirstLoginPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstLoginNewPass || firstLoginNewPass.length < 8) {
      setFirstLoginError('Password must be at least 8 characters long.');
      return;
    }
    if (firstLoginNewPass !== firstLoginConfirmPass) {
      setFirstLoginError('Passwords do not match.');
      return;
    }
    setFirstLoginLoading(true);
    setFirstLoginError(null);
    try {
      await api.adminChangePassword({ newPassword: firstLoginNewPass });
      const updatedUser = { ...adminUser, must_change_password: false };
      setAdminUser(updatedUser);
      localStorage.setItem('college_admin_user', JSON.stringify(updatedUser));
      setFirstLoginNewPass('');
      setFirstLoginConfirmPass('');
    } catch (err: any) {
      setFirstLoginError(err.message || 'Failed to update password.');
    } finally {
      setFirstLoginLoading(false);
    }
  };

  const studentNavTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'attendance', label: 'Attendance', icon: Calendar },
    { id: 'assignments', label: 'Assignments', icon: FileCheck2 },
    { id: 'profile', label: 'Profile', icon: User },
  ] as const;

  return (
    <div className="min-h-screen w-full max-w-full flex flex-col bg-slate-950 text-slate-100 selection:bg-indigo-500/30 overflow-x-hidden">
      {/* Top Main Navigation */}
      <Navbar
        currentView={currentView}
        onSwitchView={setCurrentView}
        isRealtimeConnected={isRealtimeConnected}
        studentCuId={studentCuId}
        adminUser={adminUser}
        onStudentLogout={handleStudentLogout}
        onAdminLogout={handleAdminLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-full flex flex-col overflow-x-hidden">
        {currentView === 'student' ? (
          /* ========================================= */
          /* STUDENT PANEL                             */
          /* ========================================= */
          !studentCuId || !studentData ? (
            <StudentWelcome onLoginSuccess={handleStudentLoginSuccess} />
          ) : (
            <div className="max-w-6xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 flex flex-col overflow-x-hidden">
              {/* Desktop Student Navigation Bar */}
              <div className="hidden md:flex items-center space-x-2 mb-6 p-1.5 bg-slate-900/80 rounded-2xl border border-slate-800 self-start">
                {studentNavTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = studentTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStudentTab(tab.id)}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Student View Content */}
              <div className="flex-1">
                {studentTab === 'dashboard' && (
                  <StudentDashboard
                    student={studentData}
                    onNavigateTab={setStudentTab}
                    lastSyncNotice={lastSyncNotice}
                    onRefreshStudent={() => fetchCurrentStudent()}
                  />
                )}
                {studentTab === 'attendance' && (
                  <StudentAttendance cuId={studentData.cu_id} student={studentData} />
                )}
                {studentTab === 'assignments' && (
                  <StudentAssignments cuId={studentData.cu_id} />
                )}
                {studentTab === 'profile' && (
                  <StudentProfile student={studentData} />
                )}
              </div>

              {/* Mobile Bottom Navigation */}
              <StudentBottomNav currentTab={studentTab} onSelectTab={setStudentTab} />
            </div>
          )
        ) : (
          /* ========================================= */
          /* ADMIN PANEL                               */
          /* ========================================= */
          !adminUser ? (
            <AdminLogin onLoginSuccess={handleAdminLoginSuccess} />
          ) : (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden w-full max-w-full">
              {/* Mobile Admin Sub-Header */}
              <div className="md:hidden flex items-center justify-between px-3.5 py-2.5 bg-slate-900 border-b border-slate-800 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAdminMobileDrawerOpen(true)}
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-xs font-semibold shadow-sm transition"
                >
                  <Menu className="w-4 h-4 text-indigo-400" />
                  <span>Admin Menu</span>
                </button>
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-bold text-slate-200 font-['Outfit'] truncate max-w-[200px]">
                    {adminTab === 'overview' && 'Overview'}
                    {adminTab === 'students' && 'Students Directory'}
                    {adminTab === 'attendance' && 'Attendance Logs'}
                    {adminTab === 'assignments' && 'Assignments'}
                    {adminTab === 'excel_import' && 'Excel Import'}
                    {adminTab === 'messages' && 'Student Notices'}
                    {adminTab === 'user_management' && 'HOD & Admins'}
                    {adminTab === 'cloud_sync' && 'Cloud Sync'}
                    {adminTab === 'import_history' && 'Import History'}
                    {adminTab === 'settings' && 'Settings'}
                  </span>
                </div>
              </div>

              {/* Collapsible / Slide-Out Admin Drawer */}
              <AdminNavDrawer
                currentTab={adminTab}
                onSelectTab={setAdminTab}
                isCollapsed={isAdminSidebarCollapsed}
                onToggleCollapse={() => setIsAdminSidebarCollapsed(!isAdminSidebarCollapsed)}
                isMobileOpen={isAdminMobileDrawerOpen}
                onCloseMobile={() => setIsAdminMobileDrawerOpen(false)}
                currentUser={adminUser}
              />

              {/* Admin Main View - Full Width on Mobile */}
              <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto overflow-x-hidden">
                {adminTab === 'overview' && <AdminOverview onNavigateTab={setAdminTab} currentUser={adminUser} />}
                {adminTab === 'students' && <AdminStudents />}
                {adminTab === 'attendance' && <AdminAttendance />}
                {adminTab === 'assignments' && <AdminAssignments />}
                {adminTab === 'excel_import' && <AdminExcelImport currentUser={adminUser} />}
                {adminTab === 'messages' && <AdminMessages />}
                {adminTab === 'user_management' && <AdminUserManagement currentUser={adminUser} />}
                {adminTab === 'cloud_sync' && <AdminCloudSync />}
                {adminTab === 'import_history' && <AdminImportHistory />}
                {adminTab === 'settings' && <AdminSettings currentUser={adminUser} />}
              </div>

              {/* Mandatory First-Login Password Setup Modal for Admins / HODs */}
              {adminUser?.must_change_password && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
                  <div className="glass-panel max-w-md w-full rounded-2xl p-6 border border-purple-500/50 shadow-2xl space-y-4">
                    <div className="flex items-center space-x-3 text-purple-400">
                      <div className="p-2.5 rounded-xl bg-purple-950/80 border border-purple-800/60">
                        <Lock className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white font-['Outfit']">Mandatory Security Setup</h3>
                        <p className="text-xs text-slate-400">Please choose a permanent password for your administrator account.</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
                      Logged in as: <strong>{adminUser.username}</strong> ({adminUser.email})<br />
                      Department: <span className="font-mono text-sky-400">{adminUser.department || 'ALL'}</span>
                    </div>

                    {firstLoginError && (
                      <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/60 text-red-200 text-xs flex items-start space-x-2">
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <span>{firstLoginError}</span>
                      </div>
                    )}

                    <form onSubmit={handleFirstLoginPasswordSubmit} className="space-y-3.5 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-300 mb-1">
                          New Permanent Password (min 8 characters)
                        </label>
                        <input
                          type="password"
                          value={firstLoginNewPass}
                          onChange={(e) => setFirstLoginNewPass(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          required
                          autoFocus
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-300 mb-1">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          value={firstLoginConfirmPass}
                          onChange={(e) => setFirstLoginConfirmPass(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={firstLoginLoading || !firstLoginNewPass || !firstLoginConfirmPass}
                        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold shadow-lg shadow-purple-900/30 transition disabled:opacity-50"
                      >
                        {firstLoginLoading ? 'Updating Password...' : 'Save & Continue to Console'}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </main>
    </div>
  );
}

export default App;
