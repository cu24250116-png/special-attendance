import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import db from './database.js';
import { hashPassword } from './auth.js';
import ExcelProcessor from './excel-processor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SAMPLES_DIR = path.join(__dirname, '..', 'samples');
if (!fs.existsSync(SAMPLES_DIR)) {
  fs.mkdirSync(SAMPLES_DIR, { recursive: true });
}

export async function seedDatabase() {
  await db.init();
  const now = new Date().toISOString();

  // 1. Initialize or maintain primary Super Admin account securely from environment variables
  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || process.env.ADMIN_DEFAULT_EMAIL || 'Dean@coer.edu').trim();
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || process.env.ADMIN_DEFAULT_PASSWORD || 'Dean@1111';

  // Check if primary super admin or any super admin already exists
  const existingSuperAdmin = await db.get(
    "SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR role = 'super_admin' LIMIT 1",
    [superAdminEmail]
  );

  if (!existingSuperAdmin) {
    const passwordHash = hashPassword(superAdminPassword);
    await db.run(`
      INSERT INTO users (id, username, email, password_hash, role, department, status, must_change_password, created_at, created_by)
      VALUES (?, ?, ?, ?, 'super_admin', 'ALL', 'active', 0, ?, 'system_bootstrap')
    `, [uuidv4(), 'Dean Academic / Super Admin', superAdminEmail, passwordHash, now]);
    console.log(`Primary Super Admin account initialized: ${superAdminEmail}`);
  } else {
    // Ensure the primary account has super_admin role and ALL departments
    if (existingSuperAdmin.role !== 'super_admin' || existingSuperAdmin.department !== 'ALL') {
      await db.run(
        "UPDATE users SET role = 'super_admin', department = 'ALL', status = 'active' WHERE id = ?",
        [existingSuperAdmin.id]
      );
    }

    // Optional environment variable override for emergency password recovery
    if (process.env.SUPER_ADMIN_PASSWORD_RESET && process.env.SUPER_ADMIN_PASSWORD_RESET.trim()) {
      const resetHash = hashPassword(process.env.SUPER_ADMIN_PASSWORD_RESET.trim());
      await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [resetHash, existingSuperAdmin.id]);
      console.log(`Super Admin password reset via environment variable.`);
    }

    console.log(`Primary Super Admin account verified: ${existingSuperAdmin.email}`);
  }

  // Remove any legacy admin placeholder
  await db.run('DELETE FROM users WHERE LOWER(email) = ?', ['admin@college.edu']);

  // 2. Auto-seed student dataset into database if empty or missing
  const studentCount = await db.get('SELECT COUNT(*) as count FROM students');
  const count = studentCount ? Number(studentCount.count) : 0;
  if (count < 100) {
    const seedFile = path.join(__dirname, '..', 'data', 'master_seed.json');
    if (fs.existsSync(seedFile)) {
      console.log(`Database has only ${count} students. Seeding 1,367 official students from master_seed.json...`);
      const seedData = JSON.parse(fs.readFileSync(seedFile, 'utf8'));

      db.startBatch();
      for (const s of (seedData.students || [])) {
        await db.run(`
          INSERT INTO students (
            cu_id, student_name, roll_number, father_name, course, branch,
            semester, section, email, phone, password_hash, overall_percentage,
            total_sessions, present_sessions, absent_sessions, last_updated,
            import_job_id, password_changed
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          s.cu_id, s.student_name, s.roll_number, s.father_name, s.course, s.branch,
          s.semester, s.section, s.email, s.phone, s.password_hash, s.overall_percentage,
          s.total_sessions, s.present_sessions, s.absent_sessions, s.last_updated,
          s.import_job_id, s.password_changed || 0
        ]);
      }

      for (const a of (seedData.attendance || [])) {
        await db.run(`
          INSERT INTO attendance_records (
            id, cu_id, attendance_date, subject, total_sessions, present_sessions,
            absent_sessions, attendance_percentage, status, created_at,
            assignments_uploaded, import_job_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          a.id, a.cu_id, a.attendance_date, a.subject || 'Special Class',
          a.total_sessions || 1, a.present_sessions || 1, a.absent_sessions || 0,
          a.attendance_percentage || 100, a.status, a.created_at,
          a.assignments_uploaded || 0, a.import_job_id || null
        ]);
      }

      for (const as of (seedData.assignments || [])) {
        await db.run(`
          INSERT INTO assignments (
            id, assignment_id, cu_id, assignment_name, subject, submission_deadline,
            submission_status, submission_date, remarks, created_at, import_job_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          as.id, as.assignment_id, as.cu_id, as.assignment_name, as.subject || 'Special Class',
          as.submission_deadline, as.submission_status, as.submission_date, as.remarks,
          as.created_at, as.import_job_id
        ]);
      }
      db.endBatch();
      console.log(`Database successfully populated with ${seedData.students?.length || 0} students and attendance history.`);
    }
  } else {
    console.log(`Database verification: Preserving all ${count} student records intact.`);
  }

  // 3. Generate Official Excel Template matching user requirements
  const sampleMasterFile = path.join(SAMPLES_DIR, 'College_Master_Import.xlsx');
  try {
    const templateBuffer = await ExcelProcessor.generateOfficialTemplate();
    fs.writeFileSync(sampleMasterFile, templateBuffer);
    console.log(`Generated official template with user columns at: ${sampleMasterFile}`);
  } catch (err) {
    console.error('Template generation error:', err);
  }
}
