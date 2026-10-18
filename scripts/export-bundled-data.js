import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../server/src/database.js';
import ExcelProcessor from '../server/src/excel-processor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function computeSpecialClassAttendance(cuId, allRecords = [], assignments = []) {
  const attendanceDates = allRecords
    .map(r => r.attendance_date)
    .filter(Boolean);

  const assignmentDates = assignments
    .map(a => a.submission_deadline || (a.submission_date ? a.submission_date.split('T')[0] : null))
    .filter(Boolean);

  const dateSet = new Set([...attendanceDates, ...assignmentDates]);
  const sortedDates = Array.from(dateSet).sort();

  const totalSpecialDates = sortedDates.length;
  const weightPerDay = totalSpecialDates > 0 ? Math.round((100 / totalSpecialDates) * 100) / 100 : 0;

  let uploadedCount = 0;
  const specialDates = sortedDates.map((date, idx) => {
    const attRec = allRecords.find(r => r.attendance_date === date);
    const assignRec = assignments.find(a =>
      a.submission_deadline === date ||
      a.assignment_id === `ASN-${date.replace(/[^a-zA-Z0-9]/g, '-')}` ||
      (a.assignment_id && a.assignment_id.includes(date)) ||
      (a.assignment_name && a.assignment_name.includes(date))
    );

    let assignmentsUploaded = 0;
    if (attRec && attRec.assignments_uploaded !== undefined && attRec.assignments_uploaded !== null) {
      const parsed = parseInt(attRec.assignments_uploaded, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        assignmentsUploaded = parsed;
      }
    } else if (attRec && (attRec.status === 'Present' || attRec.present_sessions > 0)) {
      assignmentsUploaded = 1;
    } else if (assignRec && (assignRec.submission_status || '').toLowerCase().includes('submit')) {
      const match = (assignRec.remarks || '').match(/Uploaded\s+(\d+)\s+assignment/i);
      assignmentsUploaded = match ? parseInt(match[1], 10) : 1;
    }

    const isUploaded = assignmentsUploaded > 0;
    if (isUploaded) {
      uploadedCount += 1;
    }

    const percentageContribution = isUploaded ? weightPerDay : 0;

    return {
      dateIndex: idx + 1,
      date,
      formattedDate: ExcelProcessor.formatDisplayDate(date) || date,
      assignmentsUploaded,
      isUploaded,
      weightPerDay,
      percentageContribution,
      status: isUploaded ? 'Uploaded' : 'Pending',
      subject: attRec?.subject || assignRec?.subject || 'Special Class Module',
    };
  });

  const specialAttendancePercentage = Math.min(100, Math.round(uploadedCount * weightPerDay * 10) / 10);

  return {
    totalSpecialDates,
    uploadedCount,
    pendingCount: totalSpecialDates - uploadedCount,
    weightPerDay,
    specialAttendancePercentage,
    specialDates,
  };
}

async function exportBundledData() {
  await db.init();
  const students = await db.all('SELECT * FROM students');
  const outDir = path.join(__dirname, '..', 'client', 'src', 'data');
  const outFile = path.join(outDir, 'bundledAttendanceData.json');

  if (students.length === 0 && fs.existsSync(outFile)) {
    console.log('Preserving existing bundled JSON file (0 students in active DB, offline dataset preserved).');
    return;
  }
  const allAttendance = await db.all('SELECT * FROM attendance_records');
  const allAssignments = await db.all('SELECT * FROM assignments');

  const attendanceByStudent = {};
  for (const r of allAttendance) {
    if (!attendanceByStudent[r.cu_id]) attendanceByStudent[r.cu_id] = [];
    attendanceByStudent[r.cu_id].push(r);
  }

  const assignmentsByStudent = {};
  for (const a of allAssignments) {
    if (!assignmentsByStudent[a.cu_id]) assignmentsByStudent[a.cu_id] = [];
    assignmentsByStudent[a.cu_id].push(a);
  }

  let adminMessages = [];
  try {
    adminMessages = await db.all('SELECT * FROM admin_messages ORDER BY created_at DESC LIMIT 50');
  } catch (e) {}

  const bundle = {
    exportedAt: new Date().toISOString(),
    totalStudents: students.length,
    adminMessages,
    students: {}
  };

  for (const s of students) {
    const studentRecords = (attendanceByStudent[s.cu_id] || []).sort((a, b) => b.attendance_date.localeCompare(a.attendance_date));
    const studentAssignments = (assignmentsByStudent[s.cu_id] || []).sort((a, b) => (a.submission_deadline || '').localeCompare(b.submission_deadline || ''));
    const specialClassAttendance = computeSpecialClassAttendance(s.cu_id, studentRecords, studentAssignments);

    // Compute dailySummaries
    const trackerDates = specialClassAttendance.specialDates.map(st => st.date);
    const otherDates = studentRecords.map(r => r.attendance_date);
    const allUniqueDates = [...new Set([...trackerDates, ...otherDates])];

    const dailySummaries = allUniqueDates.map(date => {
      const dayRecords = studentRecords.filter(r => r.attendance_date === date);
      const specialInfo = specialClassAttendance.specialDates.find(st => st.date === date);

      let totalHeld = 0;
      let totalPresent = 0;
      let totalAbsent = 0;

      for (const rec of dayRecords) {
        totalHeld += Number(rec.total_sessions || 0);
        totalPresent += Number(rec.present_sessions || 0);
        totalAbsent += Number(rec.absent_sessions || 0);
      }

      if (totalHeld === 0 && specialInfo) {
        totalHeld = 1;
        totalPresent = specialInfo.isUploaded ? 1 : 0;
        totalAbsent = specialInfo.isUploaded ? 0 : 1;
      }

      const dayPct = totalHeld > 0 ? Math.round(((totalPresent / totalHeld) * 100) * 10) / 10 : 0;
      const dayStatus = totalPresent === totalHeld ? 'Present' : totalPresent === 0 ? 'Absent' : 'Partial';

      return {
        date,
        formattedDate: ExcelProcessor.formatDisplayDate(date) || date,
        totalHeld,
        totalPresent,
        totalAbsent,
        percentage: dayPct,
        status: dayStatus,
        assignmentsUploaded: specialInfo ? specialInfo.assignmentsUploaded : (dayStatus === 'Present' ? 1 : 0),
        percentageContribution: specialInfo ? specialInfo.percentageContribution : 0,
        sessions: dayRecords.length > 0 ? dayRecords : [
          {
            id: `spec-${date}`,
            cu_id: s.cu_id,
            attendance_date: date,
            subject: 'Special Class & Exam Assignment',
            total_sessions: totalHeld,
            present_sessions: totalPresent,
            absent_sessions: totalAbsent,
            attendance_percentage: dayPct,
            status: dayStatus,
            created_at: new Date().toISOString(),
          }
        ]
      };
    });

    const latestFiveDates = allUniqueDates.slice(0, 5);
    const lastFiveDaysRecords = studentRecords.filter(r => latestFiveDates.includes(r.attendance_date));

    // Assignments summary
    const submittedCount = studentAssignments.filter(a => (a.submission_status || '').toLowerCase().includes('submit')).length;
    const lateCount = studentAssignments.filter(a => (a.submission_status || '').toLowerCase().includes('late')).length;
    const pendingCount = studentAssignments.length - submittedCount - lateCount;

    bundle.students[s.cu_id.toUpperCase()] = {
      profile: {
        ...s,
        special_class_attendance: specialClassAttendance,
      },
      attendance: {
        latestFiveDates,
        dailySummaries,
        lastFiveDaysRecords,
        totalRecords: studentRecords.length,
        hasRecords: studentRecords.length > 0 || specialClassAttendance.specialDates.length > 0,
        specialClassAttendance,
      },
      assignments: {
        assignments: studentAssignments,
        summary: {
          total: studentAssignments.length,
          submitted: submittedCount,
          pending: Math.max(0, pendingCount),
          late: lateCount,
        }
      }
    };
  }

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(outFile, JSON.stringify(bundle));
  const fileSizeMb = (fs.statSync(outFile).size / (1024 * 1024)).toFixed(2);
  console.log(`Successfully exported bundled offline database for ${students.length} students to ${outFile} (${fileSizeMb} MB)`);
}

exportBundledData().catch(console.error);
