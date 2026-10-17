import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

import db from './src/database.js';
import {
  generateToken,
  comparePassword,
  requireAdmin,
  requireStudentOrAdmin,
  rateLimitMiddleware,
  generateStudentOtp,
  verifyStudentOtp,
} from './src/auth.js';
import ExcelProcessor from './src/excel-processor.js';
import realtimeHub from './src/realtime.js';
import cloudSyncService from './src/cloud-sync.js';
import { seedDatabase } from './src/seed.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer memory storage for Excel files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .xlsx, .xls, and .csv files are supported.'));
    }
  },
});

// Realtime SSE endpoint
app.get('/api/realtime/stream', (req, res) => {
  const cuId = req.query.cu_id;
  const role = req.query.role || 'student';
  realtimeHub.addClient(req, res, { cuId, role });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    realtimeClients: realtimeHub.getClientStats(),
  });
});

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

// Admin Login
app.post('/api/auth/admin/login', rateLimitMiddleware(15, 60000), async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email/username and password are required' });
  }

  try {
    const user = await db.get(
      'SELECT * FROM users WHERE email = ? OR username = ?',
      [email.trim(), email.trim()]
    );

    if (!user || !comparePassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials. Please verify and try again.' });
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      username: user.username,
      role: 'admin',
    });

    res.json({
      message: 'Admin login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Authentication failed', details: err.message });
  }
});

// Admin Me
app.get('/api/auth/admin/me', requireAdmin, async (req, res) => {
  res.json({ user: req.user });
});

// Student Lookup (Step 1: Check CU ID & issue verification code)
app.post('/api/auth/student/lookup', rateLimitMiddleware(30, 60000), async (req, res) => {
  const { cu_id } = req.body;
  if (!cu_id) {
    return res.status(400).json({ error: 'CU ID is required' });
  }

  const normalized = cu_id.toUpperCase().trim();
  const student = await db.get('SELECT * FROM students WHERE cu_id = ?', [normalized]);

  if (!student) {
    return res.status(404).json({
      error: `Student with CU ID "${normalized}" was not found. Please check your ID or contact the college administration.`,
    });
  }

  // Generate OTP for secure access
  const otpCode = generateStudentOtp(normalized);

  // Mask student email / name for privacy
  const maskedName = student.student_name.replace(/(?<=^.{2}).(?=.{2}$)/g, '*');
  const maskedEmail = student.email ? student.email.replace(/(?<=^.{2}).(?=.*@)/g, '*') : 'college email';

  res.json({
    success: true,
    cu_id: normalized,
    studentName: student.student_name,
    maskedName,
    maskedEmail,
    course: student.course,
    branch: student.branch,
    semester: student.semester,
    section: student.section,
    // Provide demo code in dev for instant convenient testing
    demoCode: otpCode,
    message: `Verification code generated. Use ${otpCode} or master PIN 123456 to verify.`,
  });
});

// Student Verify OTP & Issue Token (Step 2: Authenticated session)
app.post('/api/auth/student/verify', rateLimitMiddleware(20, 60000), async (req, res) => {
  const { cu_id, otp } = req.body;
  if (!cu_id || !otp) {
    return res.status(400).json({ error: 'CU ID and verification OTP code are required' });
  }

  const normalized = cu_id.toUpperCase().trim();
  const student = await db.get('SELECT * FROM students WHERE cu_id = ?', [normalized]);

  if (!student) {
    return res.status(404).json({ error: 'Student record not found' });
  }

  const isValid = verifyStudentOtp(normalized, otp);
  if (!isValid) {
    return res.status(401).json({
      error: 'Invalid or expired verification code. Use code 123456 or request a new code.',
    });
  }

  // Issue short-lived student session token
  const token = generateToken({
    cu_id: normalized,
    name: student.student_name,
    role: 'student',
  }, '24h');

  res.json({
    success: true,
    token,
    student: {
      cu_id: student.cu_id,
      student_name: student.student_name,
      course: student.course,
      branch: student.branch,
      semester: student.semester,
      section: student.section,
      overall_percentage: student.overall_percentage,
      total_sessions: student.total_sessions,
      present_sessions: student.present_sessions,
      absent_sessions: student.absent_sessions,
      last_updated: student.last_updated,
    },
  });
});

// ==========================================
// STUDENT PANEL ROUTES
// ==========================================

// Get Student Profile
app.get('/api/students/:cu_id', requireStudentOrAdmin, async (req, res) => {
  const cuId = req.params.cu_id.toUpperCase().trim();
  const student = await db.get('SELECT * FROM students WHERE cu_id = ?', [cuId]);

  if (!student) {
    return res.status(404).json({ error: 'Student record not found' });
  }

  res.json({ student });
});

// Get Student Attendance (Latest 5 Days + Complete breakdown)
app.get('/api/students/:cu_id/attendance', requireStudentOrAdmin, async (req, res) => {
  const cuId = req.params.cu_id.toUpperCase().trim();

  // All attendance records ordered by date descending
  const allRecords = await db.all(`
    SELECT * FROM attendance_records
    WHERE cu_id = ?
    ORDER BY attendance_date DESC, created_at DESC
  `, [cuId]);

  // Find unique dates
  const uniqueDates = [...new Set(allRecords.map(r => r.attendance_date))];
  const latestFiveDates = uniqueDates.slice(0, 5);

  // Filter latest 5 days
  const lastFiveDaysRecords = allRecords.filter(r => latestFiveDates.includes(r.attendance_date));

  // Build daily summaries for the 5 days
  const dailySummaries = latestFiveDates.map(date => {
    const dayRecords = allRecords.filter(r => r.attendance_date === date);
    let totalHeld = 0;
    let totalPresent = 0;
    let totalAbsent = 0;

    for (const rec of dayRecords) {
      totalHeld += Number(rec.total_sessions || 0);
      totalPresent += Number(rec.present_sessions || 0);
      totalAbsent += Number(rec.absent_sessions || 0);
    }

    const dayPct = totalHeld > 0 ? Math.round(((totalPresent / totalHeld) * 100) * 10) / 10 : 0;
    const dayStatus = totalPresent === totalHeld ? 'Present' : totalPresent === 0 ? 'Absent' : 'Partial';

    return {
      date,
      totalHeld,
      totalPresent,
      totalAbsent,
      percentage: dayPct,
      status: dayStatus,
      sessions: dayRecords,
    };
  });

  res.json({
    latestFiveDates,
    dailySummaries,
    lastFiveDaysRecords,
    totalRecords: allRecords.length,
    hasRecords: allRecords.length > 0,
  });
});

// Get Student Special Assignments
app.get('/api/students/:cu_id/assignments', requireStudentOrAdmin, async (req, res) => {
  const cuId = req.params.cu_id.toUpperCase().trim();

  const assignments = await db.all(`
    SELECT * FROM assignments
    WHERE cu_id = ?
    ORDER BY submission_deadline ASC, created_at DESC
  `, [cuId]);

  let submittedCount = 0;
  let pendingCount = 0;
  let lateCount = 0;
  let naCount = 0;

  for (const a of assignments) {
    const st = (a.submission_status || '').toLowerCase();
    if (st.includes('submit')) submittedCount++;
    else if (st.includes('late')) lateCount++;
    else if (st.includes('na') || st.includes('not')) naCount++;
    else pendingCount++;
  }

  res.json({
    totalSpecialAssignments: assignments.length,
    submittedCount,
    pendingCount,
    lateCount,
    naCount,
    assignments,
  });
});

// ==========================================
// ADMIN PANEL ROUTES
// ==========================================

// Admin Analytics Overview
app.get('/api/admin/analytics', requireAdmin, async (req, res) => {
  const totalStudentsRow = await db.get('SELECT COUNT(*) as count FROM students');
  const totalStudents = totalStudentsRow ? Number(totalStudentsRow.count) : 0;

  const avgAttendanceRow = await db.get('SELECT AVG(overall_percentage) as avg FROM students');
  const averageAttendance = avgAttendanceRow ? Math.round((Number(avgAttendanceRow.avg) || 0) * 10) / 10 : 0;

  const defaultersRow = await db.get('SELECT COUNT(*) as count FROM students WHERE overall_percentage < 75');
  const defaultersCount = defaultersRow ? Number(defaultersRow.count) : 0;

  const totalAssignmentsRow = await db.get('SELECT COUNT(*) as count FROM assignments');
  const totalAssignments = totalAssignmentsRow ? Number(totalAssignmentsRow.count) : 0;

  const submittedRow = await db.get(`
    SELECT COUNT(*) as count FROM assignments
    WHERE LOWER(submission_status) LIKE '%submit%'
  `);
  const submittedAssignments = submittedRow ? Number(submittedRow.count) : 0;
  const pendingAssignments = Math.max(0, totalAssignments - submittedAssignments);

  const recentImports = await db.all(`
    SELECT * FROM import_jobs
    ORDER BY created_at DESC
    LIMIT 5
  `);

  const cloudSync = await cloudSyncService.getStatus();

  res.json({
    totalStudents,
    averageAttendance,
    defaultersCount,
    attendanceThreshold: 75,
    totalAssignments,
    submittedAssignments,
    pendingAssignments,
    recentImports,
    cloudSync,
    serverTime: new Date().toISOString(),
  });
});

// Admin Students List (with search, filter, pagination)
app.get('/api/admin/students', requireAdmin, async (req, res) => {
  const { search, branch, semester, threshold, page = 1, limit = 20 } = req.query;
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

  let query = 'SELECT * FROM students WHERE 1=1';
  let countQuery = 'SELECT COUNT(*) as count FROM students WHERE 1=1';
  const params = [];
  const countParams = [];

  if (search) {
    const s = `%${search.trim().toLowerCase()}%`;
    query += ' AND (LOWER(cu_id) LIKE ? OR LOWER(student_name) LIKE ?)';
    countQuery += ' AND (LOWER(cu_id) LIKE ? OR LOWER(student_name) LIKE ?)';
    params.push(s, s);
    countParams.push(s, s);
  }

  if (branch && branch !== 'all') {
    query += ' AND branch = ?';
    countQuery += ' AND branch = ?';
    params.push(branch);
    countParams.push(branch);
  }

  if (semester && semester !== 'all') {
    query += ' AND semester = ?';
    countQuery += ' AND semester = ?';
    params.push(semester);
    countParams.push(semester);
  }

  if (threshold === 'below_75') {
    query += ' AND overall_percentage < 75';
    countQuery += ' AND overall_percentage < 75';
  } else if (threshold === 'above_75') {
    query += ' AND overall_percentage >= 75';
    countQuery += ' AND overall_percentage >= 75';
  }

  query += ' ORDER BY cu_id ASC LIMIT ? OFFSET ?';
  params.push(parseInt(limit, 10), offset);

  const students = await db.all(query, params);
  const totalRow = await db.get(countQuery, countParams);
  const total = totalRow ? Number(totalRow.count) : 0;

  // Get distinct branches and semesters for filters
  const branches = await db.all('SELECT DISTINCT branch FROM students WHERE branch IS NOT NULL ORDER BY branch ASC');
  const semesters = await db.all('SELECT DISTINCT semester FROM students WHERE semester IS NOT NULL ORDER BY semester ASC');

  res.json({
    students,
    total,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    totalPages: Math.ceil(total / parseInt(limit, 10)),
    filterOptions: {
      branches: branches.map(b => b.branch),
      semesters: semesters.map(s => s.semester),
    },
  });
});

// Admin Attendance Records
app.get('/api/admin/attendance', requireAdmin, async (req, res) => {
  const { date, subject, cu_id, page = 1, limit = 25 } = req.query;
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

  let query = `
    SELECT a.*, s.student_name, s.branch, s.section
    FROM attendance_records a
    JOIN students s ON a.cu_id = s.cu_id
    WHERE 1=1
  `;
  const params = [];

  if (date) {
    query += ' AND a.attendance_date = ?';
    params.push(date);
  }
  if (subject && subject !== 'all') {
    query += ' AND a.subject = ?';
    params.push(subject);
  }
  if (cu_id) {
    query += ' AND a.cu_id LIKE ?';
    params.push(`%${cu_id.trim().toUpperCase()}%`);
  }

  query += ' ORDER BY a.attendance_date DESC, a.cu_id ASC LIMIT ? OFFSET ?';
  params.push(parseInt(limit, 10), offset);

  const records = await db.all(query, params);
  const dates = await db.all('SELECT DISTINCT attendance_date FROM attendance_records ORDER BY attendance_date DESC');
  const subjects = await db.all('SELECT DISTINCT subject FROM attendance_records ORDER BY subject ASC');

  res.json({
    records,
    dates: dates.map(d => d.attendance_date),
    subjects: subjects.map(s => s.subject),
  });
});

// Admin Assignment Records
app.get('/api/admin/assignments', requireAdmin, async (req, res) => {
  const { status, subject, cu_id } = req.query;

  let query = `
    SELECT a.*, s.student_name, s.branch, s.section
    FROM assignments a
    JOIN students s ON a.cu_id = s.cu_id
    WHERE 1=1
  `;
  const params = [];

  if (status && status !== 'all') {
    query += ' AND LOWER(a.submission_status) LIKE ?';
    params.push(`%${status.toLowerCase()}%`);
  }
  if (subject && subject !== 'all') {
    query += ' AND a.subject = ?';
    params.push(subject);
  }
  if (cu_id) {
    query += ' AND a.cu_id LIKE ?';
    params.push(`%${cu_id.trim().toUpperCase()}%`);
  }

  query += ' ORDER BY a.submission_deadline ASC, a.cu_id ASC LIMIT 100';

  const assignments = await db.all(query, params);
  res.json({ assignments });
});

// Manual update single student record (e.g. Test requirement 4: Admin updates a student's attendance from 88% to 92%)
app.post('/api/admin/students/:cu_id', requireAdmin, async (req, res) => {
  const cuId = req.params.cu_id.toUpperCase().trim();
  const { overall_percentage, total_sessions, present_sessions, absent_sessions, student_name } = req.body;

  const existing = await db.get('SELECT * FROM students WHERE cu_id = ?', [cuId]);
  if (!existing) {
    return res.status(404).json({ error: 'Student not found' });
  }

  const now = new Date().toISOString();
  await db.run(`
    UPDATE students SET
      student_name = COALESCE(?, student_name),
      overall_percentage = COALESCE(?, overall_percentage),
      total_sessions = COALESCE(?, total_sessions),
      present_sessions = COALESCE(?, present_sessions),
      absent_sessions = COALESCE(?, absent_sessions),
      last_updated = ?
    WHERE cu_id = ?
  `, [
    student_name || null,
    overall_percentage !== undefined ? parseFloat(overall_percentage) : null,
    total_sessions !== undefined ? parseInt(total_sessions, 10) : null,
    present_sessions !== undefined ? parseInt(present_sessions, 10) : null,
    absent_sessions !== undefined ? parseInt(absent_sessions, 10) : null,
    now,
    cuId
  ]);

  const updatedStudent = await db.get('SELECT * FROM students WHERE cu_id = ?', [cuId]);

  // Broadcast targeted update to connected student dashboard and admins
  realtimeHub.notifyStudent(cuId, {
    action: 'UPDATED',
    student: updatedStudent,
  });

  res.json({
    success: true,
    message: `Student ${cuId} successfully updated. Live event broadcast to student dashboard.`,
    student: updatedStudent,
  });
});

// Preview Excel File before import
app.post('/api/admin/excel/preview', requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please select an Excel (.xlsx, .xls) or CSV file to upload' });
  }

  try {
    const previewData = ExcelProcessor.generatePreview(req.file.buffer);
    res.json({
      filename: req.file.originalname,
      size: req.file.size,
      ...previewData,
    });
  } catch (err) {
    res.status(400).json({ error: `Failed to parse Excel file: ${err.message}` });
  }
});

// Import Excel File
app.post('/api/admin/excel/import', requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No Excel file uploaded' });
  }

  const mode = req.body.mode || 'incremental'; // 'incremental' or 'replace'
  const adminName = req.user?.username || req.user?.email || 'College Admin';

  try {
    const result = await ExcelProcessor.importExcel(
      req.file.buffer,
      req.file.originalname,
      adminName,
      { mode, type: 'admin_upload' }
    );

    // Broadcast live update to all students and admins
    realtimeHub.broadcastCollegeUpdate({
      source: 'admin_upload',
      filename: req.file.originalname,
      updatedBy: adminName,
      result,
    });

    res.json({
      success: true,
      message: `Import processed: ${result.studentsUpdated} students, ${result.attendanceUpdated} attendance records, ${result.assignmentsUpdated} assignments.`,
      result,
    });
  } catch (err) {
    res.status(500).json({ error: `Import failed: ${err.message}` });
  }
});

// Download Official Template
app.get('/api/admin/excel/template', async (req, res) => {
  try {
    const buffer = await ExcelProcessor.generateOfficialTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="College_Attendance_Assignments_Template.xlsx"');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate template', details: err.message });
  }
});

// Download Error Report for an import job
app.get('/api/admin/excel/errors/:job_id', requireAdmin, async (req, res) => {
  try {
    const buffer = await ExcelProcessor.generateErrorReport(req.params.job_id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Import_Errors_${req.params.job_id}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate error report', details: err.message });
  }
});

// Import History
app.get('/api/admin/import-history', requireAdmin, async (req, res) => {
  const history = await db.all('SELECT * FROM import_jobs ORDER BY created_at DESC LIMIT 50');
  res.json({ history });
});

// Audit Logs
app.get('/api/admin/audit-logs', requireAdmin, async (req, res) => {
  const logs = await db.all('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100');
  res.json({ logs });
});

// Cloud Sync Status & Configuration
app.get('/api/cloud-sync/status', requireAdmin, async (req, res) => {
  const status = await cloudSyncService.getStatus();
  res.json(status);
});

app.post('/api/cloud-sync/config', requireAdmin, async (req, res) => {
  const updated = await cloudSyncService.updateConfig(req.body);
  res.json({ success: true, updated });
});

app.post('/api/cloud-sync/sync-now', requireAdmin, async (req, res) => {
  const result = await cloudSyncService.triggerManualSync();
  res.json(result);
});

// Serve frontend build if exists
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Start Server and initialize services
async function startServer() {
  await db.init();
  await seedDatabase();
  await cloudSyncService.start();

  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` College Special Attendance & Assignment Server`);
    console.log(` Running on: http://localhost:${PORT}`);
    console.log(` Realtime SSE Stream: http://localhost:${PORT}/api/realtime/stream`);
    console.log(` Default Admin: ${process.env.ADMIN_DEFAULT_EMAIL || 'admin@college.edu'} / ${process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@123'}`);
    console.log(`====================================================`);
  });
}

startServer().catch(err => {
  console.error('Fatal server startup error:', err);
});
