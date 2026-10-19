import ExcelJS from '../server/node_modules/exceljs/dist/exceljs.min.js';

const API_BASE = 'http://localhost:5000/api';

async function createTestExcel(pct, pres, abs) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Students');
  ws.addRow([
    'Roll_Number', 'CU_ID', 'Student_Name', 'Father_Name', 'Course', 'Branch',
    'Semester', 'Section', 'Total_Sessions', 'Present_Sessions', 'Absent_Sessions',
    'Attendance_Percentage', '15-10-2026', '16-10-2026'
  ]);
  ws.addRow([
    '9999', 'CU_TEST_999', 'Test Student Sync', 'Guardian Name', 'B.Tech', 'Computer Science',
    '6', 'A', 10, pres, abs, pct, '1', pres >= 10 ? '1' : '0'
  ]);
  return await wb.xlsx.writeBuffer();
}

async function verifySyncFlow() {
  console.log('====================================================');
  console.log(' Starting Real Excel Import -> DB -> Student API Test');
  console.log('====================================================\n');

  // Step 1: Admin Login
  console.log('[1/5] Authenticating as Admin...');
  const loginRes = await fetch(`${API_BASE}/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'Dean@coer.edu', password: 'Dean@1111' }),
  });
  if (!loginRes.ok) throw new Error(`Admin login failed: ${loginRes.status}`);
  const loginData = await loginRes.json();
  const adminToken = loginData.token;
  console.log('✔ Admin authenticated successfully.\n');

  const testCuId = 'CU_TEST_999';

  // Step 2: Upload Initial Excel with 80% attendance
  console.log('[2/5] Admin uploads Excel dataset with 80.0% attendance...');
  const initialBuffer = await createTestExcel(80.0, 8, 2);
  const formData1 = new FormData();
  formData1.append('file', new Blob([initialBuffer]), 'attendance_v1.xlsx');
  formData1.append('mode', 'incremental');

  const upload1Res = await fetch(`${API_BASE}/admin/excel/import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: formData1,
  });
  if (!upload1Res.ok) {
    const err = await upload1Res.json();
    throw new Error(`Upload 1 failed: ${upload1Res.status} - ${err.error || JSON.stringify(err)}`);
  }
  const upload1Data = await upload1Res.json();
  console.log('✔ Upload 1 committed to database:', upload1Data.message);

  // Verify Student API reflects 80%
  const stuLoginRes = await fetch(`${API_BASE}/auth/student/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cu_id: testCuId, password: testCuId }),
  });
  if (!stuLoginRes.ok) throw new Error(`Student login failed: ${stuLoginRes.status}`);
  const stuLogin = await stuLoginRes.json();
  const studentToken = stuLogin.token;

  const stuRes1 = await fetch(`${API_BASE}/students/${testCuId}?_t=${Date.now()}`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const stuData1 = await stuRes1.json();
  console.log(`✔ Student API (Initial): ${stuData1.student.overall_percentage}% (Last Updated: ${stuData1.student.last_updated})\n`);
  const v1Time = stuData1.student.last_updated;

  // Step 3: Admin uploads LATEST Excel update (10:00 AM update) with 100% attendance
  console.log('[3/5] Admin uploads LATEST Excel dataset with 100.0% attendance...');
  // Wait 1 second so timestamp is strictly distinct
  await new Promise(r => setTimeout(r, 1000));

  const updatedBuffer = await createTestExcel(100.0, 10, 0);
  const formData2 = new FormData();
  formData2.append('file', new Blob([updatedBuffer]), 'attendance_v2.xlsx');
  formData2.append('mode', 'incremental');

  const upload2Res = await fetch(`${API_BASE}/admin/excel/import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: formData2,
  });
  if (!upload2Res.ok) {
    const err = await upload2Res.json();
    throw new Error(`Upload 2 failed: ${upload2Res.status} - ${err.error || JSON.stringify(err)}`);
  }
  const upload2Data = await upload2Res.json();
  console.log('✔ Upload 2 committed to database:', upload2Data.message);

  // Step 4: Request same student attendance from Student API
  console.log('\n[4/5] Fetching fresh student attendance from Student API...');
  const stuRes2 = await fetch(`${API_BASE}/students/${testCuId}?_t=${Date.now()}`, {
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
  if (!stuRes2.ok) throw new Error(`Student API failed: ${stuRes2.status}`);

  const cacheHeader = stuRes2.headers.get('cache-control') || '';
  console.log('✔ Response Cache-Control Header:', cacheHeader);
  if (!cacheHeader.includes('no-store') && !cacheHeader.includes('no-cache')) {
    throw new Error('Missing no-store/no-cache header on student API!');
  }

  const stuData2 = await stuRes2.json();
  console.log(`✔ Student API (Updated): ${stuData2.student.overall_percentage}% (Last Updated: ${stuData2.student.last_updated})`);

  if (stuData2.student.overall_percentage !== 100.0) {
    throw new Error(`STALE ATTENDANCE BUG DETECTED: Expected 100%, but got ${stuData2.student.overall_percentage}%`);
  }
  if (stuData2.student.last_updated === v1Time) {
    throw new Error('STALE TIMESTAMP BUG DETECTED: last_updated was not refreshed!');
  }

  // Step 5: Verify Student Attendance Logs route
  console.log('\n[5/5] Fetching attendance breakdown (/api/students/:cu_id/attendance)...');
  const attRes = await fetch(`${API_BASE}/students/${testCuId}/attendance?_t=${Date.now()}`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  if (!attRes.ok) throw new Error(`Attendance logs failed: ${attRes.status}`);
  const attData = await attRes.json();
  console.log(`✔ Daily Summaries Count: ${attData.dailySummaries?.length || 0}`);
  console.log(`✔ Special Class Percentage: ${attData.specialClassAttendance?.specialAttendancePercentage}%`);
  console.log(`✔ Server sync time: ${attData.lastUpdated}`);

  console.log('\n====================================================');
  console.log(' SUCCESS! ALL VERIFICATION TESTS PASSED!            ');
  console.log(' Excel Upload -> DB Commit -> Student API -> Mobile ');
  console.log(' Authoritative live attendance guaranteed!          ');
  console.log('====================================================\n');
  process.exit(0);
}

verifySyncFlow().catch(err => {
  console.error('\n✖ Verification Test FAILED:', err.message);
  process.exit(1);
});
