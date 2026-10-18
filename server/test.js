// Integration & Unit Test Suite for Clean Database & User Columns
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = 'http://localhost:5000/api';

let adminToken = '';
let studentToken = '';
const testStudentCuId = 'CU2024001';

async function runTests() {
  console.log('\n======================================================');
  console.log(' Starting College ERP Verification Test Suite');
  console.log(' (Zero Dummy Data & Real Excel Import Workflow)       ');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(` \x1b[32m✔ PASS\x1b[0m: ${name}`);
      passed++;
    } catch (err) {
      console.error(` \x1b[31m✖ FAIL\x1b[0m: ${name}`);
      console.error(`   Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Health check
  await test('Server is healthy and online', async () => {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error(`Health returned status ${res.status}`);
    const data = await res.json();
    if (data.status !== 'online') throw new Error('Status is not online');
  });

  const testAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@college.edu';
  const testAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin@123';

  // 2. Admin Authentication
  await test('Admin login returns JWT token', async () => {
    const res = await fetch(`${API_BASE}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testAdminEmail, password: testAdminPassword }),
    });
    if (!res.ok) throw new Error(`Admin login failed: ${res.status}`);
    const data = await res.json();
    if (!data.token) throw new Error('No JWT token returned');
    adminToken = data.token;
  });

  // 3. Admin login invalid password rejection
  await test('Admin login rejects invalid credentials', async () => {
    const res = await fetch(`${API_BASE}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@college.edu', password: 'WrongPassword999' }),
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  // 4. Verify initial database has 0 dummy students (clean state)
  await test('Database starts with 0 dummy students (Clean Slate)', async () => {
    const res = await fetch(`${API_BASE}/admin/students`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    if (data.total !== 0) throw new Error(`Expected 0 dummy students, found ${data.total}`);
  });

  // 5. Unknown student returns 404
  await test('Unknown CU ID shows helpful not-found error', async () => {
    const res = await fetch(`${API_BASE}/auth/student/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cu_id: 'NON_EXISTENT_ID', password: 'NON_EXISTENT_ID' }),
    });
    if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
    const data = await res.json();
    if (!data.error.includes('not found')) throw new Error('Expected friendly error message');
  });

  // 6. Admin imports Excel file with user columns (Roll_Number, Student_ID, Father_Name, Dates)
  await test('Admin uploads Excel file with Roll Number, Father Name, and Date Columns', async () => {
    const sampleFilePath = path.join(__dirname, 'samples', 'College_Master_Import.xlsx');
    if (!fs.existsSync(sampleFilePath)) throw new Error('Template Excel file not found on disk');

    const fileBuffer = fs.readFileSync(sampleFilePath);
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    formData.append('file', blob, 'College_Master_Import.xlsx');
    formData.append('mode', 'incremental');

    const uploadRes = await fetch(`${API_BASE}/admin/excel/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData,
    });
    if (!uploadRes.ok) throw new Error(`Excel upload failed: ${uploadRes.status}`);
    const result = await uploadRes.json();
    if (result.result.studentsUpdated === 0) throw new Error('Expected students to be imported');
  });

  // 7. Student Login using CU ID as Password (exact user requirement!)
  await test('Student logs in using CU ID as username AND password', async () => {
    const res = await fetch(`${API_BASE}/auth/student/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cu_id: testStudentCuId, password: testStudentCuId }),
    });
    if (!res.ok) throw new Error(`Student login failed: ${res.status}`);
    const data = await res.json();
    if (!data.token) throw new Error('Missing student token');
    if (data.student.cu_id !== testStudentCuId) throw new Error('Returned student mismatch');
    if (data.student.student_name !== 'Rahul Raj') throw new Error('Student name mismatch');
    if (data.student.father_name !== 'R. K. Sharma') throw new Error('Father name mismatch');
    if (data.student.roll_number !== '101') throw new Error('Roll number mismatch');
    studentToken = data.token;
  });

  // 8. Student Login rejects incorrect password
  await test('Student login rejects incorrect password with reminder', async () => {
    const res = await fetch(`${API_BASE}/auth/student/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cu_id: testStudentCuId, password: 'WrongPassword' }),
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    const data = await res.json();
    if (!data.error.includes('default password is your Student ID')) {
      throw new Error('Expected reminder that default password is CU ID');
    }
  });

  // 9. Student Attendance shows special class dates from Excel
  await test('Student dashboard returns attendance for imported special class dates and 100/N formula', async () => {
    const res = await fetch(`${API_BASE}/students/${testStudentCuId}/attendance`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    if (!res.ok) throw new Error(`Fetch attendance failed: ${res.status}`);
    const data = await res.json();
    if (!data.dailySummaries || data.dailySummaries.length === 0) throw new Error('Expected daily summaries');
    if (!data.specialClassAttendance) throw new Error('Missing specialClassAttendance object');
    if (data.specialClassAttendance.totalSpecialDates !== 8) {
      throw new Error(`Expected 8 special dates, got ${data.specialClassAttendance.totalSpecialDates}`);
    }
    if (data.specialClassAttendance.weightPerDay !== 12.5) {
      throw new Error(`Expected 12.5% weight per day, got ${data.specialClassAttendance.weightPerDay}`);
    }
    const hasUploadField = data.dailySummaries.some(d => d.assignmentsUploaded !== undefined);
    if (!hasUploadField) throw new Error('Expected assignmentsUploaded field in daily summaries');
  });

  // 10. Unauthorized Cross-Student Access Prevention
  await test('Student cannot access records of another student (Blocked with 403)', async () => {
    const res = await fetch(`${API_BASE}/students/CU2024002/attendance`, {
      headers: { Authorization: `Bearer ${studentToken}` }, // using CU2024001 token
    });
    if (res.status !== 403) throw new Error(`Expected 403 forbidden, got ${res.status}`);
  });

  // 11. Admin updates student attendance percentage (e.g. 88% to 92%)
  await test('Admin updates student attendance and student receives update', async () => {
    const updateRes = await fetch(`${API_BASE}/admin/students/${testStudentCuId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ overall_percentage: 92.0 }),
    });
    if (!updateRes.ok) throw new Error(`Admin update failed: ${updateRes.status}`);

    const studentRes = await fetch(`${API_BASE}/students/${testStudentCuId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const sData = await studentRes.json();
    if (sData.student.overall_percentage !== 92.0) {
      throw new Error(`Expected 92.0, got ${sData.student.overall_percentage}`);
    }
  });

  // 12. Idempotency on Re-upload
  await test('Re-uploading the same Excel file does not duplicate students (Idempotent)', async () => {
    const sampleFilePath = path.join(__dirname, 'samples', 'College_Master_Import.xlsx');
    const fileBuffer = fs.readFileSync(sampleFilePath);
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    formData.append('file', blob, 'College_Master_Import.xlsx');
    formData.append('mode', 'incremental');

    const beforeRes = await fetch(`${API_BASE}/admin/students`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const beforeData = await beforeRes.json();
    const beforeCount = beforeData.total;

    await fetch(`${API_BASE}/admin/excel/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData,
    });

    const afterRes = await fetch(`${API_BASE}/admin/students`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const afterData = await afterRes.json();
    if (afterData.total !== beforeCount) {
      throw new Error(`Duplicate records created! Before: ${beforeCount}, After: ${afterData.total}`);
    }
  });

  console.log('\n======================================================');
  console.log(` Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
