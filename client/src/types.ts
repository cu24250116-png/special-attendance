export interface Student {
  cu_id: string;
  student_name: string;
  course: string;
  branch: string;
  semester: string;
  section: string;
  email?: string;
  phone?: string;
  overall_percentage: number;
  total_sessions: number;
  present_sessions: number;
  absent_sessions: number;
  last_updated: string;
}

export interface AttendanceRecord {
  id: string;
  cu_id: string;
  attendance_date: string;
  subject: string;
  total_sessions: number;
  present_sessions: number;
  absent_sessions: number;
  attendance_percentage: number;
  status: 'Present' | 'Absent' | 'Partial' | string;
  created_at: string;
}

export interface DailyAttendanceSummary {
  date: string;
  totalHeld: number;
  totalPresent: number;
  totalAbsent: number;
  percentage: number;
  status: 'Present' | 'Absent' | 'Partial' | string;
  sessions: AttendanceRecord[];
}

export interface Assignment {
  id: string;
  assignment_id: string;
  cu_id: string;
  assignment_name: string;
  subject: string;
  submission_deadline: string;
  submission_status: 'Submitted' | 'Pending' | 'Late' | 'Not Applicable' | string;
  submission_date?: string | null;
  remarks?: string | null;
  created_at: string;
}

export interface ImportJob {
  id: string;
  filename: string;
  uploaded_by: string;
  import_type: string;
  status: 'success' | 'partial' | 'failed' | string;
  total_rows: number;
  students_updated: number;
  attendance_updated: number;
  assignments_updated: number;
  errors_count: number;
  created_at: string;
}

export interface CloudSyncConfig {
  id: string;
  provider: 'google_drive' | 'onedrive' | string;
  folder_or_file_id: string;
  file_name: string;
  sync_interval_minutes: number;
  last_sync_time?: string | null;
  last_file_modified_time?: string | null;
  status: 'idle' | 'syncing' | 'success' | 'error' | string;
  last_error?: string | null;
  is_enabled: number | boolean;
}

export interface AdminAnalytics {
  totalStudents: number;
  averageAttendance: number;
  defaultersCount: number;
  attendanceThreshold: number;
  totalAssignments: number;
  submittedAssignments: number;
  pendingAssignments: number;
  recentImports: ImportJob[];
  cloudSync: {
    config: CloudSyncConfig;
    lastSyncJob?: ImportJob | null;
    isCurrentlySyncing: boolean;
  };
  serverTime: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  role: 'admin' | 'student';
}
