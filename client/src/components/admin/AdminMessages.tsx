import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { AdminMessage } from '../../types';
import {
  Megaphone,
  Send,
  Trash2,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw,
  Building2,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

export const AdminMessages: React.FC = () => {
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [departments, setDepartments] = useState<{ name: string; student_count: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form State
  const [senderTitle, setSenderTitle] = useState('Message from Admin');
  const [customTitle, setCustomTitle] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'department'>('all');
  const [selectedDept, setSelectedDept] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [messageText, setMessageText] = useState('');

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [msgRes, deptRes] = await Promise.all([
        api.getAdminMessages(),
        api.getAdminDepartments(),
      ]);
      setMessages(msgRes.messages || []);
      setDepartments(deptRes.departments || []);
      if (deptRes.departments?.length > 0 && !selectedDept) {
        setSelectedDept(deptRes.departments[0].name);
      }
    } catch (e: any) {
      console.error('Failed to load notices data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) {
      setNotification({ type: 'error', text: 'Please enter a message for the students.' });
      return;
    }

    const finalTitle = senderTitle === 'Custom' ? (customTitle.trim() || 'Notice') : senderTitle;
    const targetVal = targetType === 'department' ? selectedDept : null;

    setSending(true);
    setNotification(null);

    try {
      const res = await api.sendAdminMessage({
        message: messageText.trim(),
        sender_title: finalTitle,
        target_type: targetType,
        target_value: targetVal,
        priority,
      });

      setNotification({
        type: 'success',
        text: `Notice broadcasted successfully! Targeted to: ${targetType === 'all' ? 'All Students' : selectedDept}`,
      });
      setMessageText('');
      await fetchData();
    } catch (err: any) {
      setNotification({
        type: 'error',
        text: err.message || 'Failed to send broadcast notice.',
      });
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (id: string) => {
    setDeletingId(id);
    try {
      await api.deleteAdminMessage(id);
      setMessages(prev => prev.filter(m => m.id !== id));
      setNotification({ type: 'success', text: 'Notice removed successfully.' });
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to remove notice.' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Page Header */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1">
            <Megaphone className="w-4 h-4" />
            <span>Student Communication & Announcements</span>
          </div>
          <h1 className="text-2xl font-bold text-white font-['Outfit']">
            Broadcast Notices & Messages
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Send real-time pop-up notices from Admin or HOD directly to students’ dashboards. Filter announcements by specific college department or broadcast to all students.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchData}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 self-start sm:self-auto transition"
          title="Refresh messages and departments"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between space-x-2 animate-fadeIn ${
            notification.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/80 border-rose-800 text-rose-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            )}
            <span className="font-medium">{notification.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-white text-xs ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Compose on Left, History on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Compose Form (7 cols on lg) */}
        <div className="lg:col-span-7 glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl space-y-5">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-800">
            <Send className="w-4 h-4 text-indigo-400" />
            <h2 className="text-base font-bold text-white font-['Outfit']">Compose New Student Notice</h2>
          </div>

          <form onSubmit={handleSendMessage} className="space-y-4">
            {/* Sender Title Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Sender Title / Header (Shown on Student Popup)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {['Message from Admin', 'Message from HOD', 'Message from Dean Academic'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => { setSenderTitle(preset); }}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold text-left border transition ${
                      senderTitle === preset
                        ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200 shadow-inner'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Audience: All vs Department */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Target Audience
              </label>
              <div className="flex items-center space-x-3 mb-3">
                <button
                  type="button"
                  onClick={() => setTargetType('all')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 border transition ${
                    targetType === 'all'
                      ? 'bg-blue-600/30 border-blue-500 text-sky-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>All Students (College-wide)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType('department')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 border transition ${
                    targetType === 'department'
                      ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>By Department</span>
                </button>
              </div>

              {/* Department Dropdown if selected */}
              {targetType === 'department' && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 animate-fadeIn">
                  <label className="block text-[11px] font-semibold text-slate-400">
                    Select Target Department / Branch:
                  </label>
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    {departments.map((d) => (
                      <option key={d.name} value={d.name}>
                        {d.name} ({d.student_count} students)
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500">
                    Notice will exclusively appear on the dashboards of students in this department.
                  </p>
                </div>
              )}
            </div>

            {/* Notice Priority */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Notice Priority
              </label>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setPriority('normal')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                    priority === 'normal'
                      ? 'bg-slate-800 border-slate-600 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}
                >
                  Normal Announcement
                </button>
                <button
                  type="button"
                  onClick={() => setPriority('urgent')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                    priority === 'urgent'
                      ? 'bg-rose-950/60 border-rose-600 text-rose-300'
                      : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}
                >
                  Urgent / High Priority
                </button>
              </div>
            </div>

            {/* Message Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Message Content
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  {messageText.length} characters
                </span>
              </div>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={5}
                placeholder="Dear Students,&#10;&#10;Attendance verification for special make-up classes has been uploaded. Please verify your Day 1 to Day 8 records on your dashboard. Defaulters below 75% must submit all pending assignments before the cutoff date."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-sans leading-relaxed resize-y"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={sending || !messageText.trim()}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2 transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {sending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Broadcasting Notice...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Broadcast Notice to Students</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* History / Active Broadcasts (5 cols on lg) */}
        <div className="lg:col-span-5 glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-sky-400" />
                <h2 className="text-base font-bold text-white font-['Outfit']">Active Notices ({messages.length})</h2>
              </div>
            </div>

            <div className="mt-3 space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {loading && messages.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">Loading notices...</div>
              ) : messages.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 text-xs">
                  <Megaphone className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
                  <p>No broadcast notices currently sent.</p>
                  <p className="text-[11px] text-slate-500 mt-1">Compose a notice on the left to notify students.</p>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-2 hover:border-slate-700 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5 font-['Outfit']">
                          <span>{m.sender_title}</span>
                          {m.priority === 'urgent' && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase font-mono">
                              Urgent
                            </span>
                          )}
                        </h4>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                          <span>{new Date(m.created_at).toLocaleDateString()} {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>•</span>
                          <span className={`font-mono px-1.5 py-0.2 rounded text-[10px] ${
                            m.target_type === 'all'
                              ? 'bg-blue-950/60 text-sky-300 border border-blue-800/50'
                              : 'bg-purple-950/60 text-purple-300 border border-purple-800/50'
                          }`}>
                            {m.target_type === 'all' ? 'All Students' : m.target_value}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(m.id)}
                        disabled={deletingId === m.id}
                        className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900 text-red-300 border border-red-800/50 transition flex-shrink-0"
                        title="Delete / Revoke Notice"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-300 font-sans leading-relaxed whitespace-pre-wrap bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                      {m.message}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
