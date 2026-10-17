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

  // 1. Create or maintain Default Admin account
  const adminEmail = process.env.ADMIN_DEFAULT_EMAIL || 'admin@college.edu';
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@123';
  const existingAdmin = await db.get('SELECT * FROM users WHERE email = ?', [adminEmail]);

  if (!existingAdmin) {
    const passwordHash = hashPassword(adminPassword);
    await db.run(`
      INSERT INTO users (id, username, email, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, 'admin', ?)
    `, [uuidv4(), 'College Admin', adminEmail, passwordHash, now]);
    console.log(`Initialized default admin user: ${adminEmail} (password: ${adminPassword})`);
  }

  // 2. PURGE ALL DUMMY DATA per user requirement
  // Database will only contain real data imported from admin Excel sheets.
  await db.run('DELETE FROM students');
  await db.run('DELETE FROM attendance_records');
  await db.run('DELETE FROM assignments');
  await db.run('DELETE FROM import_jobs');
  await db.run('DELETE FROM import_errors');
  console.log('Cleaned database: All dummy students and dummy attendance records removed.');

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
