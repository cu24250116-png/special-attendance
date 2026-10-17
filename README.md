# College Special Assignment & Attendance Dashboard (CampusSync ERP)

A full-stack, responsive, mobile-first web application and PWA for colleges and universities to manage attendance verification dates, special assignment submissions, and instant student record updates via Excel synchronization.

![College ERP](https://img.shields.io/badge/Platform-College%20ERP%20v2.6-blue)
![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%2B%20TypeScript%20%2B%20Vite%20%2B%20Tailwind-indigo)
![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express%20%2B%20SSE%20Realtime-emerald)
![Database](https://img.shields.io/badge/Database-SQLite%20WebAssembly%20%2F%20PostgreSQL-sky)

---

## 1. System Architecture & Live Real-Time Flow

```
+-----------------------------------------------------------------------------------+
|                               CAMPUSSYNC ARCHITECTURE                             |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [Admin Excel File]                     [Google Drive / OneDrive Master File]     |
|         |                                                   |                     |
|         v (Drag-and-Drop)                                   v (Periodic Polling)  |
|  +--------------------+                             +--------------------------+  |
|  | Multi-Sheet Parser |                             | Cloud Sync Engine        |  |
|  | - Column Normalizer|                             | - Check Modified Time    |  |
|  | - Row Validator    |                             | - Safe Error Handling    |  |
|  +---------+----------+                             +------------+-------------+  |
|            |                                                     |                |
|            +-----------------------+-----------------------------+                |
|                                    v                                              |
|                    +-------------------------------+                              |
|                    | Idempotent Database Service   |                              |
|                    | (SQLite / Managed PostgreSQL) |                              |
|                    +---------------+---------------+                              |
|                                    |                                              |
|                                    v (Instant Event Push)                         |
|                    +-------------------------------+                              |
|                    | Realtime SSE Event Stream Hub |                              |
|                    | (/api/realtime/stream)        |                              |
|                    +---------------+---------------+                              |
|                                    |                                              |
|            +-----------------------+-----------------------+                      |
|            |                                               |                      |
|            v                                               v                      |
|  +---------------------------+               +---------------------------+        |
|  |   Student Mobile PWA      |               |     Admin Control Panel   |        |
|  | - Auto-updates percentage |               | - Live Analytics KPI Grid |        |
|  | - 5-Day Attendance Log    |               | - Defaulter List (<75%)   |        |
|  | - Special Assignments     |               | - Realtime Client Monitor |        |
|  +---------------------------+               +---------------------------+        |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

---

## 2. Key Features

### A. Student Panel (Mobile-First PWA)
- **Secure CU ID Access**: Students enter their College University ID (e.g. `CU2024001`) with short-lived session authentication and rate-limiting. Cross-student access is strictly forbidden.
- **Overall Attendance Gauge**: Circular progress ring showing exact percentage, session ratios (Present vs Total), and standing indicator (**Good Standing** $\ge 75\%$, **Warning** $65-74\%$, or **Defaulter Alert** $< 75\%$).
- **Last 5 Days Attendance Breakdown**: Day-by-day logs for the 5 most recent attendance verification dates, subject sessions, present/absent counts, daily percentage, and multi-session summaries.
- **Special Assignment Tracker**: Real-time counter of total special assignments, submitted, pending, and late submissions with deadlines and faculty feedback remarks.
- **Automatic Live Updates (No Reload Required)**: When the admin updates records or uploads a new Excel spreadsheet, the student dashboard receives a Server-Sent Event (SSE) and immediately refreshes the attendance percentage and assignment statuses with a visual sync indicator.
- **Mobile Bottom Navigation**: Compact navigation bar for smartphone viewports (Dashboard, Attendance, Assignments, Profile).

### B. Admin Panel
- **Secure Admin Authentication**: JWT-based session security with bcrypt password hashing (`admin@college.edu` / `Admin@123`).
- **Excel Drag-and-Drop Ingestion**: Uploads `.xlsx`, `.xls`, and `.csv` files.
- **Pre-Import Preview & Validation**: Previews rows and columns across `Students`, `Attendance`, and `Assignments` sheets before committing.
- **Idempotent Imports**: Merges records using CU ID as the unique key; re-uploading the same file does not create duplicate entries.
- **Official Template Generator**: Downloadable pre-formatted `.xlsx` template with multi-sheets and formatting rules (`/api/admin/excel/template`).
- **Error Reporting**: Exportable `.xlsx` error report specifying the exact sheet, row number, and reason for any rejected rows.
- **Automatic Cloud Sync**: Background service connects to Google Drive / OneDrive master files, periodically polling for updates and triggering imports.
- **Quick Edit Modal**: Enables admins to adjust a student's attendance directly from the UI (e.g., from 88% to 92%) and witness immediate live push to the student.
- **Executive Analytics**: Real-time stats on college average attendance, defaulter counts, special assignment compliance, and recent upload logs.

---

## 3. Technology Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS, Lucide React, Canvas Confetti
- **Backend**: Node.js v24, Express, Server-Sent Events (SSE) Hub, Multer
- **Excel Engines**: ExcelJS (template generation and error reporting) and SheetJS (high-speed multi-sheet parsing)
- **Database Engine**: Dual-mode storage engine:
  - **Local/Development**: Persistent SQLite WebAssembly (`server/data/college_attendance.sqlite`) - runs zero-config on any OS.
  - **Production/Cloud**: PostgreSQL / Supabase connection via `DATABASE_URL`.

---

## 4. Quick Start (Running Locally)

### Prerequisites
- Node.js (v18+) and npm installed.

### 1-Command Startup
To start both backend server and frontend concurrently:
```powershell
npm run dev
```

Alternatively, run each service independently:
```powershell
# Terminal 1: Backend Server (Port 5000)
npm run dev:server

# Terminal 2: Frontend Vite App (Port 5173)
npm run dev:client
```

Open your browser at:
- **Application Portal**: [http://localhost:5000](http://localhost:5000) (Production single bundle) or [http://localhost:5173](http://localhost:5173) (Vite Dev Server)

---

## 5. Default Evaluation Credentials & Demo Accounts

### Administrator Login
- **Email**: `admin@college.edu`
- **Password**: `Admin@123`
*(A convenient "Auto-fill Demo Credentials" button is present on the admin login page)*

### Sample Student CU IDs for Testing
| CU ID | Student Name | Department | Initial Attendance | Note |
|---|---|---|---|---|
| **`CU2024001`** | Rahul Raj | Computer Science | **92.0%** | Safe Standing (Matches requirement example) |
| **`CU2024002`** | Aarav Sharma | Computer Science | **95.0%** | Top Academic Standing |
| **`CU2024003`** | Ananya Verma | AI & Data Science | **85.0%** | Good Standing |
| **`CU2024005`** | Dev Patel | Electronics (ECE) | **54.9%** | Defaulter Alert (< 75%) |

*(Quick test chips are available on the student welcome screen to test with 1-click)*

---

## 6. Running Automated Tests

A comprehensive integration test suite is included, verifying all 11 critical scenarios:

```powershell
npm test
```

### Verified Test Cases:
1. `PASS`: Server is healthy and online
2. `PASS`: Admin login with correct credentials returns JWT token
3. `PASS`: Admin login rejects invalid password
4. `PASS`: Student enters valid CU ID and receives verification challenge
5. `PASS`: Unknown CU IDs show a helpful error
6. `PASS`: Student verifies OTP and obtains short-lived signed JWT session
7. `PASS`: Attendance details for latest five available days are returned accurately
8. `PASS`: Special assignments submission counts and statuses are visible
9. `PASS`: One student cannot view another student's private records (Cross-access blocked with 403)
10. `PASS`: Admin updates student attendance percentage (e.g. 88% to 92%) and student receives change
11. `PASS`: Re-uploading the same Excel file does not duplicate records (Idempotency)
12. `PASS`: Invalid files are rejected with clear error details and logged
13. `PASS`: Cloud synchronization executes and handles status safely
14. `PASS`: Admin analytics computes accurate statistics across students

---

## 7. Excel File Format & Sheets Specification

Download the official template directly from the Admin Panel or via the endpoint:
`GET /api/admin/excel/template`

### Sheet 1: `Students`
| Column Header | Type | Description |
|---|---|---|
| `CU_ID` | String (Required) | Unique College University ID (e.g. `CU2024001`) |
| `Student_Name` | String (Required) | Full student legal name |
| `Course` | String | Degree program (e.g. `B.Tech`, `BCA`) |
| `Branch` | String | Academic department (e.g. `Computer Science`) |
| `Semester` | String / Number | Current enrolled semester (e.g. `5`) |
| `Section` | String | Class division (e.g. `A`, `B`) |
| `Email` | String (Optional) | College institutional email |
| `Phone` | String (Optional) | Student contact number |

### Sheet 2: `Attendance`
| Column Header | Type | Description |
|---|---|---|
| `CU_ID` | String (Required) | Target student CU ID |
| `Attendance_Date` | Date (Required) | Session date in `YYYY-MM-DD` or Excel date |
| `Subject` | String (Required) | Course/Subject name (e.g. `Machine Learning`) |
| `Total_Sessions` | Number | Classes conducted in this session (e.g. `2`) |
| `Present_Sessions` | Number | Classes attended by student |
| `Absent_Sessions` | Number | Classes missed |
| `Attendance_Percentage` | Number (Optional) | Auto-calculated if left blank |
| `Status` | String (Optional) | `Present`, `Absent`, or `Partial` |

### Sheet 3: `Assignments`
| Column Header | Type | Description |
|---|---|---|
| `CU_ID` | String (Required) | Target student CU ID |
| `Assignment_ID` | String (Required) | Unique task code (e.g. `ASN-ML-01`) |
| `Assignment_Name` | String (Required) | Assignment topic or submission title |
| `Subject` | String (Required) | Course/Subject title |
| `Submission_Deadline` | Date | Final cutoff date (`YYYY-MM-DD`) |
| `Submission_Status` | String | `Submitted`, `Pending`, `Late`, `Not Applicable` |
| `Submission_Date` | Date / Time | Timestamp of verified submission |
| `Remarks` | Text | Evaluator or departmental feedback |

---

## 8. Deployment Instructions

### A. Deploy Frontend to Vercel
1. Push this repository to GitHub or GitLab.
2. In Vercel, click **New Project** and select the repository.
3. Configure the build settings:
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. In Project Settings, set environment variable:
   - `VITE_API_URL`: Your deployed backend URL (e.g., `https://campus-sync-api.onrender.com`).

### B. Deploy Backend to Render, Railway, or VPS
1. Set the root or service directory to `server`.
2. Set build command: `npm install`.
3. Set start command: `node index.js`.
4. Configure environment variables in the host dashboard:
   - `PORT`: `5000` (or host assigned)
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: A secure random 64-character secret.
   - `ADMIN_DEFAULT_EMAIL`: `admin@college.edu`
   - `ADMIN_DEFAULT_PASSWORD`: `YourSecureAdminPassword`
   - `DATABASE_URL`: Your managed PostgreSQL connection URI (e.g., from Supabase or Neon):
     `postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres`
   - *(Optional for Google Drive Sync)*:
     - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
     - `GOOGLE_PRIVATE_KEY`

---

## 9. Feature Implementation Status

| Feature Requirement | Status | Notes |
|---|---|---|
| Admin Authentication (JWT, bcrypt, logout) | **Complete** | Production-ready with rate-limiting. |
| Student CU ID Lookup & 2FA verification | **Complete** | Issues signed student session token. |
| Cross-Student Record Protection | **Complete** | Blocked with 403 Forbidden. |
| Overall Attendance Gauge & Metrics | **Complete** | Circular SVG progress ring with safe/defaulter alerts. |
| Last 5 Available Days Attendance Log | **Complete** | Subject breakdown, sessions, daily % and visual pills. |
| Special Assignment Tracking | **Complete** | Submitted, Pending, Late compliance counters & remarks. |
| Real-time Updates (SSE Stream) | **Complete** | No page reload needed on data update. |
| Drag-and-Drop Excel Ingestion | **Complete** | Multi-sheet `.xlsx`, `.xls`, `.csv` support. |
| Pre-Import Data Preview & Validation | **Complete** | Verifies columns and detects errors before commit. |
| Idempotency & Conflict Resolution | **Complete** | Re-uploading does not duplicate records. |
| Downloadable Excel Template (.xlsx) | **Complete** | Formatted template generated with ExcelJS. |
| Downloadable Error Report (.xlsx) | **Complete** | Generates detailed error workbook for rejected rows. |
| Cloud Sync Engine (Drive / OneDrive) | **Complete** | Background daemon polling with manual "Sync Now" trigger. |
| PWA & Mobile-First Bottom Nav | **Complete** | Responsive on all devices with compact mobile bottom bar. |
| Unit & Integration Tests (14 Scenarios) | **Complete** | Fully passing with 0 failures (`npm test`). |
