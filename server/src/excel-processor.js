import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './database.js';
import { hashPassword } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Flexible column name normalizer
function normalizeKey(str) {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/['’`]/g, '') // remove apostrophes so "Student's" becomes "students"
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Column aliases mapping for flexible header matching
const COLUMN_ALIASES = {
  // Students
  roll_number: [
    'roll_number', 'roll_no', 'rollno', 'roll', 'class_roll_no', 'univ_roll_no', 'university_roll_no',
    's_no', 'serial_no', 'sno', 'sr_no', 'srno', 'sl_no', 'slno'
  ],
  cu_id: [
    'cu_id', 'cuid', 'student_id', 'studentid', 'student_id_no', 'college_id', 'registration_no',
    'reg_no', 'enrollment_no', 'enrollment', 'id', 'student_uid', 'uid', 'admission_no', 'student_code'
  ],
  student_name: [
    'student_name', 'student_s_name', 'students_name', 'name', 'full_name', 'student_full_name',
    'student_fullname', 'candidate_name', 'candidate_s_name', 'candidates_name', 'student', 'studentname',
    'student_s', 'students', 'name_of_student', 'name_of_the_student', 'student_nam', 'std_name'
  ],
  father_name: [
    'father_name', 'father_s_name', 'fathers_name', 'fathername', 'father', 'guardian_name',
    'parent_name', 'father_full_name', 'father_s'
  ],
  course: ['course', 'program', 'programme', 'degree', 'class'],
  branch: ['branch', 'department', 'dept', 'stream', 'spec', 'specialization'],
  semester: ['semester', 'sem', 'term'],
  section: ['section', 'sec', 'group', 'batch'],
  email: ['email', 'email_id', 'mail', 'student_email', 'email_address'],
  phone: ['phone', 'mobile', 'contact', 'phone_number', 'mobile_no', 'contact_no'],

  // Attendance in student master sheet
  total_sessions: [
    'class_conducted', 'classes_conducted', 'total_classes', 'total_sessions', 'total', 'sessions',
    'classes_held', 'conducted', 'held', 'total_held', 'classes'
  ],
  present_sessions: [
    'total_present', 'present', 'present_sessions', 'attended', 'attended_sessions', 'classes_attended', 'pres'
  ],
  absent_sessions: [
    'total_absent', 'absent', 'absent_sessions', 'missed', 'missed_sessions', 'classes_absent', 'abs'
  ],
  attendance_percentage: [
    'total_percentage', 'percentage', 'attendance_percentage', 'pct', 'percent', '%', 'total_%',
    'overall_percentage', 'att_%', 'att_percentage', 'attendance_%'
  ],
  status: ['status', 'attendance_status'],

  // Attendance specific sheet
  attendance_date: ['attendance_date', 'date', 'session_date', 'day'],
  subject: ['subject', 'course_code', 'subject_name', 'course_name', 'module', 'sub'],

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
  const withUnderscoreNorm = k.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  const compactKey = normKey.replace(/_/g, '');

  // Exclude known metadata columns
  for (const list of Object.values(COLUMN_ALIASES)) {
    if (
      list.includes(normKey) ||
      list.includes(withUnderscoreNorm) ||
      list.some(a => a.replace(/_/g, '') === compactKey)
    ) {
      return false;
    }
  }

  // Check Excel serial date number
  if (!isNaN(k) && Number(k) > 20000 && Number(k) < 60000) return true;

  // Check date patterns like 10/09/2024, 2024-09-10, 10-09-24, 10.09.2024, 10/09, 10/10/26, etc.
  if (/\b\d{1,4}[-/.]\d{1,2}([-/.]\d{1,4})?\b/.test(k)) return true;
  // Check month words like 10-Sep, 10 Sep, 10-Oct-26, September 10, etc.
  if (/\b\d{1,2}[-/\s]?(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|september|oct|nov|dec)/i.test(k)) return true;
  // Check explicit naming
  if (/(date|special.*class|class.*date|session|exam.*date|assign.*date)/i.test(k)) return true;

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
        const rawNorm = normalizeKey(key);
        const withUnderscoreNorm = String(key).trim().toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
        const compactKey = rawNorm.replace(/_/g, '');

        if (
          aliases.includes(rawNorm) ||
          aliases.includes(withUnderscoreNorm) ||
          aliases.some(a => a.replace(/_/g, '') === compactKey)
        ) {
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
      const rows = (sheetsData[name] || []).filter((r) =>
        Object.values(r).some((v) => v !== undefined && v !== null && String(v).trim() !== '')
      );

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
      const firstRows = (sheetsData[sheetNames[0]] || []).filter((r) =>
        Object.values(r).some((v) => v !== undefined && v !== null && String(v).trim() !== '')
      );
      previewStudents = firstRows.slice(0, 10).map((r) => this.mapRowFields(r, Object.keys(COLUMN_ALIASES)));
    }

    const nonBlankStudentRows = (sheetsData['Students'] || sheetsData['students'] || sheetsData[sheetNames[0]] || [])
      .filter((r) => Object.values(r).some((v) => v !== undefined && v !== null && String(v).trim() !== ''));

    return {
      sheetNames,
      totalRows: {
        students: nonBlankStudentRows.length,
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

  // Format date safely to YYYY-MM-DD
  static formatDate(val) {
    if (!val) return '';
    if (val instanceof Date) {
      const y = val.getUTCFullYear();
      const m = String(val.getUTCMonth() + 1).padStart(2, '0');
      const d = String(val.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const str = String(val).trim();

    // Excel numeric date serial
    if (!isNaN(str) && Number(str) > 20000 && Number(str) < 60000) {
      const date = new Date(Math.round((Number(str) - 25569) * 86400 * 1000));
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    // Pattern DD/MM/YYYY or MM/DD/YYYY or DD-MM-YYYY or MM-DD-YYYY or DD.MM.YYYY
    const ddmmyyyy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
    if (ddmmyyyy) {
      const p1 = parseInt(ddmmyyyy[1], 10);
      const p2 = parseInt(ddmmyyyy[2], 10);
      let y = ddmmyyyy[3];
      if (y.length === 2) y = '20' + y;

      let m, d;
      if (p1 > 12 && p2 <= 12) {
        // e.g. 25/10/26 -> Day is 25, Month is 10
        d = p1;
        m = p2;
      } else if (p2 > 12 && p1 <= 12) {
        // e.g. 10/25/26 -> Month is 10, Day is 25
        m = p1;
        d = p2;
      } else {
        // Both <= 12 (e.g. 10/11/26)
        // If p1 is 10 and year is 2026, it's October (MM/DD/YY as in the college attendance file)
        if (p1 === 10) {
          m = p1;
          d = p2;
        } else {
          d = p1;
          m = p2;
        }
      }
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    // Pattern DD-Mon or DD Mon or DD-Mon-YYYY (e.g. 10-Sep, 10 Sep 2024, 10 September)
    const monthNames = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
      september: '09', october: '10', november: '11', december: '12',
      january: '01', february: '02', march: '03', april: '04', june: '06',
      july: '07', august: '08', sept: '09'
    };
    const ddMon = str.match(/^(\d{1,2})[-/\s]+([a-zA-Z]+)(?:[-/\s]+(\d{2,4}))?$/);
    if (ddMon) {
      const d = ddMon[1].padStart(2, '0');
      const monStr = ddMon[2].toLowerCase();
      const m = monthNames[monStr] || monthNames[monStr.slice(0, 3)];
      if (m) {
        let y = ddMon[3] || '2026';
        if (y.length === 2) y = '20' + y;
        return `${y}-${m}-${d}`;
      }
    }

    // Pattern DD/MM or MM/DD (assume year 2026)
    const ddmm = str.match(/^(\d{1,2})[-/.](\d{1,2})$/);
    if (ddmm) {
      const p1 = parseInt(ddmm[1], 10);
      const p2 = parseInt(ddmm[2], 10);
      let m = p2;
      let d = p1;
      if (p2 > 12 && p1 <= 12) {
        m = p1;
        d = p2;
      }
      return `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    // ISO format YYYY-MM-DD
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    return str;
  }

  // Format YYYY-MM-DD to human friendly string (e.g. 10 Sep 2024)
  static formatDisplayDate(val) {
    if (!val) return '';
    const iso = this.formatDate(val);
    const parts = iso.split('-');
    if (parts.length === 3) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mIdx = parseInt(parts[1], 10) - 1;
      const mon = months[mIdx] || parts[1];
      const day = parseInt(parts[2], 10);
      return `${day} ${mon} ${parts[0]}`;
    }
    return String(val);
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

    return await db.transaction(async (tx) => {
      // Pre-load existing records into memory maps to avoid 30,000+ round-trip SELECT queries
      const existingStudentsList = await tx.all('SELECT cu_id, password_hash, roll_number, father_name, course, branch, semester, section, email, phone FROM students');
      const existingStudentsMap = new Map();
      for (const s of existingStudentsList) {
        if (s.cu_id) {
          const upperCu = String(s.cu_id).toUpperCase().trim();
          existingStudentsMap.set(upperCu, s);
          const strippedCu = upperCu.replace(/^CU[-_ ]*/i, '');
          if (strippedCu) existingStudentsMap.set(strippedCu, s);
        }
        if (s.roll_number) {
          const upperRoll = String(s.roll_number).toUpperCase().trim();
          existingStudentsMap.set(upperRoll, s);
          const strippedRoll = upperRoll.replace(/^CU[-_ ]*/i, '');
          if (strippedRoll) existingStudentsMap.set(strippedRoll, s);
        }
      }

      const existingAttList = await tx.all('SELECT id, cu_id, attendance_date FROM attendance_records');
      const existingAttMap = new Map();
      for (const a of existingAttList) {
        if (a.cu_id && a.attendance_date) {
          existingAttMap.set(`${String(a.cu_id).toUpperCase().trim()}#${a.attendance_date}`, a.id);
        }
      }

      const existingAssignList = await tx.all('SELECT id, cu_id, assignment_id, submission_deadline FROM assignments');
      const existingAssignMap = new Map();
      for (const as of existingAssignList) {
        const uCu = String(as.cu_id || '').toUpperCase().trim();
        if (as.assignment_id) existingAssignMap.set(`${uCu}#${as.assignment_id}`, as.id);
        if (as.submission_deadline) existingAssignMap.set(`${uCu}#${as.submission_deadline}`, as.id);
      }

      // 1. Process Students & Embedded Special Class Date Columns
      for (let i = 0; i < studentRows.length; i++) {
        const raw = studentRows[i];

        // Skip completely empty or blank rows silently
        const hasAnyContent = Object.values(raw).some(
          (v) => v !== undefined && v !== null && String(v).trim() !== ''
        );
        if (!hasAnyContent) {
          continue;
        }

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

        let studentName = mapped.student_name ? String(mapped.student_name).trim() : null;

        // If neither CU ID nor student name exists, skip row as non-data / spacer row
        if (!cuId && !studentName) {
          continue;
        }

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
          studentName = `Student ${cuId}`;
        }

        // Department-level permission check for HOD uploads
        if (options.allowedDepartment) {
          const rowDept = String(mapped.branch || mapped.course || '').trim();
          if (rowDept && !rowDept.toLowerCase().includes(options.allowedDepartment.toLowerCase()) && !options.allowedDepartment.toLowerCase().includes(rowDept.toLowerCase())) {
            errors.push({
              sheet_name: 'Students',
              row_number: i + 2,
              cu_id: cuId || null,
              error_message: `Row skipped: Student belongs to "${rowDept}", which is outside your authorized department ("${options.allowedDepartment}").`,
              raw_data: JSON.stringify(raw),
            });
            continue;
          }
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
        const parsedDateEntries = [];

        for (const dateKey of dateColumns) {
          const rawCell = raw[dateKey];
          const cellVal = String(rawCell !== undefined && rawCell !== null ? rawCell : '').trim();
          const upperVal = cellVal.toUpperCase();

          embeddedHeldCount++;

          let numUploaded = 0;
          let isPresent = false;

          const parsedNum = parseFloat(cellVal);
          if (!isNaN(parsedNum) && parsedNum > 0) {
            numUploaded = Math.round(parsedNum);
            isPresent = true;
          } else if (upperVal === 'P' || upperVal === 'PRESENT' || upperVal === 'YES' || upperVal === 'SUBMITTED' || upperVal === 'DONE') {
            numUploaded = 1;
            isPresent = true;
          } else {
            numUploaded = 0;
            isPresent = false;
          }

          if (isPresent) embeddedPresentCount++;

          const formattedDate = this.formatDate(dateKey) || dateKey;
          const status = isPresent ? 'Present' : 'Absent';
          const pct = isPresent ? 100 : 0;
          const presentCount = isPresent ? 1 : 0;
          const absentCount = isPresent ? 0 : 1;

          parsedDateEntries.push({
            dateKey,
            formattedDate,
            isPresent,
            numUploaded,
            presentCount,
            absentCount,
            status,
            pct
          });
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

        const strippedCu = cuId.replace(/^CU[-_ ]*/i, '');
        const existingStudent = existingStudentsMap.get(cuId) ||
          (strippedCu ? existingStudentsMap.get(strippedCu) : null) ||
          (mapped.roll_number ? existingStudentsMap.get(String(mapped.roll_number).toUpperCase().trim()) : null);

        if (existingStudent && existingStudent.cu_id) {
          cuId = existingStudent.cu_id;
        }

        if (existingStudent) {
          await tx.run(`
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
              import_job_id = COALESCE(?, import_job_id),
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
            jobId,
            now,
            cuId
          ]);
        } else {
          await tx.run(`
            INSERT INTO students (
              cu_id, student_name, roll_number, father_name, course, branch, semester, section,
              email, phone, password_hash, overall_percentage, total_sessions, present_sessions,
              absent_sessions, import_job_id, last_updated
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            jobId,
            now
          ]);
          existingStudentsMap.set(cuId, { cu_id: cuId });
        }
        studentsUpdated++;

        // CRITICAL FIX: Upsert date attendance and assignment records AFTER parent student exists
        for (const entry of parsedDateEntries) {
          const { dateKey, formattedDate, isPresent, numUploaded, presentCount, absentCount, status, pct } = entry;
          const attKey = `${cuId}#${formattedDate}`;
          const existingAttId = existingAttMap.get(attKey);

          if (existingAttId) {
            await tx.run(`
              UPDATE attendance_records SET
                total_sessions = 1,
                present_sessions = ?,
                absent_sessions = ?,
                assignments_uploaded = ?,
                import_job_id = ?,
                attendance_percentage = ?,
                status = ?
              WHERE id = ?
            `, [presentCount, absentCount, numUploaded, jobId, pct, status, existingAttId]);
          } else {
            const newAttId = uuidv4();
            await tx.run(`
              INSERT INTO attendance_records (
                id, cu_id, attendance_date, subject, total_sessions, present_sessions,
                absent_sessions, assignments_uploaded, import_job_id, attendance_percentage, status, created_at
              ) VALUES (?, ?, ?, 'Special Class', 1, ?, ?, ?, ?, ?, ?, ?)
            `, [newAttId, cuId, formattedDate, presentCount, absentCount, numUploaded, jobId, pct, status, now]);
            existingAttMap.set(attKey, newAttId);
          }
          attendanceUpdated++;

          // Upsert assignment record for this special exam date
          const cleanDateId = formattedDate.replace(/[^a-zA-Z0-9]/g, '-');
          const assignId = `ASN-${cleanDateId}`;
          const displayDate = this.formatDisplayDate(formattedDate) || dateKey;
          const assignTitle = `Special Exam Assignment (${displayDate})`;
          const assignStatus = isPresent ? 'Submitted' : 'Pending';
          const submissionDate = isPresent ? formattedDate : null;
          const remarks = isPresent
            ? `Uploaded ${numUploaded} assignment(s) on special day`
            : 'Assignment not uploaded / absent on special day';

          const assignLookup1 = `${cuId}#${assignId}`;
          const assignLookup2 = `${cuId}#${formattedDate}`;
          const existingAssignId = existingAssignMap.get(assignLookup1) || existingAssignMap.get(assignLookup2);

          if (existingAssignId) {
            await tx.run(`
              UPDATE assignments SET
                assignment_name = ?,
                subject = 'Special Class',
                submission_deadline = ?,
                submission_status = ?,
                submission_date = ?,
                remarks = ?,
                import_job_id = ?
              WHERE id = ?
            `, [assignTitle, formattedDate, assignStatus, submissionDate, remarks, jobId, existingAssignId]);
          } else {
            const newAssignId = uuidv4();
            await tx.run(`
              INSERT INTO assignments (
                id, assignment_id, cu_id, assignment_name, subject, submission_deadline,
                submission_status, submission_date, remarks, import_job_id, created_at
              ) VALUES (?, ?, ?, ?, 'Special Class', ?, ?, ?, ?, ?, ?)
            `, [newAssignId, assignId, cuId, assignTitle, formattedDate, assignStatus, submissionDate, remarks, jobId, now]);
            existingAssignMap.set(assignLookup1, newAssignId);
            existingAssignMap.set(assignLookup2, newAssignId);
          }
          assignmentsUpdated++;
        }
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

        // Ensure student exists
        if (!existingStudentsMap.has(cuId)) {
          const studentPasswordHash = hashPassword(cuId);
          await tx.run(`
            INSERT INTO students (
              cu_id, student_name, course, branch, semester, section, password_hash,
              overall_percentage, total_sessions, present_sessions, absent_sessions, last_updated
            ) VALUES (?, ?, 'Course', 'General', '1', 'A', ?, 0, 0, 0, 0, ?)
          `, [cuId, `Student ${cuId}`, studentPasswordHash, now]);
          existingStudentsMap.set(cuId, { cu_id: cuId });
        }

        const attKey = `${cuId}#${date}`;
        const existingAttId = existingAttMap.get(attKey);

        if (existingAttId) {
          await tx.run(`
            UPDATE attendance_records SET
              total_sessions = ?,
              present_sessions = ?,
              absent_sessions = ?,
              attendance_percentage = ?,
              status = ?,
              import_job_id = COALESCE(?, import_job_id)
            WHERE id = ?
          `, [total, present, absent, pct, status, jobId, existingAttId]);
        } else {
          const recordId = uuidv4();
          await tx.run(`
            INSERT INTO attendance_records (
              id, cu_id, attendance_date, subject, total_sessions, present_sessions,
              absent_sessions, import_job_id, attendance_percentage, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [recordId, cuId, date, subject, total, present, absent, jobId, pct, status, now]);
          existingAttMap.set(attKey, recordId);
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

        // Ensure student exists
        if (!existingStudentsMap.has(cuId)) {
          const studentPasswordHash = hashPassword(cuId);
          await tx.run(`
            INSERT INTO students (
              cu_id, student_name, course, branch, semester, section, password_hash,
              overall_percentage, total_sessions, present_sessions, absent_sessions, last_updated
            ) VALUES (?, ?, 'Course', 'General', '1', 'A', ?, 0, 0, 0, 0, ?)
          `, [cuId, `Student ${cuId}`, studentPasswordHash, now]);
          existingStudentsMap.set(cuId, { cu_id: cuId });
        }

        const assignLookup = `${cuId}#${assignId}`;
        const existingAssignId = existingAssignMap.get(assignLookup);

        if (existingAssignId) {
          await tx.run(`
            UPDATE assignments SET
              assignment_name = ?,
              subject = ?,
              submission_deadline = ?,
              submission_status = ?,
              submission_date = ?,
              remarks = ?,
              import_job_id = COALESCE(?, import_job_id)
            WHERE id = ?
          `, [title, subject, deadline, status, submissionDate, remarks, jobId, existingAssignId]);
        } else {
          const id = uuidv4();
          await tx.run(`
            INSERT INTO assignments (
              id, assignment_id, cu_id, assignment_name, subject, submission_deadline,
              submission_status, submission_date, remarks, import_job_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [id, assignId, cuId, title, subject, deadline, status, submissionDate, remarks, jobId, now]);
          existingAssignMap.set(assignLookup, id);
        }
        assignmentsUpdated++;
      }

      // 4. Update last_updated timestamp and preserve semester attendance totals
      for (const cuId of affectedCuIds) {
        const studentRec = await tx.get('SELECT total_sessions FROM students WHERE cu_id = ?', [cuId]);
        if (!studentRec || !studentRec.total_sessions || Number(studentRec.total_sessions) <= 0) {
          const attRows = await tx.all('SELECT total_sessions, present_sessions, absent_sessions FROM attendance_records WHERE cu_id = ?', [cuId]);
          if (attRows && attRows.length > 0) {
            let tot = 0;
            let pres = 0;
            let abs = 0;
            for (const r of attRows) {
              tot += Number(r.total_sessions || 0);
              pres += Number(r.present_sessions || 0);
              abs += Number(r.absent_sessions || 0);
            }
            const pct = tot > 0 ? Math.round(((pres / tot) * 100) * 10) / 10 : 0;
            await tx.run(`
              UPDATE students SET
                overall_percentage = ?,
                total_sessions = ?,
                present_sessions = ?,
                absent_sessions = ?,
                last_updated = ?
              WHERE cu_id = ?
            `, [pct, tot, pres, abs, now, cuId]);
            continue;
          }
        }
        await tx.run('UPDATE students SET last_updated = ? WHERE cu_id = ?', [now, cuId]);
      }

      // 5. Save Import Job Record
      const status = errors.length === 0 ? 'success' : (studentsUpdated + attendanceUpdated + assignmentsUpdated > 0 ? 'partial' : 'failed');
      await tx.run(`
        INSERT INTO import_jobs (
          id, filename, uploaded_by, import_type, status, total_rows,
          students_updated, attendance_updated, assignments_updated, errors_count, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        jobId, filename, uploadedBy, options.type || 'admin_upload', status, totalRows,
        studentsUpdated, attendanceUpdated, assignmentsUpdated, errors.length, now
      ]);

      // 5. Save Errors if any (up to 100)
      for (const err of errors.slice(0, 100)) {
        await tx.run(`
          INSERT INTO import_errors (id, job_id, sheet_name, row_number, cu_id, error_message, raw_data)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [uuidv4(), jobId, err.sheet_name, err.row_number, err.cu_id, err.error_message, err.raw_data]);
      }

      return {
        jobId,
        status,
        timestamp: now,
        filename,
        totalRows,
        studentsUpdated,
        attendanceUpdated,
        assignmentsUpdated,
        errorsCount: errors.length,
        errors: errors.slice(0, 50),
        affectedStudents: Array.from(affectedCuIds),
      };
    });
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

    // The exact 8 special exam dates from user's Excel sheet:
    // 10-Oct-26, 11-Oct-26, 17-Oct-26, 18-Oct-26, 19-Oct-26, 20-Oct-26, 24-Oct-26, 25-Oct-26
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
      { header: '10-Oct-26', key: 'date_1', width: 14 },
      { header: '11-Oct-26', key: 'date_2', width: 14 },
      { header: '17-Oct-26', key: 'date_3', width: 14 },
      { header: '18-Oct-26', key: 'date_4', width: 14 },
      { header: '19-Oct-26', key: 'date_5', width: 14 },
      { header: '20-Oct-26', key: 'date_6', width: 14 },
      { header: '24-Oct-26', key: 'date_7', width: 14 },
      { header: '25-Oct-26', key: 'date_8', width: 14 },
    ];

    masterSheet.getRow(1).eachCell(cell => Object.assign(cell, headerStyle));

    // Per user instructions:
    // The number in the date column represents the number of assignments uploaded on that special day.
    // > 0 = Present with that assignment count.
    // 0 or blank = Absent with 0 assignments.
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
        date_1: 1,
        date_2: 1,
        date_3: 2,
        date_4: 1,
        date_5: 1,
        date_6: 1,
        date_7: 1,
        date_8: 0,
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
        date_1: 1,
        date_2: 1,
        date_3: 1,
        date_4: 1,
        date_5: 1,
        date_6: 1,
        date_7: 1,
        date_8: 1,
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

  // Delete an imported Excel dataset and its associated attendance and assignment records
  static async deleteImportJob(jobId) {
    const job = await db.get('SELECT * FROM import_jobs WHERE id = ?', [jobId]);
    if (!job) {
      throw new Error(`Import dataset with ID "${jobId}" not found`);
    }

    db.startBatch();
    try {
      // 1. Delete attendance records created by this job
      await db.run('DELETE FROM attendance_records WHERE import_job_id = ?', [jobId]);

      // 2. Delete assignments created by this job
      await db.run('DELETE FROM assignments WHERE import_job_id = ?', [jobId]);

      // 3. Delete students created exclusively by this job in bulk
      await db.run(`
        DELETE FROM students
        WHERE import_job_id = ?
          AND cu_id NOT IN (SELECT DISTINCT cu_id FROM attendance_records)
          AND cu_id NOT IN (SELECT DISTINCT cu_id FROM assignments)
      `, [jobId]);

      await db.run('UPDATE students SET import_job_id = NULL WHERE import_job_id = ?', [jobId]);

      // 4. Delete import errors
      await db.run('DELETE FROM import_errors WHERE job_id = ?', [jobId]);

      // 5. Delete the job record
      await db.run('DELETE FROM import_jobs WHERE id = ?', [jobId]);
    } finally {
      db.endBatch();
    }

    // Trigger background export to keep offline data in sync
    try {
      const { spawn } = await import('child_process');
      const exportScript = path.join(__dirname, '..', '..', 'scripts', 'export-bundled-data.js');
      const exportProc = spawn(process.execPath, [exportScript], { stdio: 'ignore' });
      exportProc.unref();
    } catch (exportErr) {
      console.warn('Could not trigger background bundle export:', exportErr);
    }

    return {
      success: true,
      jobId,
      filename: job.filename,
      message: `Successfully deleted Excel sheet "${job.filename}" and removed its imported records.`
    };
  }

  // Clear all imported Excel datasets, student rosters, attendance and assignments (keeps admin logins)
  static async clearAllData() {
    db.startBatch();
    try {
      await db.run('DELETE FROM attendance_records');
      await db.run('DELETE FROM assignments');
      await db.run('DELETE FROM students');
      await db.run('DELETE FROM import_errors');
      await db.run('DELETE FROM import_jobs');
    } finally {
      db.endBatch();
    }

    // Trigger background export to keep offline data in sync
    try {
      const { spawn } = await import('child_process');
      const exportScript = path.join(__dirname, '..', '..', 'scripts', 'export-bundled-data.js');
      const exportProc = spawn(process.execPath, [exportScript], { stdio: 'ignore' });
      exportProc.unref();
    } catch (exportErr) {
      console.warn('Could not trigger background bundle export:', exportErr);
    }

    return {
      success: true,
      message: 'All imported student rosters, attendance records, and Excel history have been reset successfully.'
    };
  }
}

export default ExcelProcessor;
