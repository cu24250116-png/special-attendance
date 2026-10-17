import React, { useState } from 'react';
import { UserCheck, Lock, Eye, EyeOff, ArrowRight, School, AlertCircle, Info } from 'lucide-react';
import { api } from '../../services/api';

interface StudentWelcomeProps {
  onLoginSuccess: (cuId: string, token: string) => void;
}

export const StudentWelcome: React.FC<StudentWelcomeProps> = ({ onLoginSuccess }) => {
  const [cuId, setCuId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = cuId.trim().toUpperCase();
    const targetPassword = password.trim();

    if (!targetId) {
      setError('Please enter your Student ID / CU ID.');
      return;
    }
    if (!targetPassword) {
      setError('Please enter your Password (default is your Student ID / CU ID).');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const data = await api.studentLogin(targetId, targetPassword);
      localStorage.setItem('college_student_token', data.token);
      localStorage.setItem('college_student_cuid', data.student.cu_id);
      onLoginSuccess(data.student.cu_id, data.token);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Quick helper to fill password when CU ID changes if password is empty
  const handleCuIdChange = (val: string) => {
    const uppercaseVal = val.toUpperCase();
    setCuId(uppercaseVal);
    // If password hasn't been manually set or matches old CU ID, keep it in sync
    if (!password || password === cuId) {
      setPassword(uppercaseVal);
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

          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-950/60 border border-red-800/60 text-red-200 text-xs flex items-start space-x-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

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

          {/* Footer note */}
          <div className="mt-8 pt-4 border-t border-slate-800/80 text-center">
            <p className="text-[11px] text-slate-500">
              Only records officially uploaded by the College Administrator via Excel will be available.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
