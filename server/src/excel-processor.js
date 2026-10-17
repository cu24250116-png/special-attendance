import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import db from './database.js';

// Flexible column name normalizer
function normalizeKey(str) {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_');
}

// Column aliases mapping
const COLUMN_ALIASES = {
  // Students
  cu_id: ['cu_id', 'cuid', 'student_id', 'roll_no', 'rollno', 'registration_no', 'reg_no', 'id'],
  student_name: ['student_name', 'name', 'full_name', 'candidate_name', 'student'],
  course: ['course', 'program', 'degree'],
  branch: ['branch', 'department', 'dept', 'stream', 'spec'],
  semester: ['semester', 'sem', 'term'],
  section: ['section', 'sec', 'group', 'batch'],
  email: ['email', 'email_id', 'mail'],
  phone: ['phone', 'mobile', 'contact', 'phone_number'],

  // Attendance
  attendance_date: ['attendance_date', 'date', 'session_date', 'day'],
  subject: ['subject', 'course_code', 'subject_name', 'course_name', 'module'],
  total_sessions: ['total_sessions', 'total', 'sessions', 'classes_held', 'conducted'],
  present_sessions: ['present_sessions', 'present', 'attended', 'attended_sessions'],
  absent_sessions: ['absent_sessions', 'absent', 'missed', 'missed_sessions'],
  attendance_percentage: ['attendance_percentage', 'percentage', 'pct', 'percent', '%'],
  status: ['status', 'attendance_status'],

  // Assignments
  assignment_id: ['assignment_id', 'assign_id', 'assignment_no', 'task_id', 'code'],
  assignment_name: ['assignment_name', 'title', 'assignment_title', 'task', 'topic'],
  submission_deadline: ['submission_deadline', 'deadline', 'due_date', 'due', 'last_date'],
  submission_status: ['submission_status', 'status', 'submitted_status'],
  submission_date: ['submission_date', 'submitted_on', 'submission_timestamp', 'submitted_date'],
  remarks: ['remarks', 'verification_status', 'notes', 'comments', 'feedback'],
};

export class ExcelProcessor {
  // Map an incoming row object keys using fuzzy aliases
  static mapRowFields(rawRow, expectedFieldList) {
    const mapped = {};
    const keys = Object.keys(rawRow);

    for (const expectedField of expectedFieldList) {
      const aliases = COLUMN_ALIASES[expectedField] || [expectedField];
      let foundValue = undefined;

      for (const key of keys) {
        const normKey = normalizeKey(key);
        if (aliases.includes(normKey)) {
          foundValue = rawRow[key];
          break;
        }
      }

      mapped[expectedField] = foundValue !== undefined ? foundValue : null;
    }

    return mapped;
  }

  // Parse Excel buffer into structured preview
  static parseBuffer(buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetNames = workbook.SheetNames;
    const sheetsData = {};

    for (const name of sheetNames) {
      const worksheet = workbook.Sheets[name];
      const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      sheetsData[name] = json;
    }

    return { sheetNames, sheetsData };
  }

  // Generate preview & validation summary without committing to database
  static generatePreview(buffer, customMapping = {}) {
    const { sheetNames, sheetsData } = this.parseBuffer(buffer);

    let previewStudents = [];
    let previewAttendance = [];
    let previewAssignments = [];
    let validationIssues = [];

    // Check sheets
    for (const name of sheetNames) {
      const lower = name.toLowerCase().trim();
      const rows = sheetsData[name] || [];

      if (lower.includes('student')) {
        previewStudents = rows.slice(0, 10).map((r, i) => this.mapRowFields(r, Object.keys(COLUMN_ALIASES)));
      } else if (lower.includes('attend')) {
        previewAttendance = rows.slice(0, 10).map((r, i) => this.mapRowFields(r, Object.keys(COLUMN_ALIASES)));
      } else if (lower.includes('assign')) {
        previewAssignments = rows.slice(0, 10).map((r, i) => this.mapRowFields(r, Object.keys(COLUMN_ALIASES)));
      }
    }

    // If sheets weren't named with keywords, fallback to first sheet
    if (previewStudents.length === 0 && previewAttendance.length === 0 && previewAssignments.length === 0 && sheetNames.length > 0) {
      const firstRows = sheetsData[sheetNames[0]] || [];
      previewStudents = firstRows.slice(0, 10).map(r => this.mapRowFields(r, Object.keys(COLUMN_ALIASES)));
    }

    return {
      sheetNames,
      totalRows: {
        students: (sheetsData['Students'] || sheetsData['students'] || []).length,
        attendance: (sheetsData['Attendance'] || sheetsData['attendance'] || []).length,
        assignments: (sheetsData['Assignments'] || sheetsData['assignments'] || []).length,
      },
      preview: {
        students: previewStudents,
        attendance: previewAttendance,
        assignments: previewAssignments,
      },
      validationIssues,
    };
  }

  // Format date safely
  static formatDate(val) {
    if (!val) return '';
    if (val instanceof Date) {
      return val.toISOString().split('T')[0];
    }
    const str = String(val).trim();
    // Excel numeric date check
    if (!isNaN(str) && Number(str) > 20000 && Number(str) < 60000) {
      const date = new Date(Math.round((Number(str) - 25569) * 86400 * 1000));
      return date.toISOString().split('T')[0];
    }
    // Standard string date
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    return str;
  }

  // Perform full import into database
  static async importExcel(buffer, filename, uploadedBy = 'Admin', options = { mode: 'incremental' }) {
    const { sheetNames, sheetsData } = this.parseBuffer(buffer);
    const jobId = uuidv4();
    const now = new Date().toISOString();

    let studentsUpdated = 0;
    let attendanceUpdated = 0;
    let assignmentsUpdated = 0;
    let totalRows = 0;
    const errors = [];
    const affectedCuIds = new Set();

    // Determine sheet categorizations
    let studentRows = [];
    let attendanceRows = [];
    let assignmentRows = [];

    for (const name of sheetNames) {
      const lower = name.toLowerCase().trim();
      const rows = sheetsData[name] || [];
      if (lower.includes('student')) studentRows = rows;
      else if (lower.includes('attend')) attendanceRows = rows;
      else if (lower.includes('assign')) assignmentRows = rows;
    }

    // Fallback: If single sheet contains student + attendance info
    if (studentRows.length === 0 && attendanceRows.length === 0 && sheetNames.length === 1) {
      studentRows = sheetsData[sheetNames[0]] || [];
    }

    totalRows = studentRows.length + attendanceRows.length + assignmentRows.length;

    // 1. Process Students Sheet
    for (let i = 0; i < studentRows.length; i++) {
      const raw = studentRows[i];
      const mapped = this.mapRowFields(raw, [
        'cu_id', 'student_name', 'course', 'branch', 'semester', 'section', 'email', 'phone'
      ]);

      const cuId = mapped.cu_id ? String(mapped.cu_id).trim().toUpperCase() : null;
      const studentName = mapped.student_name ? String(mapped.student_name).trim() : null;

      if (!cuId) {
        errors.push({
          sheet_name: 'Students',
          row_number: i + 2,
          cu_id: null,
          error_message: 'Missing mandatory CU_ID',
          raw_data: JSON.stringify(raw),
        });
        continue;
      }

      if (!studentName) {
        errors.push({
          sheet_name: 'Students',
          row_number: i + 2,
          cu_id: cuId,
          error_message: 'Missing mandatory Student_Name',
          raw_data: JSON.stringify(raw),
        });
        continue;
      }

      affectedCuIds.add(cuId);

      // Check existing student
      const existing = await db.get('SELECT * FROM students WHERE cu_id = ?', [cuId]);
      if (existing) {
        await db.run(`
          UPDATE students SET
            student_name = ?,
            course = COALESCE(?, course),
            branch = COALESCE(?, branch),
            semester = COALESCE(?, semester),
            section = COALESCE(?, section),
            email = COALESCE(?, email),
            phone = COALESCE(?, phone),
            last_updated = ?
          WHERE cu_id = ?
        `, [
          studentName,
          mapped.course || null,
          mapped.branch || null,
          mapped.semester || null,
          mapped.section || null,
          mapped.email || null,
          mapped.phone || null,
          now,
          cuId
        ]);
      } else {
        await db.run(`
          INSERT INTO students (
            cu_id, student_name, course, branch, semester, section, email, phone,
            overall_percentage, total_sessions, present_sessions, absent_sessions, last_updated
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?)
        `, [
          cuId,
          studentName,
          mapped.course || 'B.Tech',
          mapped.branch || 'CSE',
          mapped.semester || '5',
          mapped.section || 'A',
          mapped.email || `${cuId.toLowerCase()}@college.edu`,
          mapped.phone || '',
          now
        ]);
      }
      studentsUpdated++;
    }

    // 2. Process Attendance Sheet
    for (let i = 0; i < attendanceRows.length; i++) {
      const raw = attendanceRows[i];
      const mapped = this.mapRowFields(raw, [
        'cu_id', 'attendance_date', 'subject', 'total_sessions', 'present_sessions', 'absent_sessions', 'attendance_percentage', 'status'
      ]);

      const cuId = mapped.cu_id ? String(mapped.cu_id).trim().toUpperCase() : null;
      const date = this.formatDate(mapped.attendance_date);
      const subject = mapped.subject ? String(mapped.subject).trim() : 'General Attendance';

      if (!cuId) {
        errors.push({
          sheet_name: 'Attendance',
          row_number: i + 2,
          cu_id: null,
          error_message: 'Missing mandatory CU_ID in attendance record',
          raw_data: JSON.stringify(raw),
        });
        continue;
      }

      if (!date) {
        errors.push({
          sheet_name: 'Attendance',
          row_number: i + 2,
          cu_id: cuId,
          error_message: 'Invalid or missing Attendance_Date',
          raw_data: JSON.stringify(raw),
        });
        continue;
      }

      let total = parseInt(mapped.total_sessions, 10);
      let present = parseInt(mapped.present_sessions, 10);
      let absent = parseInt(mapped.absent_sessions, 10);

      if (isNaN(total) || total < 1) total = 1;
      if (isNaN(present)) present = isNaN(absent) ? total : Math.max(0, total - absent);
      if (isNaN(absent)) absent = Math.max(0, total - present);

      if (present > total) {
        errors.push({
          sheet_name: 'Attendance',
          row_number: i + 2,
          cu_id: cuId,
          error_message: `Present sessions (${present}) cannot exceed total sessions (${total})`,
          raw_data: JSON.stringify(raw),
        });
        continue;
      }

      const calculatedPct = total > 0 ? Math.round(((present / total) * 100) * 10) / 10 : 0;
      let pct = parseFloat(mapped.attendance_percentage);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        pct = calculatedPct;
      }

      let status = mapped.status ? String(mapped.status).trim() : (present === total ? 'Present' : present === 0 ? 'Absent' : 'Partial');

      affectedCuIds.add(cuId);

      // Check existing student; if student does not exist, create stub record
      const studentExists = await db.get('SELECT cu_id FROM students WHERE cu_id = ?', [cuId]);
      if (!studentExists) {
        await db.run(`
          INSERT INTO students (
            cu_id, student_name, course, branch, semester, section,
            overall_percentage, total_sessions, present_sessions, absent_sessions, last_updated
          ) VALUES (?, ?, 'B.Tech', 'CSE', '5', 'A', 0, 0, 0, 0, ?)
        `, [cuId, `Student ${cuId}`, now]);
      }

      // Check existing record for idempotency
      const existingRecord = await db.get(
        'SELECT id FROM attendance_records WHERE cu_id = ? AND attendance_date = ? AND subject = ?',
        [cuId, date, subject]
      );

      if (existingRecord) {
        await db.run(`
          UPDATE attendance_records SET
            total_sessions = ?,
            present_sessions = ?,
            absent_sessions = ?,
            attendance_percentage = ?,
            status = ?
          WHERE id = ?
        `, [total, present, absent, pct, status, existingRecord.id]);
      } else {
        const recordId = uuidv4();
        await db.run(`
          INSERT INTO attendance_records (
            id, cu_id, attendance_date, subject, total_sessions, present_sessions,
            absent_sessions, attendance_percentage, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [recordId, cuId, date, subject, total, present, absent, pct, status, now]);
      }
      attendanceUpdated++;
    }

    // 3. Process Assignments Sheet
    for (let i = 0; i < assignmentRows.length; i++) {
      const raw = assignmentRows[i];
      const mapped = this.mapRowFields(raw, [
        'cu_id', 'assignment_id', 'assignment_name', 'subject', 'submission_deadline',
        'submission_status', 'submission_date', 'remarks'
      ]);

      const cuId = mapped.cu_id ? String(mapped.cu_id).trim().toUpperCase() : null;
      const assignId = mapped.assignment_id ? String(mapped.assignment_id).trim() : `ASN-${i + 1}`;
      const title = mapped.assignment_name ? String(mapped.assignment_name).trim() : 'Special Assignment';
      const subject = mapped.subject ? String(mapped.subject).trim() : 'Core Subject';
      const deadline = this.formatDate(mapped.submission_deadline) || '2026-10-31';

      if (!cuId) {
        errors.push({
          sheet_name: 'Assignments',
          row_number: i + 2,
          cu_id: null,
          error_message: 'Missing mandatory CU_ID in assignment record',
          raw_data: JSON.stringify(raw),
        });
        continue;
      }

      let status = mapped.submission_status ? String(mapped.submission_status).trim() : 'Pending';
      // Normalize status
      const lowerStatus = status.toLowerCase();
      if (lowerStatus.includes('submit')) status = 'Submitted';
      else if (lowerStatus.includes('late')) status = 'Late';
      else if (lowerStatus.includes('na') || lowerStatus.includes('not')) status = 'Not Applicable';
      else status = 'Pending';

      const submissionDate = this.formatDate(mapped.submission_date) || (status === 'Submitted' ? now.split('T')[0] : null);
      const remarks = mapped.remarks ? String(mapped.remarks).trim() : '';

      affectedCuIds.add(cuId);

      // Verify student existence
      const studentExists = await db.get('SELECT cu_id FROM students WHERE cu_id = ?', [cuId]);
      if (!studentExists) {
        await db.run(`
          INSERT INTO students (
            cu_id, student_name, course, branch, semester, section,
            overall_percentage, total_sessions, present_sessions, absent_sessions, last_updated
          ) VALUES (?, ?, 'B.Tech', 'CSE', '5', 'A', 0, 0, 0, 0, ?)
        `, [cuId, `Student ${cuId}`, now]);
      }

      // Check existing assignment by CU_ID and Assignment_ID
      const existingAssign = await db.get(
        'SELECT id FROM assignments WHERE cu_id = ? AND assignment_id = ?',
        [cuId, assignId]
      );

      if (existingAssign) {
        await db.run(`
          UPDATE assignments SET
            assignment_name = ?,
            subject = ?,
            submission_deadline = ?,
            submission_status = ?,
            submission_date = ?,
            remarks = ?
          WHERE id = ?
        `, [title, subject, deadline, status, submissionDate, remarks, existingAssign.id]);
      } else {
        const id = uuidv4();
        await db.run(`
          INSERT INTO assignments (
            id, assignment_id, cu_id, assignment_name, subject, submission_deadline,
            submission_status, submission_date, remarks, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, assignId, cuId, title, subject, deadline, status, submissionDate, remarks, now]);
      }
      assignmentsUpdated++;
    }

    // 4. Recalculate overall attendance percentage accurately for all affected students
    for (const cuId of affectedCuIds) {
      const records = await db.all(`
        SELECT total_sessions, present_sessions, absent_sessions
        FROM attendance_records
        WHERE cu_id = ?
      `, [cuId]);

      if (records && records.length > 0) {
        let totalHeld = 0;
        let totalPresent = 0;
        let totalAbsent = 0;

        for (const rec of records) {
          totalHeld += Number(rec.total_sessions || 0);
          totalPresent += Number(rec.present_sessions || 0);
          totalAbsent += Number(rec.absent_sessions || 0);
        }

        const overallPct = totalHeld > 0 ? Math.round(((totalPresent / totalHeld) * 100) * 10) / 10 : 0;

        await db.run(`
          UPDATE students SET
            total_sessions = ?,
            present_sessions = ?,
            absent_sessions = ?,
            overall_percentage = ?,
            last_updated = ?
          WHERE cu_id = ?
        `, [totalHeld, totalPresent, totalAbsent, overallPct, now, cuId]);
      }
    }

    // 5. Save Import Job Record
    const status = errors.length === 0 ? 'success' : (studentsUpdated + attendanceUpdated + assignmentsUpdated > 0 ? 'partial' : 'failed');
    await db.run(`
      INSERT INTO import_jobs (
        id, filename, uploaded_by, import_type, status, total_rows,
        students_updated, attendance_updated, assignments_updated, errors_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      jobId, filename, uploadedBy, options.type || 'admin_upload', status, totalRows,
      studentsUpdated, attendanceUpdated, assignmentsUpdated, errors.length, now
    ]);

    // 6. Save Import Errors if any
    for (const err of errors) {
      await db.run(`
        INSERT INTO import_errors (id, job_id, sheet_name, row_number, cu_id, error_message, raw_data)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [uuidv4(), jobId, err.sheet_name, err.row_number, err.cu_id, err.error_message, err.raw_data]);
    }

    // 7. Save Audit Log
    await db.run(`
      INSERT INTO audit_logs (id, user_id, action, details, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [
      uuidv4(), uploadedBy, 'EXCEL_IMPORT',
      `Imported ${filename}: ${studentsUpdated} students, ${attendanceUpdated} attendance rows, ${assignmentsUpdated} assignments, ${errors.length} errors`,
      now
    ]);

    return {
      jobId,
      status,
      filename,
      totalRows,
      studentsUpdated,
      attendanceUpdated,
      assignmentsUpdated,
      errorsCount: errors.length,
      errors: errors.slice(0, 50),
      affectedStudents: Array.from(affectedCuIds),
    };
  }

  // Generate official downloadable Excel Template (.xlsx) with ExcelJS
  static async generateOfficialTemplate() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'College ERP Administration';
    workbook.created = new Date();

    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }, // Navy Blue
      alignment: { vertical: 'middle', horizontal: 'center' },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' },
      },
    };

    // Sheet 1: Students
    const studentSheet = workbook.addWorksheet('Students', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    studentSheet.columns = [
      { header: 'CU_ID', key: 'cu_id', width: 16 },
      { header: 'Student_Name', key: 'student_name', width: 26 },
      { header: 'Course', key: 'course', width: 14 },
      { header: 'Branch', key: 'branch', width: 22 },
      { header: 'Semester', key: 'semester', width: 12 },
      { header: 'Section', key: 'section', width: 12 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Phone', key: 'phone', width: 16 },
    ];
    studentSheet.getRow(1).eachCell(cell => Object.assign(cell, headerStyle));
    studentSheet.addRows([
      { cu_id: 'CU2024001', student_name: 'Aarav Sharma', course: 'B.Tech', branch: 'Computer Science', semester: '5', section: 'A', email: 'aarav.sharma@college.edu', phone: '9876543210' },
      { cu_id: 'CU2024002', student_name: 'Ananya Verma', course: 'B.Tech', branch: 'Artificial Intelligence', semester: '5', section: 'B', email: 'ananya.v@college.edu', phone: '9876543211' },
      { cu_id: 'CU2024003', student_name: 'Rahul Raj', course: 'B.Tech', branch: 'Computer Science', semester: '5', section: 'A', email: 'rahul.raj@college.edu', phone: '9876543212' },
      { cu_id: 'CU2024004', student_name: 'Priya Nair', course: 'B.Tech', branch: 'Information Technology', semester: '5', section: 'A', email: 'priya.nair@college.edu', phone: '9876543213' },
      { cu_id: 'CU2024005', student_name: 'Dev Patel', course: 'B.Tech', branch: 'Electronics & Comm', semester: '5', section: 'C', email: 'dev.patel@college.edu', phone: '9876543214' },
    ]);

    // Sheet 2: Attendance
    const attendSheet = workbook.addWorksheet('Attendance', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    attendSheet.columns = [
      { header: 'CU_ID', key: 'cu_id', width: 16 },
      { header: 'Attendance_Date', key: 'attendance_date', width: 18 },
      { header: 'Subject', key: 'subject', width: 28 },
      { header: 'Total_Sessions', key: 'total_sessions', width: 16 },
      { header: 'Present_Sessions', key: 'present_sessions', width: 16 },
      { header: 'Absent_Sessions', key: 'absent_sessions', width: 16 },
      { header: 'Attendance_Percentage', key: 'attendance_percentage', width: 22 },
      { header: 'Status', key: 'status', width: 14 },
    ];
    attendSheet.getRow(1).eachCell(cell => Object.assign(cell, headerStyle));
    attendSheet.addRows([
      { cu_id: 'CU2024001', attendance_date: '2026-10-17', subject: 'Machine Learning', total_sessions: 2, present_sessions: 2, absent_sessions: 0, attendance_percentage: 100, status: 'Present' },
      { cu_id: 'CU2024001', attendance_date: '2026-10-16', subject: 'Distributed Systems', total_sessions: 2, present_sessions: 2, absent_sessions: 0, attendance_percentage: 100, status: 'Present' },
      { cu_id: 'CU2024001', attendance_date: '2026-10-15', subject: 'Cloud Computing Lab', total_sessions: 3, present_sessions: 3, absent_sessions: 0, attendance_percentage: 100, status: 'Present' },
      { cu_id: 'CU2024001', attendance_date: '2026-10-14', subject: 'Cyber Security', total_sessions: 2, present_sessions: 1, absent_sessions: 1, attendance_percentage: 50, status: 'Partial' },
      { cu_id: 'CU2024001', attendance_date: '2026-10-13', subject: 'Software Architecture', total_sessions: 2, present_sessions: 2, absent_sessions: 0, attendance_percentage: 100, status: 'Present' },
      { cu_id: 'CU2024003', attendance_date: '2026-10-17', subject: 'Machine Learning', total_sessions: 2, present_sessions: 2, absent_sessions: 0, attendance_percentage: 100, status: 'Present' },
      { cu_id: 'CU2024003', attendance_date: '2026-10-16', subject: 'Distributed Systems', total_sessions: 2, present_sessions: 2, absent_sessions: 0, attendance_percentage: 100, status: 'Present' },
      { cu_id: 'CU2024003', attendance_date: '2026-10-15', subject: 'Cloud Computing Lab', total_sessions: 3, present_sessions: 2, absent_sessions: 1, attendance_percentage: 66.7, status: 'Partial' },
      { cu_id: 'CU2024003', attendance_date: '2026-10-14', subject: 'Cyber Security', total_sessions: 2, present_sessions: 2, absent_sessions: 0, attendance_percentage: 100, status: 'Present' },
      { cu_id: 'CU2024003', attendance_date: '2026-10-13', subject: 'Software Architecture', total_sessions: 2, present_sessions: 2, absent_sessions: 0, attendance_percentage: 100, status: 'Present' },
    ]);

    // Sheet 3: Assignments
    const assignSheet = workbook.addWorksheet('Assignments', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    assignSheet.columns = [
      { header: 'CU_ID', key: 'cu_id', width: 16 },
      { header: 'Assignment_ID', key: 'assignment_id', width: 16 },
      { header: 'Assignment_Name', key: 'assignment_name', width: 34 },
      { header: 'Subject', key: 'subject', width: 28 },
      { header: 'Submission_Deadline', key: 'submission_deadline', width: 20 },
      { header: 'Submission_Status', key: 'submission_status', width: 20 },
      { header: 'Submission_Date', key: 'submission_date', width: 18 },
      { header: 'Remarks', key: 'remarks', width: 30 },
    ];
    assignSheet.getRow(1).eachCell(cell => Object.assign(cell, headerStyle));
    assignSheet.addRows([
      { cu_id: 'CU2024001', assignment_id: 'ASN-ML-01', assignment_name: 'Special Assignment: Neural Network Backprop', subject: 'Machine Learning', submission_deadline: '2026-10-25', submission_status: 'Submitted', submission_date: '2026-10-16', remarks: 'Verified by Prof. Sharma' },
      { cu_id: 'CU2024001', assignment_id: 'ASN-DS-02', assignment_name: 'Raft Consensus Protocol Simulation', subject: 'Distributed Systems', submission_deadline: '2026-10-28', submission_status: 'Pending', submission_date: '', remarks: 'Initial draft received' },
      { cu_id: 'CU2024003', assignment_id: 'ASN-ML-01', assignment_name: 'Special Assignment: Neural Network Backprop', subject: 'Machine Learning', submission_deadline: '2026-10-25', submission_status: 'Submitted', submission_date: '2026-10-15', remarks: 'Grade A+ awarded' },
      { cu_id: 'CU2024003', assignment_id: 'ASN-DS-02', assignment_name: 'Raft Consensus Protocol Simulation', subject: 'Distributed Systems', submission_deadline: '2026-10-28', submission_status: 'Submitted', submission_date: '2026-10-16', remarks: 'Excellent implementation' },
      { cu_id: 'CU2024003', assignment_id: 'ASN-CS-03', assignment_name: 'Vulnerability Assessment Audit Report', subject: 'Cyber Security', submission_deadline: '2026-10-22', submission_status: 'Pending', submission_date: '', remarks: 'Submission required by Friday' },
    ]);

    return await workbook.xlsx.writeBuffer();
  }

  // Generate Error Report Excel (.xlsx)
  static async generateErrorReport(jobId) {
    const job = await db.get('SELECT * FROM import_jobs WHERE id = ?', [jobId]);
    const errors = await db.all('SELECT * FROM import_errors WHERE job_id = ? ORDER BY row_number ASC', [jobId]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'College ERP Administration';
    const sheet = workbook.addWorksheet('Import Errors');

    sheet.columns = [
      { header: 'Sheet Name', key: 'sheet_name', width: 18 },
      { header: 'Row #', key: 'row_number', width: 10 },
      { header: 'CU_ID', key: 'cu_id', width: 16 },
      { header: 'Error Description', key: 'error_message', width: 45 },
      { header: 'Raw Row Data', key: 'raw_data', width: 50 },
    ];

    const errHeaderStyle = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } }, // Red
      alignment: { vertical: 'middle', horizontal: 'center' },
    };
    sheet.getRow(1).eachCell(cell => Object.assign(cell, errHeaderStyle));

    for (const err of errors) {
      sheet.addRow(err);
    }

    return await workbook.xlsx.writeBuffer();
  }
}

export default ExcelProcessor;
