import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import db from './database.js';
import { hashPassword } from './auth.js';
import ExcelProcessor from './excel-processor.js';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SAMPLES_DIR = path.join(__dirname, '..', 'samples');
if (!fs.existsSync(SAMPLES_DIR)) {
  fs.mkdirSync(SAMPLES_DIR, { recursive: true });
}

export async function seedDatabase() {
  await db.init();
  const now = new Date().toISOString();

  // 1. Create or update Default Admin
  const adminEmail = process.env.ADMIN_DEFAULT_EMAIL || 'admin@college.edu';
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@123';
  const existingAdmin = await db.get('SELECT * FROM users WHERE email = ?', [adminEmail]);

  if (!existingAdmin) {
    const passwordHash = hashPassword(adminPassword);
    await db.run(`
      INSERT INTO users (id, username, email, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, 'admin', ?)
    `, [uuidv4(), 'College Admin', adminEmail, passwordHash, now]);
    console.log(`Created default admin user: ${adminEmail} (password: ${adminPassword})`);
  }

  // 2. Check if students exist; if not, seed realistic students dataset
  const studentCountRow = await db.get('SELECT COUNT(*) as count FROM students');
  const count = studentCountRow ? Number(studentCountRow.count) : 0;

  if (count === 0) {
    console.log('Seeding initial college students, attendance, and assignment records...');

    const sampleStudents = [
      { cu_id: 'CU2024001', name: 'Rahul Raj', course: 'B.Tech', branch: 'Computer Science', semester: '5', section: 'A', email: 'rahul.raj@college.edu', phone: '9876543210' },
      { cu_id: 'CU2024002', name: 'Aarav Sharma', course: 'B.Tech', branch: 'Computer Science', semester: '5', section: 'A', email: 'aarav.sharma@college.edu', phone: '9876543211' },
      { cu_id: 'CU2024003', name: 'Ananya Verma', course: 'B.Tech', branch: 'Artificial Intelligence', semester: '5', section: 'B', email: 'ananya.v@college.edu', phone: '9876543212' },
      { cu_id: 'CU2024004', name: 'Priya Nair', course: 'B.Tech', branch: 'Information Technology', semester: '5', section: 'A', email: 'priya.nair@college.edu', phone: '9876543213' },
      { cu_id: 'CU2024005', name: 'Dev Patel', course: 'B.Tech', branch: 'Electronics & Comm', semester: '5', section: 'C', email: 'dev.patel@college.edu', phone: '9876543214' },
      { cu_id: 'CU2024006', name: 'Sneha Kulkarni', course: 'B.Tech', branch: 'Computer Science', semester: '5', section: 'B', email: 'sneha.k@college.edu', phone: '9876543215' },
      { cu_id: 'CU2024007', name: 'Rohan Gupta', course: 'B.Tech', branch: 'Information Technology', semester: '5', section: 'B', email: 'rohan.g@college.edu', phone: '9876543216' },
      { cu_id: 'CU2024008', name: 'Meera Iyer', course: 'B.Tech', branch: 'Artificial Intelligence', semester: '5', section: 'A', email: 'meera.i@college.edu', phone: '9876543217' },
      { cu_id: 'CU2024009', name: 'Vikram Singh', course: 'B.Tech', branch: 'Computer Science', semester: '5', section: 'C', email: 'vikram.s@college.edu', phone: '9876543218' },
      { cu_id: 'CU2024010', name: 'Tanvi Sen', course: 'B.Tech', branch: 'Computer Science', semester: '5', section: 'A', email: 'tanvi.sen@college.edu', phone: '9876543219' },
    ];

    const pastFiveDates = [
      '2026-10-17',
      '2026-10-16',
      '2026-10-15',
      '2026-10-14',
      '2026-10-13',
    ];

    const subjects = [
      { name: 'Machine Learning', sessions: 2 },
      { name: 'Distributed Systems', sessions: 2 },
      { name: 'Cloud Computing Lab', sessions: 3 },
      { name: 'Cyber Security', sessions: 2 },
      { name: 'Software Architecture', sessions: 2 },
    ];

    for (const s of sampleStudents) {
      await db.run(`
        INSERT INTO students (
          cu_id, student_name, course, branch, semester, section, email, phone,
          overall_percentage, total_sessions, present_sessions, absent_sessions, last_updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?)
      `, [s.cu_id, s.name, s.course, s.branch, s.semester, s.section, s.email, s.phone, now]);

      let studentTotalHeld = 0;
      let studentTotalPresent = 0;

      // Seed 5 days of attendance for each student
      for (let dIdx = 0; dIdx < pastFiveDates.length; dIdx++) {
        const date = pastFiveDates[dIdx];
        const subj = subjects[dIdx % subjects.length];

        // Specific tailored scenario for Rahul Raj (CU2024001) to match requirement example:
        // High attendance (~92%), or varied realistic percentages
        let presentSessions = subj.sessions;
        if (s.cu_id === 'CU2024001' && dIdx === 3) {
          presentSessions = 1; // 1 out of 2 present
        } else if (s.cu_id === 'CU2024005' && (dIdx === 1 || dIdx === 4)) {
          presentSessions = 0; // defaulter scenario < 75%
        } else if (s.cu_id === 'CU2024009' && dIdx === 2) {
          presentSessions = 1;
        }

        const absentSessions = subj.sessions - presentSessions;
        const pct = Math.round((presentSessions / subj.sessions) * 100);
        const status = presentSessions === subj.sessions ? 'Present' : presentSessions === 0 ? 'Absent' : 'Partial';

        studentTotalHeld += subj.sessions;
        studentTotalPresent += presentSessions;

        await db.run(`
          INSERT INTO attendance_records (
            id, cu_id, attendance_date, subject, total_sessions, present_sessions,
            absent_sessions, attendance_percentage, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          uuidv4(), s.cu_id, date, subj.name, subj.sessions, presentSessions,
          absentSessions, pct, status, now
        ]);
      }

      // Add historical classes to bring total to realistic ~50 sessions
      const historicalHeld = 40;
      let historicalPresent = 36;
      if (s.cu_id === 'CU2024001') {
        historicalPresent = 38; // 38 + 9 = 47 present out of 51 total = 92%
      } else if (s.cu_id === 'CU2024005') {
        historicalPresent = 25; // Defaulter: 28/51 = ~54%
      } else if (s.cu_id === 'CU2024002') {
        historicalPresent = 39; // ~95%
      }

      const totalHeldFinal = studentTotalHeld + historicalHeld;
      const totalPresentFinal = studentTotalPresent + historicalPresent;
      const totalAbsentFinal = totalHeldFinal - totalPresentFinal;
      const finalOverallPct = Math.round(((totalPresentFinal / totalHeldFinal) * 100) * 10) / 10;

      await db.run(`
        UPDATE students SET
          total_sessions = ?,
          present_sessions = ?,
          absent_sessions = ?,
          overall_percentage = ?,
          last_updated = ?
        WHERE cu_id = ?
      `, [totalHeldFinal, totalPresentFinal, totalAbsentFinal, finalOverallPct, now, s.cu_id]);

      // Seed Special Assignments
      const sampleAssignments = [
        {
          id: 'ASN-ML-01',
          name: 'Special Assignment: Neural Network Backprop Implementation',
          subject: 'Machine Learning',
          deadline: '2026-10-25',
          status: s.cu_id === 'CU2024005' ? 'Pending' : 'Submitted',
          subDate: s.cu_id === 'CU2024005' ? null : '2026-10-15 14:30',
          remarks: s.cu_id === 'CU2024005' ? 'Awaiting submission' : 'Verified by Dept Coordinator',
        },
        {
          id: 'ASN-DS-02',
          name: 'Distributed Key-Value Store & Raft Consensus',
          subject: 'Distributed Systems',
          deadline: '2026-10-28',
          status: s.cu_id === 'CU2024001' || s.cu_id === 'CU2024002' ? 'Submitted' : 'Pending',
          subDate: s.cu_id === 'CU2024001' ? '2026-10-16 11:20' : null,
          remarks: s.cu_id === 'CU2024001' ? 'Code verified with unit tests' : 'Submission due by next week',
        },
        {
          id: 'ASN-CC-03',
          name: 'Kubernetes Cluster Auto-Scaling & Microservices Deployment',
          subject: 'Cloud Computing Lab',
          deadline: '2026-10-31',
          status: 'Pending',
          subDate: null,
          remarks: 'Special assignment for mid-term evaluation',
        },
        {
          id: 'ASN-SEC-04',
          name: 'Zero-Day Vulnerability Analysis & Mitigation Strategy',
          subject: 'Cyber Security',
          deadline: '2026-10-20',
          status: s.cu_id === 'CU2024001' ? 'Submitted' : s.cu_id === 'CU2024003' ? 'Late' : 'Pending',
          subDate: s.cu_id === 'CU2024001' ? '2026-10-14 09:15' : s.cu_id === 'CU2024003' ? '2026-10-21 16:00' : null,
          remarks: s.cu_id === 'CU2024001' ? 'Approved with distinction' : 'Special submission',
        },
      ];

      for (const a of sampleAssignments) {
        await db.run(`
          INSERT INTO assignments (
            id, assignment_id, cu_id, assignment_name, subject, submission_deadline,
            submission_status, submission_date, remarks, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          uuidv4(), a.id, s.cu_id, a.name, a.subject, a.deadline,
          a.status, a.subDate, a.remarks, now
        ]);
      }
    }

    // Seed initial Import Job in history
    await db.run(`
      INSERT INTO import_jobs (
        id, filename, uploaded_by, import_type, status, total_rows,
        students_updated, attendance_updated, assignments_updated, errors_count, created_at
      ) VALUES (?, 'College_Master_Dataset_Initial.xlsx', 'System Init', 'initial_seed', 'success', 100, 10, 50, 40, 0, ?)
    `, [uuidv4(), now]);

    console.log('Seeding completed successfully.');
  }

  // 3. Generate sample Excel files on disk for user convenience and testing
  const sampleMasterFile = path.join(SAMPLES_DIR, 'College_Master_Import.xlsx');
  if (!fs.existsSync(sampleMasterFile)) {
    const templateBuffer = await ExcelProcessor.generateOfficialTemplate();
    fs.writeFileSync(sampleMasterFile, templateBuffer);
    console.log(`Generated sample master Excel file at: ${sampleMasterFile}`);
  }

  // Generate an incremental update sample file (e.g., updating Rahul Raj from 88% / 92%)
  const incrementalFile = path.join(SAMPLES_DIR, 'Incremental_Update_Test.xlsx');
  if (!fs.existsSync(incrementalFile)) {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Attendance');
    sheet.columns = [
      { header: 'CU_ID', key: 'cu_id', width: 16 },
      { header: 'Attendance_Date', key: 'attendance_date', width: 18 },
      { header: 'Subject', key: 'subject', width: 28 },
      { header: 'Total_Sessions', key: 'total_sessions', width: 16 },
      { header: 'Present_Sessions', key: 'present_sessions', width: 16 },
      { header: 'Absent_Sessions', key: 'absent_sessions', width: 16 },
      { header: 'Attendance_Percentage', key: 'attendance_percentage', width: 20 },
      { header: 'Status', key: 'status', width: 14 },
    ];
    sheet.addRow({
      cu_id: 'CU2024001',
      attendance_date: '2026-10-18',
      subject: 'Special Workshop on GenAI',
      total_sessions: 3,
      present_sessions: 3,
      absent_sessions: 0,
      attendance_percentage: 100,
      status: 'Present'
    });
    const buffer = await wb.xlsx.writeBuffer();
    fs.writeFileSync(incrementalFile, buffer);
    console.log(`Generated incremental test file at: ${incrementalFile}`);
  }

  // Generate an invalid format sample file for testing error reporting
  const invalidFile = path.join(SAMPLES_DIR, 'Invalid_Format_Test.xlsx');
  if (!fs.existsSync(invalidFile)) {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Attendance');
    sheet.columns = [
      { header: 'CU_ID', key: 'cu_id', width: 16 },
      { header: 'Attendance_Date', key: 'attendance_date', width: 18 },
      { header: 'Subject', key: 'subject', width: 28 },
      { header: 'Total_Sessions', key: 'total_sessions', width: 16 },
      { header: 'Present_Sessions', key: 'present_sessions', width: 16 },
    ];
    // Missing CU_ID error
    sheet.addRow({
      cu_id: '',
      attendance_date: '2026-10-18',
      subject: 'Software Testing',
      total_sessions: 2,
      present_sessions: 2
    });
    // Present > Total error
    sheet.addRow({
      cu_id: 'CU2024003',
      attendance_date: '2026-10-18',
      subject: 'Compiler Design',
      total_sessions: 2,
      present_sessions: 5 // Invalid!
    });
    const buffer = await wb.xlsx.writeBuffer();
    fs.writeFileSync(invalidFile, buffer);
    console.log(`Generated invalid format test file at: ${invalidFile}`);
  }
}
