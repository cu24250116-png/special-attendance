import React, { useEffect, useState } from 'react';
import { Settings, Server, Radio, Database, ShieldCheck, Key, RefreshCw } from 'lucide-react';

export const AdminSettings: React.FC = () => {
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealthData(data);
    } catch (err) {
      console.error('Failed to load health status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const [customUrl, setCustomUrl] = useState(() => localStorage.getItem('custom_api_url') || '');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (customUrl.trim()) {
      localStorage.setItem('custom_api_url', customUrl.trim());
    } else {
      localStorage.removeItem('custom_api_url');
    }
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      window.location.reload();
    }, 1200);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            <Settings className="w-4 h-4" />
            <span>ERP Infrastructure Controls</span>
          </div>
          <h1 className="text-2xl font-bold text-white font-['Outfit']">System Settings & Health</h1>
          <p className="text-xs text-slate-400 mt-1">
            Realtime connection health, database clustering mode, and college statutory thresholds.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchHealth}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Cloud & Background Persistence Card */}
      <div className="glass-panel rounded-2xl p-6 border border-indigo-800/50 bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 space-y-4">
        <div className="flex items-center space-x-2.5 text-indigo-400">
          <Server className="w-5 h-5" />
          <h3 className="text-sm font-bold uppercase tracking-wider font-mono">
            24/7 Background Persistence &amp; Server Configuration
          </h3>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Students can fetch and view their records continuously even when Admin is logged out or when VS Code is closed.
          Data is persistently written to SQLite disk storage and cached on mobile clients.
        </p>

        <form onSubmit={handleSaveUrl} className="pt-2 flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="Custom Backend API URL (e.g., https://my-server.onrender.com or http://192.168.1.13:5000)"
            className="flex-1 px-4 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-900/30 transition flex items-center justify-center space-x-1.5"
          >
            <span>Save &amp; Switch API</span>
          </button>
        </form>

        {saveSuccess && (
          <p className="text-xs text-emerald-400 font-semibold animate-fadeIn">
            ✓ Backend URL updated! Reloading application...
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Realtime Streaming Health */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 font-mono flex items-center space-x-2">
            <Radio className="w-4 h-4" />
            <span>Realtime Server-Sent Events (SSE) Stream</span>
          </h3>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Stream Connection Endpoint</span>
              <span className="font-mono text-sky-400">/api/realtime/stream</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Server Health Status</span>
              <span className="text-emerald-400 font-semibold uppercase">
                {healthData?.status || 'Active'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Active Connected Clients</span>
              <span className="font-mono text-white font-bold">
                {healthData?.realtimeClients?.totalConnected || 1} Total Clients
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Heartbeat Interval</span>
              <span className="text-slate-300">Every 20 seconds</span>
            </div>
          </div>
        </div>

        {/* Database & Hosting Architecture */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-sky-400 font-mono flex items-center space-x-2">
            <Database className="w-4 h-4" />
            <span>Database Storage Engine</span>
          </h3>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Storage Driver</span>
              <span className="text-white font-semibold">
                SQLite WebAssembly &amp; PostgreSQL Dual Adapter
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Local Database File</span>
              <span className="font-mono text-slate-300">server/data/college_attendance.sqlite</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Remote Cloud Database</span>
              <span className="text-slate-400">Plug &amp; Play DATABASE_URL (Supabase / Neon)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Atomicity &amp; Idempotency</span>
              <span className="text-emerald-400 font-semibold">Strict CU_ID Unique Constraint</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
