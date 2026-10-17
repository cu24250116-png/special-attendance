import { Student, AttendanceRecord, DailyAttendanceSummary, Assignment, AdminAnalytics, ImportJob, CloudSyncConfig } from '../types';

const API_BASE = '/api';

function getAdminToken(): string | null {
  return localStorage.getItem('college_admin_token');
}

function getStudentToken(): string | null {
  return localStorage.getItem('college_student_token');
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

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `Request failed (${response.status})`;
    try {
      const errData = await response.json();
      if (errData.error) errorMsg = errData.error;
      else if (errData.message) errorMsg = errData.message;
    } catch (e) {}
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Auth
  adminLogin: (email: string, password: string) =>
    request<{ token: string; user: any }>('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  adminMe: () => request<{ user: any }>('/auth/admin/me'),

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
    }>('/auth/student/login', {
      method: 'POST',
      body: JSON.stringify({ cu_id, password }),
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
    }>(`/students/${encodeURIComponent(cu_id)}/attendance`),

  getStudentAssignments: (cu_id: string) =>
    request<{
      totalSpecialAssignments: number;
      submittedCount: number;
      pendingCount: number;
      lateCount: number;
      naCount: number;
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

  downloadTemplateUrl: `${API_BASE}/admin/excel/template`,
  downloadErrorReportUrl: (jobId: string) => `${API_BASE}/admin/excel/errors/${jobId}`,
};
