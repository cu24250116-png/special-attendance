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
  hashPassword,
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
      'SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)',
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

// Universal flexible student lookup supporting:
// 1. Raw query (e.g. "CU26250044" or "26250044")
// 2. Case-insensitive
// 3. With or without "CU" prefix (e.g. "26250044" finds "CU26250044" and vice-versa)
// 4. By cu_id or roll_number
export async function findStudentInDb(queryId) {
  if (!queryId) return null;
  const raw = String(queryId).trim();
  if (!raw) return null;

  const upper = raw.toUpperCase();
  const withoutCu = upper.replace(/^CU[-_ ]*/i, '');
  const withCu = upper.startsWith('CU') ? upper : `CU${upper}`;

  // 1. Exact match on cu_id or roll_number
  let student = await db.get(
    `SELECT * FROM students 
     WHERE UPPER(cu_id) = ? 
        OR UPPER(COALESCE(roll_number, '')) = ?
     LIMIT 1`,
    [upper, upper]
  );
  if (student) return student;

  // 2. Prefix variant match (with/without CU)
  student = await db.get(
    `SELECT * FROM students 
     WHERE UPPER(cu_id) IN (?, ?) 
        OR UPPER(COALESCE(roll_number, '')) IN (?, ?)
     LIMIT 1`,
    [withCu, withoutCu, withCu, withoutCu]
  );
  if (student) return student;

  // 3. Stripped match: replace 'CU' from column values
  student = await db.get(
    `SELECT * FROM students 
     WHERE REPLACE(UPPER(cu_id), 'CU', '') = ?
        OR REPLACE(UPPER(COALESCE(roll_number, '')), 'CU', '') = ?
     LIMIT 1`,
    [withoutCu, withoutCu]
  );
  return student || null;
}

// Student Lookup (Step 1: Check CU ID & issue verification code)
app.post('/api/auth/student/lookup', rateLimitMiddleware(30, 60000), async (req, res) => {
  const { cu_id } = req.body;
  if (!cu_id) {
    return res.status(400).json({ error: 'CU ID is required' });
  }

  const student = await findStudentInDb(cu_id);

  if (!student) {
    return res.status(404).json({
      error: `Student with ID "${cu_id}" was not found. Please check your ID or contact the college administration.`,
    });
  }

  // Generate OTP for secure access using canonical cu_id
  const otpCode = generateStudentOtp(student.cu_id);

  // Mask student email / name for privacy
  const maskedName = student.student_name ? student.student_name.replace(/(?<=^.{2}).(?=.{2}$)/g, '*') : 'Student';
  const maskedEmail = student.email ? student.email.replace(/(?<=^.{2}).(?=.*@)/g, '*') : 'college email';

  res.json({
    success: true,
    cu_id: student.cu_id,
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

  const student = await findStudentInDb(cu_id);

  if (!student) {
    return res.status(404).json({ error: 'Student record not found' });
  }

  const normalized = student.cu_id;
  const isValid = verifyStudentOtp(normalized, otp) || verifyStudentOtp(String(cu_id).toUpperCase().trim(), otp);
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

// Student Direct Login (CU ID + Password = CU ID)
app.post('/api/auth/student/login', rateLimitMiddleware(30, 60000), async (req, res) => {
  const { cu_id, password } = req.body;
  if (!cu_id || !password) {
    return res.status(400).json({ error: 'Please enter both CU ID / Student ID and Password.' });
  }

  const rawCuId = String(cu_id).trim();
  const inputPassword = String(password).trim();

  // Find student flexibly across cu_id and roll_number with/without CU
  const student = await findStudentInDb(rawCuId);

  if (!student) {
    return res.status(404).json({
      error: `Student record for "${rawCuId}" was not found. Please verify your Student ID / CU ID or contact college administration.`,
    });
  }

  // Password verification:
  // If student has changed password (password_changed == 1), custom password hash matches
  let isMatch = false;
  if (student.password_changed === 1 || student.password_changed === true) {
    isMatch = Boolean(student.password_hash && comparePassword(inputPassword, student.password_hash));
  } else {
    // Default password is CU ID or roll_number (flexible: with or without CU, uppercase or lowercase)
    const upperInputPass = inputPassword.toUpperCase();
    const strippedInputPass = upperInputPass.replace(/^CU[-_ ]*/i, '');
    const stuCuUpper = (student.cu_id || '').toUpperCase();
    const stuCuStripped = stuCuUpper.replace(/^CU[-_ ]*/i, '');
    const stuRollUpper = (student.roll_number || '').toUpperCase();
    const stuRollStripped = stuRollUpper.replace(/^CU[-_ ]*/i, '');

    isMatch =
      upperInputPass === stuCuUpper ||
      upperInputPass === stuCuStripped ||
      strippedInputPass === stuCuStripped ||
      (stuRollUpper && (
        upperInputPass === stuRollUpper ||
        upperInputPass === stuRollStripped ||
        strippedInputPass === stuRollStripped
      )) ||
      Boolean(student.password_hash && comparePassword(inputPassword, student.password_hash));
  }

  if (!isMatch) {
    return res.status(401).json({
      error: student.password_changed === 1
        ? 'Invalid password. Please enter the password you updated, or use "Want to change password?".'
        : `Invalid password. Note: Your default password is your Student ID / CU ID (${student.cu_id}).`,
    });
  }

  // Issue short-lived student session token using canonical student cu_id
  const token = generateToken({
    cu_id: student.cu_id,
    name: student.student_name,
    role: 'student',
  }, '24h');

  // Compute special class attendance statistics
  const studentRecords = await db.all('SELECT * FROM attendance_records WHERE cu_id = ?', [student.cu_id]);
  const studentAssignments = await db.all('SELECT * FROM assignments WHERE cu_id = ?', [student.cu_id]);
  const specialClassAttendance = computeSpecialClassAttendance(student.cu_id, studentRecords, studentAssignments);

  res.json({
    success: true,
    message: 'Login successful',
    token,
    student: {
      cu_id: student.cu_id,
      student_name: student.student_name,
      roll_number: student.roll_number,
      father_name: student.father_name,
      course: student.course,
      branch: student.branch,
      semester: student.semester,
      section: student.section,
      overall_percentage: student.overall_percentage,
      total_sessions: student.total_sessions,
      present_sessions: student.present_sessions,
      absent_sessions: student.absent_sessions,
      last_updated: student.last_updated,
      special_class_attendance: specialClassAttendance,
    },
  });
});

// Student Change Password endpoint
app.post('/api/auth/student/change-password', rateLimitMiddleware(20, 60000), async (req, res) => {
  const { cu_id, current_password, new_password } = req.body;
  if (!cu_id || !current_password || !new_password) {
    return res.status(400).json({ error: 'Student ID, Current Password, and New Password are required.' });
  }

  const rawCuId = String(cu_id).trim();
  const inputCurrent = current_password.trim();
  const inputNew = new_password.trim();

  if (inputNew.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters long.' });
  }

  const student = await findStudentInDb(rawCuId);

  if (!student) {
    return res.status(404).json({ error: `Student with ID "${rawCuId}" does not exist in the college records.` });
  }

  // Verify current password
  let isCurrentMatch = false;
  if (student.password_changed === 1 || student.password_changed === true) {
    isCurrentMatch = Boolean(student.password_hash && comparePassword(inputCurrent, student.password_hash));
  } else {
    const upperCurrent = inputCurrent.toUpperCase();
    const strippedCurrent = upperCurrent.replace(/^CU[-_ ]*/i, '');
    const stuCuUpper = (student.cu_id || '').toUpperCase();
    const stuCuStripped = stuCuUpper.replace(/^CU[-_ ]*/i, '');
    const stuRollUpper = (student.roll_number || '').toUpperCase();
    const stuRollStripped = stuRollUpper.replace(/^CU[-_ ]*/i, '');

    isCurrentMatch =
      upperCurrent === stuCuUpper ||
      upperCurrent === stuCuStripped ||
      strippedCurrent === stuCuStripped ||
      (stuRollUpper && (
        upperCurrent === stuRollUpper ||
        upperCurrent === stuRollStripped ||
        strippedCurrent === stuRollStripped
      )) ||
      Boolean(student.password_hash && comparePassword(inputCurrent, student.password_hash));
  }

  if (!isCurrentMatch) {
    return res.status(401).json({
      error: 'Current password does not match. Note: Default password is your Student ID / CU ID.',
    });
  }

  // Hash new password and save
  const newHash = hashPassword(inputNew);
  const now = new Date().toISOString();
  await db.run(
    'UPDATE students SET password_hash = ?, password_changed = 1, last_updated = ? WHERE cu_id = ?',
    [newHash, now, student.cu_id]
  );
  db.saveSqlite();

  res.json({
    success: true,
    message: 'Password changed successfully! You can now log in with your new password.',
  });
});

// Helper to compute Special Class Attendance & Special Assignment statistics
// Formula: Weight per date = 100 / totalSpecialDates (e.g. 100 / 8 = 12.5% per date)
// Special Class Attendance % = (uploaded_count * weight_per_date)
// ZERO hardcoded dates: Dates must come solely from the uploaded student records/assignments.
function computeSpecialClassAttendance(cuId, allRecords = [], assignments = []) {
  // Extract unique dates strictly from database records for this student
  const attendanceDates = allRecords
    .map(r => r.attendance_date)
    .filter(Boolean);

  const assignmentDates = assignments
    .map(a => a.submission_deadline || (a.submission_date ? a.submission_date.split('T')[0] : null))
    .filter(Boolean);

  const dateSet = new Set([...attendanceDates, ...assignmentDates]);
  const sortedDates = Array.from(dateSet).sort();

  const totalSpecialDates = sortedDates.length;
  const weightPerDay = totalSpecialDates > 0 ? Math.round((100 / totalSpecialDates) * 100) / 100 : 0;

  let uploadedCount = 0;
  const specialDates = sortedDates.map((date, idx) => {
    // 1. Check attendance record
    const attRec = allRecords.find(r => r.attendance_date === date);
    // 2. Check assignment record
    const assignRec = assignments.find(a =>
      a.submission_deadline === date ||
      a.assignment_id === `ASN-${date.replace(/[^a-zA-Z0-9]/g, '-')}` ||
      (a.assignment_id && a.assignment_id.includes(date)) ||
      (a.assignment_name && a.assignment_name.includes(date))
    );

    let assignmentsUploaded = 0;
    if (attRec && attRec.assignments_uploaded !== undefined && attRec.assignments_uploaded !== null) {
      const parsed = parseInt(attRec.assignments_uploaded, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        assignmentsUploaded = parsed;
      }
    } else if (attRec && (attRec.status === 'Present' || attRec.present_sessions > 0)) {
      assignmentsUploaded = 1;
    } else if (assignRec && (assignRec.submission_status || '').toLowerCase().includes('submit')) {
      const match = (assignRec.remarks || '').match(/Uploaded\s+(\d+)\s+assignment/i);
      assignmentsUploaded = match ? parseInt(match[1], 10) : 1;
    }

    // User requirement:
    // If number of assignments uploaded > 0 or marked Present, student is Present.
    // Otherwise Absent with 0 uploaded.
    const isPresent = assignmentsUploaded > 0 || (attRec && attRec.status === 'Present');
    const isUploaded = isPresent;
    if (isUploaded) {
      uploadedCount++;
      if (assignmentsUploaded === 0) assignmentsUploaded = 1;
    } else {
      assignmentsUploaded = 0;
    }

    return {
      date,
      formattedDate: ExcelProcessor.formatDisplayDate(date) || date,
      dayNumber: idx + 1,
      assignmentsUploaded,
      isUploaded,
      status: isUploaded ? 'Present' : 'Absent',
      submissionStatus: isUploaded ? 'Submitted' : 'Pending',
      weight: weightPerDay,
      percentageContribution: isUploaded ? weightPerDay : 0,
      recordId: attRec ? attRec.id : null,
      assignmentId: assignRec ? assignRec.assignment_id : `ASN-${date.replace(/[^a-zA-Z0-9]/g, '-')}`,
    };
  });

  const specialAttendancePercentage = totalSpecialDates > 0
    ? Math.min(100, Math.round((uploadedCount * (100 / totalSpecialDates)) * 10) / 10)
    : 0;
  const pendingCount = Math.max(0, totalSpecialDates - uploadedCount);

  return {
    totalSpecialDates,
    uploadedCount,
    pendingCount,
    weightPerDay,
    specialAttendancePercentage,
    specialDates,
  };
}

// ==========================================
// STUDENT PANEL ROUTES
// ==========================================

// Get Student Profile
app.get('/api/students/:cu_id', requireStudentOrAdmin, async (req, res) => {
  const student = await findStudentInDb(req.params.cu_id);

  if (!student) {
    return res.status(404).json({ error: 'Student record not found' });
  }

  const cuId = student.cu_id;
  const allRecords = await db.all('SELECT * FROM attendance_records WHERE cu_id = ?', [cuId]);
  const assignments = await db.all('SELECT * FROM assignments WHERE cu_id = ?', [cuId]);
  const specialClassAttendance = computeSpecialClassAttendance(cuId, allRecords, assignments);

  res.json({
    student: {
      ...student,
      special_class_attendance: specialClassAttendance,
    }
  });
});

// Get Student Attendance (Special Exam Dates Tracker + Complete breakdown)
app.get('/api/students/:cu_id/attendance', requireStudentOrAdmin, async (req, res) => {
  const student = await findStudentInDb(req.params.cu_id);

  if (!student) {
    return res.status(404).json({ error: 'Student record not found' });
  }

  const cuId = student.cu_id;

  // All attendance records ordered by date descending
  const allRecords = await db.all(`
    SELECT * FROM attendance_records
    WHERE cu_id = ?
    ORDER BY attendance_date DESC, created_at DESC
  `, [cuId]);

  // All assignments for this student
  const assignments = await db.all(`
    SELECT * FROM assignments
    WHERE cu_id = ?
    ORDER BY submission_deadline ASC, created_at DESC
  `, [cuId]);

  const specialClassAttendance = computeSpecialClassAttendance(cuId, allRecords, assignments);

  // Merge special dates with any historical attendance dates
  const trackerDates = specialClassAttendance.specialDates.map(s => s.date);
  const otherDates = allRecords.map(r => r.attendance_date);
  const allUniqueDates = [...new Set([...trackerDates, ...otherDates])];

  // Daily summaries: include special exam dates with assignments uploaded on each day
  const dailySummaries = allUniqueDates.map(date => {
    const dayRecords = allRecords.filter(r => r.attendance_date === date);
    const specialInfo = specialClassAttendance.specialDates.find(s => s.date === date);

    let totalHeld = 0;
    let totalPresent = 0;
    let totalAbsent = 0;

    for (const rec of dayRecords) {
      totalHeld += Number(rec.total_sessions || 0);
      totalPresent += Number(rec.present_sessions || 0);
      totalAbsent += Number(rec.absent_sessions || 0);
    }

    if (totalHeld === 0 && specialInfo) {
      totalHeld = 1;
      totalPresent = specialInfo.isUploaded ? 1 : 0;
      totalAbsent = specialInfo.isUploaded ? 0 : 1;
    }

    const dayPct = totalHeld > 0 ? Math.round(((totalPresent / totalHeld) * 100) * 10) / 10 : 0;
    const dayStatus = totalPresent === totalHeld ? 'Present' : totalPresent === 0 ? 'Absent' : 'Partial';

    return {
      date,
      formattedDate: ExcelProcessor.formatDisplayDate(date) || date,
      totalHeld,
      totalPresent,
      totalAbsent,
      percentage: dayPct,
      status: dayStatus,
      assignmentsUploaded: specialInfo ? specialInfo.assignmentsUploaded : (dayStatus === 'Present' ? 1 : 0),
      percentageContribution: specialInfo ? specialInfo.percentageContribution : 0,
      sessions: dayRecords.length > 0 ? dayRecords : [
        {
          id: `spec-${date}`,
          cu_id: cuId,
          attendance_date: date,
          subject: 'Special Class & Exam Assignment',
          total_sessions: totalHeld,
          present_sessions: totalPresent,
          absent_sessions: totalAbsent,
          attendance_percentage: dayPct,
          status: dayStatus,
          created_at: new Date().toISOString(),
        }
      ],
    };
  });

  const latestFiveDates = allUniqueDates.slice(0, 5);
  const lastFiveDaysRecords = allRecords.filter(r => latestFiveDates.includes(r.attendance_date));

  res.json({
    latestFiveDates,
    dailySummaries,
    lastFiveDaysRecords,
    totalRecords: allRecords.length,
    hasRecords: allRecords.length > 0 || specialClassAttendance.totalSpecialDates > 0,
    specialClassAttendance,
  });
});

// Get Student Special Assignments
app.get('/api/students/:cu_id/assignments', requireStudentOrAdmin, async (req, res) => {
  const student = await findStudentInDb(req.params.cu_id);

  if (!student) {
    return res.status(404).json({ error: 'Student record not found' });
  }

  const cuId = student.cu_id;

  const allRecords = await db.all(`
    SELECT * FROM attendance_records
    WHERE cu_id = ?
    ORDER BY attendance_date DESC
  `, [cuId]);

  const assignments = await db.all(`
    SELECT * FROM assignments
    WHERE cu_id = ?
    ORDER BY submission_deadline ASC, created_at DESC
  `, [cuId]);

  const specialClassAttendance = computeSpecialClassAttendance(cuId, allRecords, assignments);

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

  const effectiveTotal = Math.max(assignments.length, specialClassAttendance.totalSpecialDates);
  const effectiveSubmitted = Math.max(submittedCount, specialClassAttendance.uploadedCount);
  const effectivePending = Math.max(0, effectiveTotal - effectiveSubmitted);

  res.json({
    totalSpecialAssignments: effectiveTotal,
    submittedCount: effectiveSubmitted,
    pendingCount: effectivePending,
    lateCount,
    naCount,
    specialClassAttendance,
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

    // Automatically keep bundled offline database in sync with newest dataset
    try {
      const { spawn } = await import('child_process');
      const exportScript = path.join(__dirname, '..', 'scripts', 'export-bundled-data.js');
      const exportProc = spawn(process.execPath, [exportScript], { stdio: 'ignore' });
      exportProc.unref();
    } catch (exportErr) {
      console.warn('Could not trigger background bundle export:', exportErr);
    }

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

// Delete specific uploaded Excel dataset and its associated records
app.delete('/api/admin/excel/jobs/:id', requireAdmin, async (req, res) => {
  try {
    const result = await ExcelProcessor.deleteImportJob(req.params.id);
    realtimeHub.broadcastCollegeUpdate({
      source: 'excel_job_deleted',
      jobId: req.params.id,
      filename: result.filename,
      deletedBy: req.user?.username || req.user?.email || 'College Admin',
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: `Failed to delete import dataset: ${err.message}` });
  }
});

// Clear all imported Excel datasets, student rosters, attendance and assignments
app.delete('/api/admin/excel/clear-all', requireAdmin, async (req, res) => {
  try {
    const result = await ExcelProcessor.clearAllData();
    realtimeHub.broadcastCollegeUpdate({
      source: 'all_data_cleared',
      clearedBy: req.user?.username || req.user?.email || 'College Admin',
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: `Failed to clear all data: ${err.message}` });
  }
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

// ==========================================
// Admin to Student Broadcast & Notice System
// ==========================================

// Get all distinct student departments/branches with counts for message targeting
app.get('/api/admin/departments', requireAdmin, async (req, res) => {
  try {
    const branches = await db.all(`
      SELECT branch as name, COUNT(*) as student_count
      FROM students
      WHERE branch IS NOT NULL AND branch != ''
      GROUP BY branch
      ORDER BY branch ASC
    `);
    res.json({ departments: branches });
  } catch (err) {
    res.status(500).json({ error: `Failed to fetch departments: ${err.message}` });
  }
});

// Admin sends notice/message to All Students or a specific Department
app.post('/api/admin/messages', requireAdmin, async (req, res) => {
  const {
    message,
    sender_title = 'Message from Admin',
    target_type = 'all',
    target_value = null,
    priority = 'normal'
  } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message content cannot be blank' });
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const adminName = req.user?.username || req.user?.email || 'Dean Academic';

  try {
    await db.run(`
      INSERT INTO admin_messages (id, sender_title, message, target_type, target_value, priority, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, sender_title.trim(), message.trim(), target_type, target_value || null, priority, now, adminName]);

    const createdNotice = {
      id,
      sender_title: sender_title.trim(),
      message: message.trim(),
      target_type,
      target_value: target_value || null,
      priority,
      created_at: now,
      created_by: adminName,
    };

    // Broadcast in real-time via SSE so all online students receive the popup instantly
    realtimeHub.broadcastAdminMessage(createdNotice);

    res.json({ success: true, message: createdNotice });
  } catch (err) {
    res.status(500).json({ error: `Failed to broadcast message: ${err.message}` });
  }
});

// Admin gets list of all sent messages/notices
app.get('/api/admin/messages', requireAdmin, async (req, res) => {
  try {
    const messages = await db.all('SELECT * FROM admin_messages ORDER BY created_at DESC LIMIT 50');
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: `Failed to fetch messages: ${err.message}` });
  }
});

// Admin deletes a sent notice
app.delete('/api/admin/messages/:id', requireAdmin, async (req, res) => {
  try {
    await db.run('DELETE FROM admin_messages WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Notice deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: `Failed to delete message: ${err.message}` });
  }
});

// Student fetches active messages/announcements targeted to their department or all students
app.get('/api/students/:cu_id/messages', requireStudentOrAdmin, async (req, res) => {
  try {
    const student = await findStudentInDb(req.params.cu_id);
    if (!student) {
      return res.status(404).json({ error: 'Student record not found' });
    }

    const messages = await db.all(`
      SELECT * FROM admin_messages
      WHERE target_type = 'all'
         OR (target_type = 'department' AND (target_value = ? OR target_value = ?))
      ORDER BY created_at DESC
      LIMIT 20
    `, [student.branch || '', student.course || '']);

    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: `Failed to fetch student messages: ${err.message}` });
  }
});

// Download Android Mobile APK
app.get(['/download/SpecialAttendance.apk', '/download/apk', '/api/download/apk'], (req, res) => {
  const possiblePaths = [
    path.join(__dirname, '..', 'apk', 'SpecialAttendance.apk'),
    path.join(__dirname, '..', 'client', 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
    path.join(__dirname, '..', 'client', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
    path.join(__dirname, 'public', 'downloads', 'SpecialAttendance.apk'),
  ];

  for (const apkPath of possiblePaths) {
    if (fs.existsSync(apkPath)) {
      const stat = fs.statSync(apkPath);
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', 'attachment; filename="SpecialAttendance.apk"');
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.sendFile(path.resolve(apkPath));
    }
  }

  res.status(404).json({
    error: 'APK build is in progress or not found. Please wait a moment or build the APK first.',
  });
});


// Download Google Play Store Release Bundle (.aab)
app.get('/download/SpecialAttendance.aab', (req, res) => {
  const possiblePaths = [
    path.join(__dirname, '..', 'apk', 'SpecialAttendance.aab'),
    path.join(__dirname, '..', 'client', 'android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab'),
  ];

  for (const aabPath of possiblePaths) {
    if (fs.existsSync(aabPath)) {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="SpecialAttendance.aab"');
      return res.sendFile(aabPath);
    }
  }

  res.status(404).json({
    error: 'AAB bundle is in progress or not found.',
  });
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
