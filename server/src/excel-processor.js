import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import db from './database.js';
import { hashPassword } from './auth.js';

// Flexible column name normalizer
function normalizeKey(str) {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_');
}

// Column aliases mapping for flexible header matching
const COLUMN_ALIASES = {
  // Students
  roll_number: ['roll_number', 'roll_no', 'rollno', 'roll', 'class_roll_no', 'univ_roll_no', 'university_roll_no', 's_no', 'serial_no', 'sno'],
  cu_id: ['cu_id', 'cuid', 'student_id', 'studentid', 'student_id_no', 'college_id', 'registration_no', 'reg_no', 'enrollment_no', 'id'],
  student_name: ['student_name', 'name', 'full_name', 'candidate_name', 'student', 'studentname'],
  father_name: ['father_name', 'father_s_name', 'fathers_name', 'fathername', 'father', 'guardian_name', 'parent_name'],
  course: ['course', 'program', 'degree', 'class'],
  branch: ['branch', 'department', 'dept', 'stream', 'spec'],
  semester: ['semester', 'sem', 'term'],
  section: ['section', 'sec', 'group', 'batch'],
  email: ['email', 'email_id', 'mail'],
  phone: ['phone', 'mobile', 'contact', 'phone_number'],

  // Attendance in student master sheet
  total_sessions: ['class_conducted', 'classes_conducted', 'total_classes', 'total_sessions', 'total', 'sessions', 'classes_held', 'conducted', 'held'],
  present_sessions: ['total_present', 'present', 'present_sessions', 'attended', 'attended_sessions'],
  absent_sessions: ['total_absent', 'absent', 'absent_sessions', 'missed', 'missed_sessions'],
  attendance_percentage: ['total_percentage', 'percentage', 'attendance_percentage', 'pct', 'percent', '%', 'total_%', 'overall_percentage', 'att_%'],
  status: ['status', 'attendance_status'],

  // Attendance specific sheet
  attendance_date: ['attendance_date', 'date', 'session_date', 'day'],
  subject: ['subject', 'course_code', 'subject_name', 'course_name', 'module'],

  // Assignments
  assignment_id: ['assignment_id', 'assign_id', 'assignment_no', 'task_id', 'code'],
  assignment_name: ['assignment_name', 'title', 'assignment_title', 'task', 'topic'],
  submission_deadline: ['submission_deadline', 'deadline', 'due_date', 'due', 'last_date'],
  submission_status: ['submission_status', 'status', 'submitted_status'],
  submission_date: ['submission_date', 'submitted_on', 'submission_timestamp', 'submitted_date'],
  remarks: ['remarks', 'verification_status', 'notes', 'comments', 'feedback'],
};

// Check if a column header represents an attendance date or special class
function isDateColumnHeader(key) {
  if (!key) return false;
  const k = String(key).trim();
  const normKey = normalizeKey(k);

  // Exclude known metadata columns
  for (const list of Object.values(COLUMN_ALIASES)) {
    if (list.includes(normKey)) return false;
  }

  // Check date patterns like 15/10/2024, 2024-10-15, 15-10-24, 15.10.2024, 15/10, etc.
  if (/\b\d{1,4}[-/.]\d{1,2}([-/.]\d{1,4})?\b/.test(k)) return true;
  // Check month words like 15-Oct, 15 Oct, Oct-15, etc.
  if (/\b\d{1,2}[-/\s]?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(k)) return true;
  // Check explicit naming
  if (/(date|special.*class|class.*date|session)/i.test(k)) return true;

  // Check if string can parse as calendar date
  const d = new Date(k);
  if (!isNaN(d.getTime()) && d.getFullYear() >= 2020 && d.getFullYear() <= 2035) return true;

  return false;
}

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
  static generatePreview(buffer) {
    const { sheetNames, sheetsData } = this.parseBuffer(buffer);

    let previewStudents = [];
    let previewAttendance = [];
    let previewAssignments = [];
    const validationIssues = [];

    // Check sheets
    for (const name of sheetNames) {
      const lower = name.toLowerCase().trim();
      const rows = sheetsData[name] || [];

      if (lower.includes('student') || sheetNames.length === 1) {
        previewStudents = rows.slice(0, 10).map((r) => this.mapRowFields(r, [
          'roll_number', 'cu_id', 'student_name', 'father_name', 'course', 'branch',
          'semester', 'section', 'total_sessions', 'present_sessions', 'attendance_percentage'
        ]));
      } else if (lower.includes('attend')) {
        previewAttendance = rows.slice(0, 10).map((r) => this.mapRowFields(r, Object.keys(COLUMN_ALIASES)));
      } else if (lower.includes('assign')) {
        previewAssignments = rows.slice(0, 10).map((r) => this.mapRowFields(r, Object.keys(COLUMN_ALIASES)));
      }
    }

    if (previewStudents.length === 0 && sheetNames.length > 0) {
      const firstRows = sheetsData[sheetNames[0]] || [];
      previewStudents = firstRows.slice(0, 10).map((r) => this.mapRowFields(r, Object.keys(COLUMN_ALIASES)));
    }

    return {
      sheetNames,
      totalRows: {
        students: (sheetsData['Students'] || sheetsData['students'] || sheetsData[sheetNames[0]] || []).length,
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

    // Fallback: If single sheet uploaded (like the user's master Excel)
    if (studentRows.length === 0 && sheetNames.length > 0) {
      studentRows = sheetsData[sheetNames[0]] || [];
    }

    totalRows = studentRows.length + attendanceRows.length + assignmentRows.length;

    // 1. Process Students & Embedded Special Class Date Columns
    for (let i = 0; i < studentRows.length; i++) {
      const raw = studentRows[i];
      const mapped = this.mapRowFields(raw, [
        'roll_number', 'cu_id', 'student_name', 'father_name', 'course', 'branch',
        'semester', 'section', 'email', 'phone', 'total_sessions', 'present_sessions',
        'absent_sessions', 'attendance_percentage'
      ]);

      // CU ID priority: cu_id -> student_id -> roll_number
      let cuId = mapped.cu_id ? String(mapped.cu_id).trim().toUpperCase() : null;
      if (!cuId && mapped.roll_number) {
        cuId = String(mapped.roll_number).trim().toUpperCase();
      }

      const studentName = mapped.student_name ? String(mapped.student_name).trim() : null;

      if (!cuId) {
        errors.push({
          sheet_name: 'Students',
          row_number: i + 2,
          cu_id: null,
          error_message: 'Missing mandatory Student ID / CU ID / Roll Number',
          raw_data: JSON.stringify(raw),
        });
        continue;
      }

      if (!studentName) {
        errors.push({
          sheet_name: 'Students',
          row_number: i + 2,
          cu_id: cuId,
          error_message: 'Missing mandatory Student Name',
          raw_data: JSON.stringify(raw),
        });
        continue;
      }

      affectedCuIds.add(cuId);

      // Student Password: By default, the student's password is their CU ID (or roll number)
      const defaultPassword = cuId;
      const studentPasswordHash = hashPassword(defaultPassword);

      // Extract special class date columns in this student row
      const rawKeys = Object.keys(raw);
      const dateColumns = rawKeys.filter((k) => isDateColumnHeader(k));

      let embeddedHeldCount = 0;
      let embeddedPresentCount = 0;

      for (const dateKey of dateColumns) {
        const cellVal = String(raw[dateKey] || '').trim().toUpperCase();
        if (!cellVal) continue; // empty cell, no record for this date

        embeddedHeldCount++;
        const isPresent = cellVal === 'P' || cellVal === 'PRESENT' || cellVal === '1' || cellVal === 'YES';
        if (isPresent) embeddedPresentCount++;

        const formattedDate = this.formatDate(dateKey) || dateKey;
        const status = isPresent ? 'Present' : 'Absent';
        const pct = isPresent ? 100 : 0;
        const presentCount = isPresent ? 1 : 0;
        const absentCount = isPresent ? 0 : 1;

        // Upsert attendance record for this special class date
        const existingAtt = await db.get(
          'SELECT id FROM attendance_records WHERE cu_id = ? AND attendance_date = ?',
          [cuId, formattedDate]
        );

        if (existingAtt) {
          await db.run(`
            UPDATE attendance_records SET
              total_sessions = 1,
              present_sessions = ?,
              absent_sessions = ?,
              attendance_percentage = ?,
              status = ?
            WHERE id = ?
          `, [presentCount, absentCount, pct, status, existingAtt.id]);
        } else {
          await db.run(`
            INSERT INTO attendance_records (
              id, cu_id, attendance_date, subject, total_sessions, present_sessions,
              absent_sessions, attendance_percentage, status, created_at
            ) VALUES (?, ?, ?, 'Special Class', 1, ?, ?, ?, ?, ?)
          `, [uuidv4(), cuId, formattedDate, presentCount, absentCount, pct, status, now]);
        }
        attendanceUpdated++;
      }

      // Calculate totals: prioritize explicit columns if present; otherwise use embedded counts
      let totalHeld = parseInt(mapped.total_sessions, 10);
      let totalPres = parseInt(mapped.present_sessions, 10);
      let totalAbs = parseInt(mapped.absent_sessions, 10);

      if (isNaN(totalHeld) || totalHeld <= 0) {
        totalHeld = embeddedHeldCount > 0 ? embeddedHeldCount : 0;
      }
      if (isNaN(totalPres)) {
        totalPres = embeddedPresentCount;
      }
      if (isNaN(totalAbs)) {
        totalAbs = Math.max(0, totalHeld - totalPres);
      }

      // Calculate percentage
      let finalPercentage = parseFloat(mapped.attendance_percentage);
      if (isNaN(finalPercentage) || finalPercentage <= 0) {
        finalPercentage = totalHeld > 0 ? Math.round(((totalPres / totalHeld) * 100) * 10) / 10 : 0;
      }

      // Upsert student record
      const existing = await db.get('SELECT * FROM students WHERE cu_id = ?', [cuId]);
      if (existing) {
        await db.run(`
          UPDATE students SET
            student_name = ?,
            roll_number = COALESCE(?, roll_number),
            father_name = COALESCE(?, father_name),
            course = COALESCE(?, course),
            branch = COALESCE(?, branch),
            semester = COALESCE(?, semester),
            section = COALESCE(?, section),
            email = COALESCE(?, email),
            phone = COALESCE(?, phone),
            password_hash = COALESCE(password_hash, ?),
            overall_percentage = ?,
            total_sessions = ?,
            present_sessions = ?,
            absent_sessions = ?,
            last_updated = ?
          WHERE cu_id = ?
        `, [
          studentName,
          mapped.roll_number || null,
          mapped.father_name || null,
          mapped.course || null,
          mapped.branch || mapped.course || null,
          mapped.semester || null,
          mapped.section || null,
          mapped.email || null,
          mapped.phone || null,
          studentPasswordHash,
          finalPercentage,
          totalHeld,
          totalPres,
          totalAbs,
          now,
          cuId
        ]);
      } else {
        await db.run(`
          INSERT INTO students (
            cu_id, student_name, roll_number, father_name, course, branch, semester, section,
            email, phone, password_hash, overall_percentage, total_sessions, present_sessions,
            absent_sessions, last_updated
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          cuId,
          studentName,
          mapped.roll_number || cuId,
          mapped.father_name || '',
          mapped.course || 'B.Tech',
          mapped.branch || mapped.course || 'General',
          mapped.semester || '1',
          mapped.section || 'A',
          mapped.email || `${cuId.toLowerCase()}@college.edu`,
          mapped.phone || '',
          studentPasswordHash,
          finalPercentage,
          totalHeld,
          totalPres,
          totalAbs,
          now
        ]);
      }
      studentsUpdated++;
    }

    // 2. Process Separate Attendance Sheet (if provided)
    for (let i = 0; i < attendanceRows.length; i++) {
      const raw = attendanceRows[i];
      const mapped = this.mapRowFields(raw, [
        'cu_id', 'roll_number', 'attendance_date', 'subject', 'total_sessions',
        'present_sessions', 'absent_sessions', 'attendance_percentage', 'status'
      ]);

      const cuId = (mapped.cu_id || mapped.roll_number) ? String(mapped.cu_id || mapped.roll_number).trim().toUpperCase() : null;
      const date = this.formatDate(mapped.attendance_date);
      const subject = mapped.subject ? String(mapped.subject).trim() : 'Special Class';

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

      const calculatedPct = total > 0 ? Math.round(((present / total) * 100) * 10) / 10 : 0;
      let pct = parseFloat(mapped.attendance_percentage);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        pct = calculatedPct;
      }

      let status = mapped.status ? String(mapped.status).trim() : (present === total ? 'Present' : present === 0 ? 'Absent' : 'Partial');

      affectedCuIds.add(cuId);

      // Check student existence
      const studentExists = await db.get('SELECT cu_id FROM students WHERE cu_id = ?', [cuId]);
      if (!studentExists) {
        const studentPasswordHash = hashPassword(cuId);
        await db.run(`
          INSERT INTO students (
            cu_id, student_name, course, branch, semester, section, password_hash,
            overall_percentage, total_sessions, present_sessions, absent_sessions, last_updated
          ) VALUES (?, ?, 'Course', 'General', '1', 'A', ?, 0, 0, 0, 0, ?)
        `, [cuId, `Student ${cuId}`, studentPasswordHash, now]);
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

    // 3. Process Assignments Sheet (if present)
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
        const studentPasswordHash = hashPassword(cuId);
        await db.run(`
          INSERT INTO students (
            cu_id, student_name, course, branch, semester, section, password_hash,
            overall_percentage, total_sessions, present_sessions, absent_sessions, last_updated
          ) VALUES (?, ?, 'Course', 'General', '1', 'A', ?, 0, 0, 0, 0, ?)
        `, [cuId, `Student ${cuId}`, studentPasswordHash, now]);
      }

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

    // 4. Save Import Job Record
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

    // 5. Save Errors if any
    for (const err of errors) {
      await db.run(`
        INSERT INTO import_errors (id, job_id, sheet_name, row_number, cu_id, error_message, raw_data)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [uuidv4(), jobId, err.sheet_name, err.row_number, err.cu_id, err.error_message, err.raw_data]);
    }

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

  // Generate official downloadable Excel Template (.xlsx) matching user columns
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

    // Primary Sheet: Student Attendance Master (Format requested by User)
    const masterSheet = workbook.addWorksheet('Attendance_Master', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    masterSheet.columns = [
      { header: 'Roll_Number', key: 'roll_number', width: 14 },
      { header: 'Student_ID', key: 'student_id', width: 16 },
      { header: 'Student_Name', key: 'student_name', width: 24 },
      { header: 'Father_Name', key: 'father_name', width: 22 },
      { header: 'Course', key: 'course', width: 14 },
      { header: 'Semester', key: 'semester', width: 12 },
      { header: 'Section', key: 'section', width: 10 },
      { header: 'Class_Conducted', key: 'class_conducted', width: 16 },
      { header: 'Total_Present', key: 'total_present', width: 14 },
      { header: 'Total_Percentage', key: 'total_percentage', width: 18 },
      { header: '15/10/2024', key: 'date_1', width: 14 },
      { header: '16/10/2024', key: 'date_2', width: 14 },
      { header: '17/10/2024', key: 'date_3', width: 14 },
      { header: '18/10/2024', key: 'date_4', width: 14 },
      { header: '19/10/2024', key: 'date_5', width: 14 },
    ];

    masterSheet.getRow(1).eachCell(cell => Object.assign(cell, headerStyle));

    masterSheet.addRows([
      {
        roll_number: '101',
        student_id: 'CU2024001',
        student_name: 'Rahul Raj',
        father_name: 'R. K. Sharma',
        course: 'B.Tech',
        semester: '5',
        section: 'A',
        class_conducted: 20,
        total_present: 18,
        total_percentage: 90,
        date_1: 'P',
        date_2: 'P',
        date_3: 'P',
        date_4: 'P',
        date_5: 'P',
      },
      {
        roll_number: '102',
        student_id: 'CU2024002',
        student_name: 'Aarav Sharma',
        father_name: 'S. K. Sharma',
        course: 'B.Tech',
        semester: '5',
        section: 'A',
        class_conducted: 20,
        total_present: 19,
        total_percentage: 95,
        date_1: 'P',
        date_2: 'P',
        date_3: 'P',
        date_4: 'P',
        date_5: 'P',
      },
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
