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
