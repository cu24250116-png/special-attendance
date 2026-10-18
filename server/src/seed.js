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

  // 1. Create or maintain Dean Admin account (Dean@coer.edu / Dean@1111)
  const adminEmail = process.env.ADMIN_DEFAULT_EMAIL || 'Dean@coer.edu';
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'Dean@1111';
  const passwordHash = hashPassword(adminPassword);

  const existingDean = await db.get('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [adminEmail]);
  if (!existingDean) {
    await db.run(`
      INSERT INTO users (id, username, email, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, 'admin', ?)
    `, [uuidv4(), 'Dean Academic', adminEmail, passwordHash, now]);
    console.log(`Initialized primary admin user: ${adminEmail} (password: ${adminPassword})`);
  } else {
    await db.run('UPDATE users SET password_hash = ? WHERE LOWER(email) = LOWER(?)', [passwordHash, adminEmail]);
    console.log(`Verified and updated admin password for: ${adminEmail}`);
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
