// Comprehensive Integration & Unit Test Suite for College Attendance & Special Assignment Dashboard
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = 'http://localhost:5000/api';

let adminToken = '';
let studentToken = '';
let testStudentCuId = 'CU2024001';

async function runTests() {
  console.log('\n======================================================');
  console.log(' Starting College ERP Automated Verification Test Suite');
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

  // 2. Admin Authentication
  await test('Scenario: Admin login with correct credentials returns JWT token', async () => {
    const res = await fetch(`${API_BASE}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@college.edu', password: 'Admin@123' }),
    });
    if (!res.ok) throw new Error(`Admin login failed: ${res.status}`);
    const data = await res.json();
    if (!data.token) throw new Error('No JWT token returned');
    adminToken = data.token;
  });

  // 3. Admin Login rejection with wrong password
  await test('Scenario: Admin login rejects invalid password', async () => {
    const res = await fetch(`${API_BASE}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@college.edu', password: 'WrongPassword999' }),
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  // 4. Student Lookup valid CU ID
  await test('Scenario 2: Student enters valid CU ID and receives verification challenge', async () => {
    const res = await fetch(`${API_BASE}/auth/student/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cu_id: testStudentCuId }),
    });
    if (!res.ok) throw new Error(`Student lookup failed: ${res.status}`);
    const data = await res.json();
    if (data.cu_id !== testStudentCuId) throw new Error('Returned CU ID mismatch');
    if (!data.studentName) throw new Error('Missing student name');
  });

  // 5. Student Lookup unknown CU ID
  await test('Scenario 3: Unknown CU IDs show a helpful error', async () => {
    const res = await fetch(`${API_BASE}/auth/student/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cu_id: 'UNKNOWN_999999' }),
    });
    if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
    const data = await res.json();
    if (!data.error.includes('not found')) throw new Error('Expected friendly error message');
  });

  // 6. Student OTP Verification
  await test('Scenario: Student verifies OTP and obtains short-lived signed JWT session', async () => {
    const res = await fetch(`${API_BASE}/auth/student/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cu_id: testStudentCuId, otp: '123456' }),
    });
    if (!res.ok) throw new Error(`Student verify failed: ${res.status}`);
    const data = await res.json();
    if (!data.token) throw new Error('No student token returned');
    studentToken = data.token;
  });

  // 7. Student Attendance: Last 5 Days Breakdown
  await test('Scenario: Attendance details for latest five available days are returned accurately', async () => {
    const res = await fetch(`${API_BASE}/students/${testStudentCuId}/attendance`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    if (!res.ok) throw new Error(`Fetch attendance failed: ${res.status}`);
    const data = await res.json();
    if (!data.dailySummaries || data.dailySummaries.length === 0) throw new Error('No daily summaries returned');
    if (data.dailySummaries.length > 5) throw new Error('Should have at most 5 latest days');
    // Verify each day has date, totalHeld, totalPresent, percentage
    for (const day of data.dailySummaries) {
      if (!day.date || day.totalHeld === undefined || day.percentage === undefined) {
        throw new Error('Day summary missing mandatory properties');
      }
    }
  });

  // 8. Special Assignment Tracking
  await test('Scenario: Special assignments submission counts and statuses are visible', async () => {
    const res = await fetch(`${API_BASE}/students/${testStudentCuId}/assignments`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    if (!res.ok) throw new Error(`Fetch assignments failed: ${res.status}`);
    const data = await res.json();
    if (data.totalSpecialAssignments === undefined) throw new Error('Missing totalSpecialAssignments');
    if (data.submittedCount === undefined || data.pendingCount === undefined) throw new Error('Missing counts');
    if (!Array.isArray(data.assignments)) throw new Error('Assignments is not an array');
  });

  // 9. Unauthorized Student Cross-Access Prevention
  await test('Scenario 9: One student cannot view another student\'s private records', async () => {
    const res = await fetch(`${API_BASE}/students/CU2024002/attendance`, {
      headers: { Authorization: `Bearer ${studentToken}` }, // using CU2024001 token
    });
    if (res.status !== 403) throw new Error(`Expected 403 forbidden, got ${res.status}`);
    const data = await res.json();
    if (!data.error.includes('Access denied')) throw new Error('Expected access denied message');
  });

  // 10. Admin Updates Student Attendance (88% to 92%)
  await test('Scenario 4 & 5: Admin updates student attendance percentage and student receives change', async () => {
    const updateRes = await fetch(`${API_BASE}/admin/students/${testStudentCuId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ overall_percentage: 92.5 }),
    });
    if (!updateRes.ok) throw new Error(`Admin update failed: ${updateRes.status}`);

    // Verify student fetches updated percentage
    const studentRes = await fetch(`${API_BASE}/students/${testStudentCuId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const sData = await studentRes.json();
    if (sData.student.overall_percentage !== 92.5) {
      throw new Error(`Expected 92.5, got ${sData.student.overall_percentage}`);
    }
  });

  // 11. Excel Upload & Idempotency
  await test('Scenario 1 & 6: Re-uploading the same Excel file does not duplicate records (Idempotency)', async () => {
    const sampleFilePath = path.join(__dirname, 'samples', 'College_Master_Import.xlsx');
    if (!fs.existsSync(sampleFilePath)) throw new Error('Sample Excel file not found on disk');

    const fileBuffer = fs.readFileSync(sampleFilePath);
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    formData.append('file', blob, 'College_Master_Import.xlsx');
    formData.append('mode', 'incremental');

    const countBeforeRes = await fetch(`${API_BASE}/admin/students?limit=100`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const beforeData = await countBeforeRes.json();
    const countBefore = beforeData.total;

    // Upload
    const uploadRes = await fetch(`${API_BASE}/admin/excel/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData,
    });
    if (!uploadRes.ok) throw new Error(`Excel upload failed: ${uploadRes.status}`);

    const countAfterRes = await fetch(`${API_BASE}/admin/students?limit=100`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const afterData = await countAfterRes.json();
    const countAfter = afterData.total;

    // Must be idempotent - student count shouldn't duplicate existing students!
    if (countAfter !== countBefore) {
      throw new Error(`Idempotency violated: before=${countBefore}, after=${countAfter}`);
    }
  });

  // 12. Invalid Excel file rejection & Error Logging
  await test('Scenario 7: Invalid files are rejected with clear error details', async () => {
    const invalidFilePath = path.join(__dirname, 'samples', 'Invalid_Format_Test.xlsx');
    const fileBuffer = fs.readFileSync(invalidFilePath);
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    formData.append('file', blob, 'Invalid_Format_Test.xlsx');

    const uploadRes = await fetch(`${API_BASE}/admin/excel/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData,
    });
    const data = await uploadRes.json();
    if (data.result.errorsCount === 0) {
      throw new Error('Expected errors to be caught in invalid file');
    }
  });

  // 13. Cloud Sync Trigger & Safe Resilience
  await test('Scenario 10: Cloud synchronization executes and handles status safely', async () => {
    const syncRes = await fetch(`${API_BASE}/cloud-sync/sync-now`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!syncRes.ok) throw new Error(`Sync trigger failed: ${syncRes.status}`);
    const data = await syncRes.json();
    if (data.status !== 'success' && data.status !== 'already_running') {
      throw new Error(`Unexpected sync status: ${data.status}`);
    }
  });

  // 14. Admin Analytics calculation
  await test('Scenario: Admin analytics computes accurate statistics', async () => {
    const res = await fetch(`${API_BASE}/admin/analytics`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok) throw new Error(`Analytics failed: ${res.status}`);
    const data = await res.json();
    if (data.totalStudents === undefined || data.averageAttendance === undefined) {
      throw new Error('Missing analytics keys');
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
