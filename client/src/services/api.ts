import { Student, AttendanceRecord, DailyAttendanceSummary, Assignment, AdminAnalytics, ImportJob, CloudSyncConfig, SpecialClassAttendance, AdminMessage, AdminUser } from '../types';
import bundledDataRaw from '../data/bundledAttendanceData.json';

const bundledData = bundledDataRaw as unknown as {
  exportedAt: string;
  totalStudents: number;
  students: Record<string, {
    profile: Student;
    attendance: any;
    assignments: any;
  }>;
};

// Official 24/7 Production Cloud Endpoint on Render
export const PRODUCTION_SERVER_URL = 'https://college-special-attendance.onrender.com';

// Check if running in native Android / Capacitor environment
export const isNativeApp = (): boolean => {
  if (typeof window === 'undefined') return false;
  if ((window as any).Capacitor?.isNativePlatform?.()) return true;
  if ((window as any).Capacitor !== undefined && (window as any).Capacitor.platform !== 'web') return true;
  const proto = window.location.protocol;
  if (proto === 'capacitor:' || proto === 'file:' || proto === 'ionic:') return true;
  const ua = navigator.userAgent || '';
  if (/Android.*(wv|Version\/)/i.test(ua) && window.location.hostname === 'localhost') return true;
  return false;
};

// Purge any legacy manual IP configuration from localStorage to ensure clients never hit internal IPs
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('college_custom_api_url');
    localStorage.removeItem('custom_api_url');
  } catch (e) {}
}

export const getApiBase = (): string => {
  // Native Android APK connects directly to production cloud HTTPS API
  if (isNativeApp()) {
    return `${PRODUCTION_SERVER_URL}/api`;
  }
  // Web browser on production Render or local dev with proxy
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host.includes('onrender.com')) {
      return '/api';
    }
  }
  return `${PRODUCTION_SERVER_URL}/api`;
};

export const getApiRoot = (): string => {
  if (isNativeApp()) {
    return PRODUCTION_SERVER_URL;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.includes('onrender.com') || host === 'localhost' || host === '127.0.0.1') {
      return '';
    }
  }
  return PRODUCTION_SERVER_URL;
};

function getAdminToken(): string | null {
  return localStorage.getItem('college_admin_token');
}

function getStudentToken(): string | null {
  return localStorage.getItem('college_student_token');
}

// Local Storage Cache Keys
const CACHE_PREFIX = 'college_offline_cache_';

export function saveToOfflineCache(key: string, data: any) {
  try {
    const cleanKey = key.replace(/^\/+/, '').replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();
    localStorage.setItem(`${CACHE_PREFIX}${cleanKey}`, JSON.stringify(data));
  } catch (e) {}
}

export function getFromOfflineCache<T>(key: string): T | null {
  try {
    const cleanKey = key.replace(/^\/+/, '').replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();
    const raw = localStorage.getItem(`${CACHE_PREFIX}${cleanKey}`);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// In-Memory Index Map for Ultra-Fast Student Lookup with or without "CU" prefix or Roll Number
const studentLookupMap = new Map<string, typeof bundledData.students[string]>();

function initStudentLookupMap() {
  if (studentLookupMap.size > 0) return;
  for (const [key, record] of Object.entries(bundledData.students || {})) {
    if (!record || !record.profile) continue;
    const cleanKey = key.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
    studentLookupMap.set(cleanKey, record);
    const withoutCu = cleanKey.replace(/^CU/i, '');
    if (withoutCu) studentLookupMap.set(withoutCu, record);

    if (record.profile.cu_id) {
      const c = record.profile.cu_id.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
      studentLookupMap.set(c, record);
      const cNoCu = c.replace(/^CU/i, '');
      if (cNoCu) studentLookupMap.set(cNoCu, record);
    }
    if (record.profile.roll_number) {
      const r = record.profile.roll_number.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
      studentLookupMap.set(r, record);
      const rNoCu = r.replace(/^CU/i, '');
      if (rNoCu) studentLookupMap.set(rNoCu, record);
    }
  }
}

export function findBundledStudent(queryId: string) {
  if (!queryId) return null;
  initStudentLookupMap();
  const clean = queryId.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
  if (!clean) return null;

  if (studentLookupMap.has(clean)) {
    return studentLookupMap.get(clean) || null;
  }
  const stripped = clean.replace(/^CU/i, '');
  if (studentLookupMap.has(stripped)) {
    return studentLookupMap.get(stripped) || null;
  }
  const withCu = `CU${stripped}`;
  if (studentLookupMap.has(withCu)) {
    return studentLookupMap.get(withCu) || null;
  }
  return null;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});

  // Set default JSON header if not FormData
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Attach appropriate auth token
  const adminToken = getAdminToken();
  const studentToken = getStudentToken();
  const token = adminToken || studentToken;
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const customUrl = localStorage.getItem('college_custom_api_url') || localStorage.getItem('custom_api_url');
  const isNative = isNativeApp();

  // 1. NETWORK-FIRST RESOLUTION
  // Always attempts live server first so newly imported Admin datasets and attendance updates reflect immediately
  const base = getApiBase();
  const controller = new AbortController();

  // Distinguish heavy operations (Excel processing, imports, deletions, resets) vs standard queries
  const isHeavyOp =
    endpoint.includes('excel') ||
    endpoint.includes('import') ||
    endpoint.includes('jobs') ||
    endpoint.includes('clear-all');

  // Extended timeout: 180s for heavy operations; 30s on web, 15s on mobile APK for standard requests
  const timeoutMs = isHeavyOp ? 180000 : (isNative ? 15000 : 30000);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${base}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMsg = `Request failed (${response.status})`;
      try {
        const errData = await response.json();
        if (errData.error) errorMsg = errData.error;
        else if (errData.message) errorMsg = errData.message;
      } catch (e) {}
      throw new Error(errorMsg);
    }

    const data = await response.json();

    // Cache successful responses for offline access
    const cacheKey = endpoint.replace(/^\/+/, '').replace(/[^a-zA-Z0-9_]/g, '_');
    saveToOfflineCache(cacheKey, data);

    return data;
  } catch (networkError: any) {
    clearTimeout(timeoutId);

    // If it's a deliberate credential or validation error from the server (e.g. invalid password), throw it directly
    if (networkError.message && (
      networkError.message.includes('Invalid credentials') ||
      networkError.message.includes('Invalid password') ||
      networkError.message.includes('Current password does not match') ||
      networkError.message.includes('required') ||
      networkError.message.includes('401') ||
      networkError.message.includes('403')
    )) {
      throw networkError;
    }

    // Honest connection error - do not silently present bundled or stale data as live attendance
    if (networkError.name === 'AbortError') {
      if (isHeavyOp) {
        throw new Error('The operation is taking longer than expected. Please wait a moment and refresh.');
      }
      throw new Error('Connection timed out. College server took too long to respond.');
    }

    if (networkError.message && (
      networkError.message.includes('fetch') ||
      networkError.message.includes('network') ||
      networkError.message.includes('Failed') ||
      networkError.message.includes('NetworkError')
    )) {
      throw new Error('College server is currently unreachable. Please check your internet connection.');
    }

    throw new Error(networkError.message || 'College server is currently unreachable. Please check your connection.');
  }
}

// Download official student attendance slip as a formatted text/print document
export function downloadAttendanceSlip(student: Student) {
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const pct = Math.round((student.overall_percentage || 0) * 10) / 10;
  const isEligible = pct >= 75;

  const specialDatesList = (student.special_class_attendance?.specialDates || []).map((d: any) =>
    `  • [Day ${d.dateIndex}] ${d.formattedDate || d.date}: ${d.status === 'Uploaded' ? 'PRESENT (Uploaded)' : 'ABSENT (Pending)'} (${d.percentageContribution || 0}%)`
  ).join('\n') || '  No special class dates recorded.';

  const content = `================================================================================
          COLLEGE SPECIAL ATTENDANCE & EXAMINATION CLEARANCE SLIP
================================================================================
Student Name    : ${student.student_name}
Student ID / CU : ${student.cu_id}
Roll Number     : ${student.roll_number || student.cu_id}
Course & Branch : ${student.course || 'B.Tech'} - ${student.branch || 'B.Tech'}
Semester        : ${student.semester || '1'} (Section ${student.section || 'A'})
Generated On    : ${dateStr} at ${timeStr}
--------------------------------------------------------------------------------
OVERALL ATTENDANCE STATUS:
  Total Sessions Held   : ${student.total_sessions || 0}
  Present Sessions      : ${student.present_sessions || 0}
  Absent Sessions       : ${student.absent_sessions || 0}
  Overall Percentage    : ${pct}%
  Exam Clearance Status : ${isEligible ? 'ELIGIBLE FOR EXAMINATIONS (>= 75%)' : 'DETENTION WARNING: ATTENDANCE SHORTAGE (< 75%)'}
--------------------------------------------------------------------------------
SPECIAL CLASS DATES & ASSIGNMENT SUBMISSION BREAKDOWN:
${specialDatesList}
--------------------------------------------------------------------------------
Special Class Attendance : ${student.special_class_attendance?.specialAttendancePercentage || 0}%
Assignments Submitted    : ${student.special_class_attendance?.uploadedCount || 0} of ${student.special_class_attendance?.totalSpecialDates || 8}
Pending Assignments      : ${student.special_class_attendance?.pendingCount || 0}
--------------------------------------------------------------------------------
Note: This is an official verified college record from the CampusSync ERP system.
Only official submissions uploaded through the portal are recognized.
================================================================================`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Attendance_Slip_${student.cu_id}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function checkServerHealth(customUrl?: string): Promise<{
  online: boolean;
  latencyMs?: number;
  message?: string;
  clients?: any;
}> {
  const root = (customUrl || getApiRoot() || (isNativeApp() ? PRODUCTION_SERVER_URL : '')).replace(/\/+$/, '').replace(/\/api$/, '');
  const target = `${root}/api/health`;
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(target, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      return {
        online: true,
        latencyMs: Date.now() - start,
        message: 'Connected to College Server',
        clients: data.realtimeClients,
      };
    }
    return { online: false, message: `Server error (${res.status})` };
  } catch (err: any) {
    return {
      online: false,
      message: err.name === 'AbortError' ? 'Connection timed out' : 'Server offline / unreachable',
    };
  }
}

export const api = {
  // Auth
  adminLogin: (email: string, password: string) =>
    request<{ token: string; user: any; must_change_password?: boolean }>('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  adminMe: () => request<{ user: any }>('/auth/admin/me'),

  adminChangePassword: (data: { currentPassword?: string; newPassword: string }) =>
    request<{ success: boolean; message: string; user: any }>('/auth/admin/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Multi-Admin User Management (Super Admin only)
  getAdminUsers: () =>
    request<{ users: AdminUser[] }>('/admin/users'),

  createAdminUser: (data: { username: string; email: string; password?: string; department: string; role?: string }) =>
    request<{ success: boolean; user: AdminUser; temporaryPassword?: string; message: string }>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAdminUser: (id: number | string, data: { username?: string; department?: string; role?: string; status?: string }) =>
    request<{ success: boolean; user: AdminUser; message: string }>(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  resetAdminPassword: (id: number | string, temporaryPassword?: string) =>
    request<{ success: boolean; temporaryPassword: string; message: string }>(`/admin/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ temporaryPassword }),
    }),

  deleteAdminUser: (id: number | string) =>
    request<{ success: boolean; message: string }>(`/admin/users/${id}`, {
      method: 'DELETE',
    }),

  studentLookup: (cu_id: string) =>
    request<{
      success: boolean;
      cu_id: string;
      studentName: string;
      maskedName: string;
      maskedEmail: string;
      course: string;
      branch: string;
      semester: string;
      section: string;
      demoCode: string;
      message: string;
    }>('/auth/student/lookup', {
      method: 'POST',
      body: JSON.stringify({ cu_id }),
    }),

  studentVerify: (cu_id: string, otp: string) =>
    request<{
      success: boolean;
      token: string;
      student: Student;
    }>('/auth/student/verify', {
      method: 'POST',
      body: JSON.stringify({ cu_id, otp }),
    }),

  studentLogin: (cu_id: string, password: string) =>
    request<{
      success: boolean;
      token: string;
      student: Student;
      isOffline?: boolean;
    }>('/auth/student/login', {
      method: 'POST',
      body: JSON.stringify({ cu_id, password }),
    }),

  changeStudentPassword: (cu_id: string, current_password: string, new_password: string) =>
    request<{ success: boolean; message: string }>('/auth/student/change-password', {
      method: 'POST',
      body: JSON.stringify({ cu_id, current_password, new_password }),
    }),

  // Student Endpoints
  getStudentProfile: (cu_id: string) =>
    request<{ student: Student }>(`/students/${encodeURIComponent(cu_id)}`),

  getStudentAttendance: (cu_id: string) =>
    request<{
      latestFiveDates: string[];
      dailySummaries: DailyAttendanceSummary[];
      lastFiveDaysRecords: AttendanceRecord[];
      totalRecords: number;
      hasRecords: boolean;
      specialClassAttendance?: SpecialClassAttendance;
    }>(`/students/${encodeURIComponent(cu_id)}/attendance`),

  getStudentAssignments: (cu_id: string) =>
    request<{
      totalSpecialAssignments: number;
      submittedCount: number;
      pendingCount: number;
      lateCount: number;
      naCount: number;
      specialClassAttendance?: SpecialClassAttendance;
      assignments: Assignment[];
    }>(`/students/${encodeURIComponent(cu_id)}/assignments`),

  // Admin Endpoints
  getAdminAnalytics: () => request<AdminAnalytics>('/admin/analytics'),

  getAdminStudents: (params: Record<string, string | number> = {}) => {
    const query = new URLSearchParams(params as any).toString();
    return request<{
      students: Student[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      filterOptions: { branches: string[]; semesters: string[] };
    }>(`/admin/students?${query}`);
  },

  getAdminAttendance: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<{
      records: (AttendanceRecord & { student_name: string; branch: string; section: string })[];
      dates: string[];
      subjects: string[];
    }>(`/admin/attendance?${query}`);
  },

  getAdminAssignments: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<{
      assignments: (Assignment & { student_name: string; branch: string; section: string })[];
    }>(`/admin/assignments?${query}`);
  },

  updateStudentAttendance: (cu_id: string, data: Partial<Student>) =>
    request<{ success: boolean; message: string; student: Student }>(`/admin/students/${encodeURIComponent(cu_id)}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Excel & File Operations
  previewExcel: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<{
      filename: string;
      size: number;
      sheetNames: string[];
      totalRows: Record<string, number>;
      preview: {
        students: any[];
        attendance: any[];
        assignments: any[];
      };
      validationIssues: any[];
    }>('/admin/excel/preview', {
      method: 'POST',
      body: formData,
    });
  },

  importExcel: (file: File, mode: 'incremental' | 'replace' = 'incremental') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);
    return request<{
      success: boolean;
      message: string;
      result: {
        jobId: string;
        status: string;
        filename: string;
        totalRows: number;
        studentsUpdated: number;
        attendanceUpdated: number;
        assignmentsUpdated: number;
        errorsCount: number;
        errors: any[];
        affectedStudents: string[];
      };
    }>('/admin/excel/import', {
      method: 'POST',
      body: formData,
    });
  },

  getImportHistory: () =>
    request<{ history: ImportJob[] }>('/admin/import-history'),

  deleteImportJob: (jobId: string) =>
    request<{ success: boolean; jobId: string; filename: string; message: string }>(`/admin/excel/jobs/${encodeURIComponent(jobId)}`, {
      method: 'DELETE',
    }),

  clearAllImportData: () =>
    request<{ success: boolean; message: string }>('/admin/excel/clear-all', {
      method: 'DELETE',
    }),

  getAuditLogs: () =>
    request<{ logs: any[] }>('/admin/audit-logs'),

  // Cloud Sync
  getCloudSyncStatus: () =>
    request<{
      config: CloudSyncConfig;
      lastSyncJob?: ImportJob | null;
      isCurrentlySyncing: boolean;
    }>('/cloud-sync/status'),

  updateCloudSyncConfig: (config: Partial<CloudSyncConfig>) =>
    request<{ success: boolean; updated: any }>('/cloud-sync/config', {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  triggerCloudSync: () =>
    request<{
      status: string;
      message: string;
      result?: any;
      timestamp?: string;
    }>('/cloud-sync/sync-now', {
      method: 'POST',
    }),

  // Admin Broadcast Messages & Department Notices
  getAdminDepartments: () =>
    request<{ departments: { name: string; student_count: number }[] }>('/admin/departments').catch(() => {
      // Fallback from bundled data if offline
      const depts = new Map<string, number>();
      for (const s of Object.values(bundledData.students || {})) {
        const d = s.profile?.branch || s.profile?.course;
        if (d) depts.set(d, (depts.get(d) || 0) + 1);
      }
      return {
        departments: Array.from(depts.entries()).map(([name, count]) => ({ name, student_count: count })),
      };
    }),
  getDepartments: () => api.getAdminDepartments(),

  getAdminMessages: () =>
    request<{ messages: AdminMessage[] }>('/admin/messages').catch(() => {
      const cached = getFromOfflineCache<AdminMessage[]>('admin_messages_list');
      return { messages: cached || [] };
    }),

  sendAdminMessage: (data: {
    message: string;
    sender_title: string;
    target_type: 'all' | 'department' | string;
    target_value?: string | null;
    priority?: 'normal' | 'urgent' | string;
  }) =>
    request<{ success: boolean; message: AdminMessage }>('/admin/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteAdminMessage: (id: string) =>
    request<{ success: boolean; message: string }>(`/admin/messages/${id}`, {
      method: 'DELETE',
    }),

  getStudentMessages: (cuId: string) =>
    request<{ messages: AdminMessage[] }>(`/students/${encodeURIComponent(cuId)}/messages`).then((res) => {
      saveToOfflineCache(`student_messages_${cuId}`, res.messages);
      return res;
    }).catch(() => {
      // Offline fallback: check offline cache or bundled messages
      const cached = getFromOfflineCache<AdminMessage[]>(`student_messages_${cuId}`) ||
                     getFromOfflineCache<AdminMessage[]>('admin_messages_list');
      return { messages: cached || [] };
    }),

  setCustomApiUrl: (_url: string) => {},
  getCustomApiUrl: () => '',
  checkServerHealth,

  downloadTemplateUrl: `${getApiBase()}/admin/excel/template`,
  downloadErrorReportUrl: (jobId: string) => `${getApiBase()}/admin/excel/errors/${jobId}`,
  downloadApkUrl: `${getApiRoot()}/download/SpecialAttendance.apk`,
  downloadAttendanceSlip,
  isNativeApp,
  getApiBase,
  getApiRoot,
};


