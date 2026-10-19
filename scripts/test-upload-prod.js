import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROD_URL = 'https://college-special-attendance.onrender.com';

async function testUploadToProd() {
  console.log('1. Logging in as Dean on Production...');
  const deanLoginRes = await fetch(`${PROD_URL}/api/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'Dean@coer.edu', password: 'Dean@1111' })
  });
  const deanData = await deanLoginRes.json();
  const token = deanData.token;
  console.log('Dean token:', Boolean(token));
  if (!token) {
    console.error('Login failed:', deanData);
    process.exit(1);
  }

  const samplePath = path.join(__dirname, '..', 'server', 'samples', 'College_Master_Import.xlsx');
  console.log('2. Reading sample Excel:', samplePath, 'size:', fs.statSync(samplePath).size);
  const fileBuffer = fs.readFileSync(samplePath);

  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  formData.append('file', blob, 'College_Master_Import.xlsx');
  formData.append('mode', 'incremental');

  console.log('3. Uploading Excel to Production /api/admin/excel/import...');
  const uploadRes = await fetch(`${PROD_URL}/api/admin/excel/import`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  console.log('Upload status:', uploadRes.status);
  const uploadResult = await uploadRes.json();
  console.log('Upload response:', uploadResult);
}

testUploadToProd().catch(console.error);
