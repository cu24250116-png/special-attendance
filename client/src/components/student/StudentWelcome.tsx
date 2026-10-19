import React, { useState, useEffect } from 'react';
import { UserCheck, Lock, Eye, EyeOff, ArrowRight, School, AlertCircle, Info, Smartphone, Key, CheckCircle2, ArrowLeft, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { api, isNativeApp } from '../../services/api';

interface StudentWelcomeProps {
  onLoginSuccess: (cuId: string, token: string, initialStudent?: any) => void;
}

export const StudentWelcome: React.FC<StudentWelcomeProps> = ({ onLoginSuccess }) => {
  const [cuId, setCuId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Live Server Health & Connection State
  const [serverStatus, setServerStatus] = useState<{
    online: boolean | null;
    checking: boolean;
    latencyMs?: number;
    message?: string;
  }>({
    online: null,
    checking: true,
  });

  const checkConnection = async () => {
    setServerStatus(prev => ({ ...prev, checking: true }));
    try {
      const health = await api.checkServerHealth();
      setServerStatus({
        online: health.online,
        checking: false,
        latencyMs: health.latencyMs,
        message: health.message,
      });
      return health;
    } catch {
      setServerStatus({
        online: false,
        checking: false,
        message: 'College cloud server is unreachable',
      });
      return { online: false };
    }
  };

  useEffect(() => {
    checkConnection();
    const interval = setInterval(() => {
      checkConnection();
    }, 25000);
    return () => clearInterval(interval);
  }, []);

  // Change Password state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [changeCuId, setChangeCuId] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changeLoading, setChangeLoading] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);

  const isNative = isNativeApp();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = cuId.trim().toUpperCase();
    const targetPassword = password.trim();

    if (!targetId) {
      setError('Please enter your Student ID / CU ID or Roll Number.');
      return;
    }
    if (!targetPassword) {
      setError('Please enter your Password (default is your Student ID / CU ID).');
      return;
    }

    if (serverStatus.online === false) {
      const fresh = await checkConnection();
      if (!fresh.online) {
        setError('College server is currently unreachable. Please check your internet connection.');
        return;
      }
    }

    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      const data = await api.studentLogin(targetId, targetPassword);
      localStorage.setItem('college_student_token', data.token);
      localStorage.setItem('college_student_cuid', data.student.cu_id);
      onLoginSuccess(data.student.cu_id, data.token, data.student);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleCuIdChange = (val: string) => {
    const uppercaseVal = val.toUpperCase();
    setCuId(uppercaseVal);
    if (!password || password === cuId) {
      setPassword(uppercaseVal);
    }
  };


  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = changeCuId.trim().toUpperCase();
    const currentPass = currentPassword.trim();
    const newPass = newPassword.trim();
    const confirmPass = confirmPassword.trim();

    if (!targetId) {
      setChangeError('Please enter your Student ID / CU ID.');
      return;
    }
    if (!currentPass) {
      setChangeError('Please enter your current password (default is CU ID).');
      return;
    }
    if (!newPass) {
      setChangeError('Please enter your new password.');
      return;
    }
    if (newPass.length < 4) {
      setChangeError('New password must be at least 4 characters long.');
      return;
    }
    if (newPass !== confirmPass) {
      setChangeError('New password and confirm password do not match.');
      return;
    }

    setChangeError(null);
    setChangeLoading(true);
    try {
      const res = await api.changeStudentPassword(targetId, currentPass, newPass);
      setSuccessMessage(res.message || 'Password updated successfully!');
      setCuId(targetId);
      setPassword(newPass);
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setChangeError(err.message || 'Failed to update password. Please check your current password.');
    } finally {
      setChangeLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-800 relative overflow-hidden">
          {/* Subtle Glow backdrop */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

          {/* College Badge */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 p-0.5 shadow-xl flex items-center justify-center">
              <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
                <School className="w-8 h-8 text-sky-400" />
              </div>
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Outfit']">
              Student Attendance Portal
            </h1>
            <p className="text-sm text-slate-400 mt-2">
              Sign in with your Student ID and Password to check your real-time attendance and special class records.
            </p>
          </div>

          {/* Live Server Mode vs Offline Mode Status Card */}
          <div className="mb-6">
            {serverStatus.checking && serverStatus.online === null ? (
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs flex items-center justify-between text-slate-400">
                <div className="flex items-center space-x-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                  <span className="text-[11px]">Connecting to College Production Cloud...</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">Render 24/7</span>
              </div>
            ) : serverStatus.online ? (
              <div className="p-2.5 px-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs flex items-center justify-between shadow-sm">
                <div className="flex items-center space-x-2.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <div>
                    <span className="text-emerald-300 font-bold text-[11px] tracking-wide uppercase">
                      Live Server Mode
                    </span>
                    <span className="text-emerald-400/70 text-[10px] ml-1.5 hidden sm:inline">
                      • Connected {serverStatus.latencyMs ? `(${serverStatus.latencyMs}ms)` : ''}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-900/60 text-emerald-200 border border-emerald-700/50">
                  Cloud Live
                </span>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-600/50 text-xs flex items-start justify-between shadow-lg animate-fadeIn">
                <div className="flex items-start space-x-2.5 min-w-0">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-rose-200 font-bold text-[11px] uppercase tracking-wide">
                      Offline Mode • College Server Unreachable
                    </p>
                    <p className="text-[11px] text-rose-300/80 mt-0.5 leading-tight">
                      Cannot reach production server. Student records and updates cannot be loaded offline.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => checkConnection()}
                  disabled={serverStatus.checking}
                  className="ml-2 px-2.5 py-1 rounded-lg bg-rose-900/80 hover:bg-rose-800 text-rose-100 text-[11px] font-semibold flex items-center space-x-1 flex-shrink-0 border border-rose-700/60 transition disabled:opacity-50"
                  title="Retry connection"
                >
                  <RefreshCw className={`w-3 h-3 ${serverStatus.checking ? 'animate-spin' : ''}`} />
                  <span>{serverStatus.checking ? 'Checking...' : 'Retry'}</span>
                </button>
              </div>
            )}
          </div>

          {successMessage && (
            <div className="mb-6 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-200 text-xs flex items-start space-x-2.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {error && !showChangePassword && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-950/60 border border-red-800/60 text-red-200 text-xs flex items-start space-x-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {showChangePassword ? (
            /* ========================================= */
            /* CHANGE PASSWORD FORM                      */
            /* ========================================= */
            <form onSubmit={handleChangePasswordSubmit} className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowChangePassword(false)}
                  className="text-xs text-slate-400 hover:text-white flex items-center space-x-1 transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Login</span>
                </button>
                <span className="text-xs font-semibold text-sky-400 font-mono">Set New Password</span>
              </div>

              {changeError && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/60 text-red-200 text-xs flex items-start space-x-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <span>{changeError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Student ID / CU ID
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <UserCheck className="w-5 h-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={changeCuId}
                    onChange={(e) => setChangeCuId(e.target.value.toUpperCase())}
                    placeholder="Enter Student ID / CU ID"
                    className="w-full pl-11 pr-4 py-3 bg-slate-900/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 uppercase font-mono tracking-wider text-sm transition"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Current Password
                  </label>
                  <span className="text-[10px] text-slate-400">Default is your CU ID</span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="w-5 h-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter Current Password"
                    className="w-full pl-11 pr-4 py-3 bg-slate-900/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono tracking-wider text-sm transition"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  New Password (min 4 chars)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Key className="w-5 h-5 text-slate-400" />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Create New Password"
                    className="w-full pl-11 pr-11 py-3 bg-slate-900/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono tracking-wider text-sm transition"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Key className="w-5 h-5 text-slate-400" />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter New Password"
                    className="w-full pl-11 pr-4 py-3 bg-slate-900/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono tracking-wider text-sm transition"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={changeLoading || !changeCuId.trim() || !currentPassword.trim() || !newPassword.trim()}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-sky-600 via-indigo-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-medium rounded-xl shadow-lg shadow-sky-900/30 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition transform active:scale-[0.99] mt-3"
              >
                <span>{changeLoading ? 'Saving Password...' : 'Save & Update Password'}</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </form>
          ) : (
            /* ========================================= */
            /* STANDARD STUDENT LOGIN FORM               */
            /* ========================================= */
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="student_id_input" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Student ID / CU ID / Roll Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <UserCheck className="w-5 h-5 text-slate-400" />
                  </div>
                  <input
                    id="student_id_input"
                    type="text"
                    value={cuId}
                    onChange={(e) => handleCuIdChange(e.target.value)}
                    placeholder="Enter Student ID / CU ID"
                    className="w-full pl-11 pr-4 py-3 bg-slate-900/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase font-mono tracking-wider text-sm transition"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="student_password_input" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Password
                  </label>
                  <span className="text-[11px] text-sky-400 font-medium">
                    Default: Same as Student ID
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="w-5 h-5 text-slate-400" />
                  </div>
                  <input
                    id="student_password_input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter Password (CU ID)"
                    className="w-full pl-11 pr-11 py-3 bg-slate-900/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono tracking-wider text-sm transition"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Want to change password option */}
              <div className="flex items-center justify-between pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setChangeCuId(cuId);
                    setChangeError(null);
                    setShowChangePassword(true);
                  }}
                  className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center space-x-1.5 transition group"
                >
                  <Key className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
                  <span className="underline underline-offset-4 decoration-sky-500/50">
                    Want to change password?
                  </span>
                </button>
              </div>

              {/* Note box */}
              <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/40 text-blue-200 text-xs flex items-start space-x-2">
                <Info className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
                <p>
                  As configured by the college, your default password is your <strong>Student ID / CU ID</strong> from the official imported Excel sheet.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !cuId.trim() || !password.trim()}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 text-white font-medium rounded-xl shadow-lg shadow-blue-900/30 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition transform active:scale-[0.99] mt-2"
              >
                <span>{loading ? 'Authenticating Student...' : 'Sign In to Dashboard'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {!isNative && (
            <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-2">
              <a
                href={api.downloadApkUrl}
                download="SpecialAttendance.apk"
                className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition shadow-lg shadow-emerald-900/40 group active:scale-[0.99]"
              >
                <Smartphone className="w-4 h-4 text-emerald-200 group-hover:scale-110 transition-transform" />
                <span>Download Android App (.APK)</span>
              </a>
              <p className="text-[10px] text-slate-400 text-center">
                Direct install on any Android phone • Live college sync
              </p>
            </div>
          )}

          {/* Footer note */}
          <div className="mt-4 pt-3 border-t border-slate-800/50 text-center">
            <p className="text-[11px] text-slate-500">
              Only records officially uploaded by the College Administrator via Excel will be available.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
