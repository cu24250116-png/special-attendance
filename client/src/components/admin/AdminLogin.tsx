import React, { useState } from 'react';
import { ShieldCheck, Mail, Lock, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';

interface AdminLoginProps {
  onLoginSuccess: (user: any, token: string) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide administrator email and password.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const data = await api.adminLogin(email, password);
      localStorage.setItem('college_admin_token', data.token);
      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setEmail('admin@college.edu');
    setPassword('Admin@123');
    setError(null);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-800 relative overflow-hidden">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-sky-400 p-0.5 shadow-xl flex items-center justify-center">
              <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
                <ShieldCheck className="w-8 h-8 text-indigo-400" />
              </div>
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Outfit']">
              Administrator Portal
            </h1>
            <p className="text-sm text-slate-400 mt-2">
              Sign in to manage student records, upload Excel attendance sheets, and control live cloud synchronization.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-950/60 border border-red-800/60 text-red-200 text-sm flex items-start space-x-2.5 animate-fadeIn">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="admin_email_input" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Admin Email / Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-slate-400" />
                </div>
                <input
                  id="admin_email_input"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@college.edu"
                  className="w-full pl-11 pr-4 py-3 bg-slate-900/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition"
                />
              </div>
            </div>

            <div>
              <label htmlFor="admin_password_input" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-slate-400" />
                </div>
                <input
                  id="admin_password_input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 bg-slate-900/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 via-blue-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-900/30 flex items-center justify-center space-x-2 disabled:opacity-50 transition transform active:scale-[0.99] mt-2"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In as Administrator'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Quick Demo Credentials Button */}
            <div className="pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={fillDemo}
                className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-medium rounded-xl border border-slate-700 flex items-center justify-center space-x-1.5 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Auto-fill Demo Credentials (admin@college.edu)</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
