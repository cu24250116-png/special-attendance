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

  // Preserve real imported data: we do NOT wipe students or attendance records on server restart!
  console.log('Database verification: Preserving all imported student and attendance records.');

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
