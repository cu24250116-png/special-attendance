const PROD_URL = 'https://college-special-attendance.onrender.com';

async function inspectProd() {
  console.log('--- 1. Health Check on Production ---');
  const healthRes = await fetch(`${PROD_URL}/api/health`);
  console.log('Health:', await healthRes.json());

  console.log('\n--- 2. Admin Login on Production ---');
  const adminLoginRes = await fetch(`${PROD_URL}/api/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin', password: 'CollegeAdmin@2026' })
  });
  const adminData = await adminLoginRes.json();
  console.log('Admin login status:', adminLoginRes.status, 'token present:', Boolean(adminData.token));

  let adminToken = adminData.token;
  if (!adminToken) {
    // Try Dean@coer.edu
    const deanLoginRes = await fetch(`${PROD_URL}/api/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'Dean@coer.edu', password: 'Dean@1111' })
    });
    const deanData = await deanLoginRes.json();
    console.log('Dean login status:', deanLoginRes.status, 'token present:', Boolean(deanData.token));
    adminToken = deanData.token;
  }

  if (adminToken) {
    console.log('\n--- 3. Fetching Import Jobs from Production ---');
    const jobsRes = await fetch(`${PROD_URL}/api/admin/import-history`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const jobsData = await jobsRes.json();
    console.log('Import jobs in Prod PostgreSQL:');
    console.table(jobsData.history);

    console.log('\n--- 4. Fetching Student CU25260047 from Production ---');
    const studRes = await fetch(`${PROD_URL}/api/students/CU25260047`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const studData = await studRes.json();
    console.log('Student data in Prod PostgreSQL:', studData);

    console.log('\n--- 5. Fetching Attendance for CU25260047 from Production ---');
    const attRes = await fetch(`${PROD_URL}/api/students/CU25260047/attendance`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const attData = await attRes.json();
    console.log('Attendance data in Prod PostgreSQL:', {
      totalRecords: attData.totalRecords,
      lastUpdated: attData.lastUpdated,
      latestImport: attData.latestImport,
      specialClassAttendance: attData.specialClassAttendance,
    });
  }

  console.log('\n--- 6. Student Direct Login on Production ---');
  const stuLoginRes = await fetch(`${PROD_URL}/api/auth/student/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cu_id: 'CU25260047', password: 'CU25260047' })
  });
  console.log('Student login status:', stuLoginRes.status);
  const stuLoginData = await stuLoginRes.json();
  console.log('Student login data:', stuLoginData.student ? {
    cu_id: stuLoginData.student.cu_id,
    student_name: stuLoginData.student.student_name,
    overall_percentage: stuLoginData.student.overall_percentage,
    total_sessions: stuLoginData.student.total_sessions,
    present_sessions: stuLoginData.student.present_sessions,
    absent_sessions: stuLoginData.student.absent_sessions,
    last_updated: stuLoginData.student.last_updated,
  } : stuLoginData);
}

inspectProd().catch(console.error);
