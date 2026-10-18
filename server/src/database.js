import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const SQLITE_FILE = path.join(DATA_DIR, 'college_attendance.sqlite');

class DatabaseService {
  constructor() {
    this.isPg = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres'));
    this.pgPool = null;
    this.sqliteDb = null;
    this.isInitialized = false;
    this.batchMode = false;
    this.hasPendingSave = false;
  }

  startBatch() {
    this.batchMode = true;
  }

  endBatch() {
    this.batchMode = false;
    if (this.hasPendingSave) {
      this.saveSqlite();
    }
  }

  async init() {
    if (this.isInitialized) return;

    if (this.isPg) {
      console.log('Connecting to PostgreSQL database via DATABASE_URL...');
      this.pgPool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      });
      await this.initPgTables();
    } else {
      console.log(`Using persistent SQLite database at: ${SQLITE_FILE}`);
      const SQL = await initSqlJs();
      if (fs.existsSync(SQLITE_FILE)) {
        const fileBuffer = fs.readFileSync(SQLITE_FILE);
        this.sqliteDb = new SQL.Database(fileBuffer);
      } else {
        this.sqliteDb = new SQL.Database();
      }
      this.initSqliteTables();
      this.saveSqlite();
    }

    this.isInitialized = true;
    console.log('Database initialized successfully.');
  }

  saveSqlite() {
    if (!this.sqliteDb || this.isPg) return;
    if (this.batchMode) {
      this.hasPendingSave = true;
      return;
    }
    try {
      const data = this.sqliteDb.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(SQLITE_FILE, buffer);
      this.hasPendingSave = false;
    } catch (err) {
      console.error('Error saving SQLite database to disk:', err);
    }
  }

  initSqliteTables() {
    this.sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS students (
        cu_id TEXT PRIMARY KEY,
        student_name TEXT NOT NULL,
        roll_number TEXT,
        father_name TEXT,
        course TEXT,
        branch TEXT,
        semester TEXT,
        section TEXT,
        email TEXT,
        phone TEXT,
        password_hash TEXT,
        password_changed INTEGER DEFAULT 0,
        overall_percentage REAL DEFAULT 0,
        total_sessions INTEGER DEFAULT 0,
        present_sessions INTEGER DEFAULT 0,
        absent_sessions INTEGER DEFAULT 0,
        import_job_id TEXT,
        last_updated TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS attendance_records (
        id TEXT PRIMARY KEY,
        cu_id TEXT NOT NULL,
        attendance_date TEXT NOT NULL,
        subject TEXT NOT NULL,
        total_sessions INTEGER NOT NULL DEFAULT 1,
        present_sessions INTEGER NOT NULL DEFAULT 1,
        absent_sessions INTEGER NOT NULL DEFAULT 0,
        assignments_uploaded INTEGER DEFAULT 0,
        import_job_id TEXT,
        attendance_percentage REAL NOT NULL DEFAULT 100,
        status TEXT NOT NULL DEFAULT 'Present',
        created_at TEXT NOT NULL,
        FOREIGN KEY (cu_id) REFERENCES students(cu_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS assignments (
        id TEXT PRIMARY KEY,
        assignment_id TEXT NOT NULL,
        cu_id TEXT NOT NULL,
        assignment_name TEXT NOT NULL,
        subject TEXT NOT NULL,
        submission_deadline TEXT NOT NULL,
        submission_status TEXT NOT NULL DEFAULT 'Pending',
        submission_date TEXT,
        remarks TEXT,
        import_job_id TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (cu_id) REFERENCES students(cu_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS import_jobs (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        uploaded_by TEXT NOT NULL,
        import_type TEXT NOT NULL DEFAULT 'admin_upload',
        status TEXT NOT NULL DEFAULT 'success',
        total_rows INTEGER DEFAULT 0,
        students_updated INTEGER DEFAULT 0,
        attendance_updated INTEGER DEFAULT 0,
        assignments_updated INTEGER DEFAULT 0,
        errors_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS import_errors (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        sheet_name TEXT NOT NULL,
        row_number INTEGER NOT NULL,
        cu_id TEXT,
        error_message TEXT NOT NULL,
        raw_data TEXT,
        FOREIGN KEY (job_id) REFERENCES import_jobs(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        ip_address TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cloud_sync_configurations (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL DEFAULT 'google_drive',
        folder_or_file_id TEXT,
        file_name TEXT,
        sync_interval_minutes INTEGER DEFAULT 15,
        last_sync_time TEXT,
        last_file_modified_time TEXT,
        status TEXT DEFAULT 'idle',
        last_error TEXT,
        is_enabled INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS admin_messages (
        id TEXT PRIMARY KEY,
        sender_title TEXT NOT NULL DEFAULT 'Admin',
        message TEXT NOT NULL,
        target_type TEXT NOT NULL DEFAULT 'all',
        target_value TEXT,
        priority TEXT NOT NULL DEFAULT 'normal',
        created_at TEXT NOT NULL,
        created_by TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_attendance_cu_id ON attendance_records(cu_id);
      CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(attendance_date);
      CREATE INDEX IF NOT EXISTS idx_assignments_cu_id ON assignments(cu_id);
      CREATE INDEX IF NOT EXISTS idx_students_branch ON students(branch);
      CREATE INDEX IF NOT EXISTS idx_import_errors_job ON import_errors(job_id);
      CREATE INDEX IF NOT EXISTS idx_admin_messages_target ON admin_messages(target_type, target_value);
    `);

    // Ensure columns exist on already-created SQLite tables
    try { this.sqliteDb.run('ALTER TABLE attendance_records ADD COLUMN assignments_uploaded INTEGER DEFAULT 0'); } catch(e) {}
    try { this.sqliteDb.run('ALTER TABLE attendance_records ADD COLUMN import_job_id TEXT'); } catch(e) {}
    try { this.sqliteDb.run('ALTER TABLE assignments ADD COLUMN import_job_id TEXT'); } catch(e) {}
    try { this.sqliteDb.run('ALTER TABLE students ADD COLUMN import_job_id TEXT'); } catch(e) {}
    try { this.sqliteDb.run('ALTER TABLE students ADD COLUMN password_changed INTEGER DEFAULT 0'); } catch(e) {}
    try {
      this.sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS admin_messages (
          id TEXT PRIMARY KEY,
          sender_title TEXT NOT NULL DEFAULT 'Admin',
          message TEXT NOT NULL,
          target_type TEXT NOT NULL DEFAULT 'all',
          target_value TEXT,
          priority TEXT NOT NULL DEFAULT 'normal',
          created_at TEXT NOT NULL,
          created_by TEXT
        )
      `);
    } catch(e) {}
  }

  async initPgTables() {
    const client = await this.pgPool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(64) PRIMARY KEY,
          username VARCHAR(100) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL DEFAULT 'admin',
          created_at TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS students (
          cu_id VARCHAR(64) PRIMARY KEY,
          student_name VARCHAR(255) NOT NULL,
          roll_number VARCHAR(100),
          father_name VARCHAR(255),
          course VARCHAR(100),
          branch VARCHAR(100),
          semester VARCHAR(50),
          section VARCHAR(50),
          email VARCHAR(255),
          phone VARCHAR(50),
          password_hash VARCHAR(255),
          overall_percentage DOUBLE PRECISION DEFAULT 0,
          total_sessions INTEGER DEFAULT 0,
          present_sessions INTEGER DEFAULT 0,
          absent_sessions INTEGER DEFAULT 0,
          last_updated TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS attendance_records (
          id VARCHAR(64) PRIMARY KEY,
          cu_id VARCHAR(64) NOT NULL REFERENCES students(cu_id) ON DELETE CASCADE,
          attendance_date VARCHAR(50) NOT NULL,
          subject VARCHAR(255) NOT NULL,
          total_sessions INTEGER NOT NULL DEFAULT 1,
          present_sessions INTEGER NOT NULL DEFAULT 1,
          absent_sessions INTEGER NOT NULL DEFAULT 0,
          attendance_percentage DOUBLE PRECISION NOT NULL DEFAULT 100,
          status VARCHAR(50) NOT NULL DEFAULT 'Present',
          created_at TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS assignments (
          id VARCHAR(64) PRIMARY KEY,
          assignment_id VARCHAR(64) NOT NULL,
          cu_id VARCHAR(64) NOT NULL REFERENCES students(cu_id) ON DELETE CASCADE,
          assignment_name VARCHAR(255) NOT NULL,
          subject VARCHAR(255) NOT NULL,
          submission_deadline VARCHAR(50) NOT NULL,
          submission_status VARCHAR(50) NOT NULL DEFAULT 'Pending',
          submission_date VARCHAR(50),
          remarks TEXT,
          created_at TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS import_jobs (
          id VARCHAR(64) PRIMARY KEY,
          filename VARCHAR(255) NOT NULL,
          uploaded_by VARCHAR(100) NOT NULL,
          import_type VARCHAR(50) NOT NULL DEFAULT 'admin_upload',
          status VARCHAR(50) NOT NULL DEFAULT 'success',
          total_rows INTEGER DEFAULT 0,
          students_updated INTEGER DEFAULT 0,
          attendance_updated INTEGER DEFAULT 0,
          assignments_updated INTEGER DEFAULT 0,
          errors_count INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS import_errors (
          id VARCHAR(64) PRIMARY KEY,
          job_id VARCHAR(64) NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
          sheet_name VARCHAR(100) NOT NULL,
          row_number INTEGER NOT NULL,
          cu_id VARCHAR(64),
          error_message TEXT NOT NULL,
          raw_data TEXT
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64),
          action VARCHAR(100) NOT NULL,
          details TEXT NOT NULL,
          ip_address VARCHAR(64),
          created_at TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS cloud_sync_configurations (
          id VARCHAR(64) PRIMARY KEY,
          provider VARCHAR(50) NOT NULL DEFAULT 'google_drive',
          folder_or_file_id VARCHAR(255),
          file_name VARCHAR(255),
          sync_interval_minutes INTEGER DEFAULT 15,
          last_sync_time TIMESTAMPTZ,
          last_file_modified_time TIMESTAMPTZ,
          status VARCHAR(50) DEFAULT 'idle',
          last_error TEXT,
          is_enabled INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS admin_messages (
          id VARCHAR(64) PRIMARY KEY,
          sender_title VARCHAR(100) NOT NULL DEFAULT 'Admin',
          message TEXT NOT NULL,
          target_type VARCHAR(50) NOT NULL DEFAULT 'all',
          target_value VARCHAR(255),
          priority VARCHAR(50) NOT NULL DEFAULT 'normal',
          created_at TIMESTAMPTZ NOT NULL,
          created_by VARCHAR(100)
        );

        CREATE INDEX IF NOT EXISTS idx_attendance_cu_id ON attendance_records(cu_id);
        CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(attendance_date);
        CREATE INDEX IF NOT EXISTS idx_assignments_cu_id ON assignments(cu_id);
        CREATE INDEX IF NOT EXISTS idx_students_branch ON students(branch);
        CREATE INDEX IF NOT EXISTS idx_import_errors_job ON import_errors(job_id);
        CREATE INDEX IF NOT EXISTS idx_admin_messages_target ON admin_messages(target_type, target_value);
      `);
    } finally {
      client.release();
    }
  }

  // Convert ? placeholders to $1, $2, ... for PostgreSQL
  formatPgSql(sql) {
    let index = 1;
    return sql.replace(/\?/g, () => `$${index++}`);
  }

  async query(sql, params = []) {
    await this.init();

    if (this.isPg) {
      const pgSql = this.formatPgSql(sql);
      const result = await this.pgPool.query(pgSql, params);
      return result.rows;
    } else {
      const stmt = this.sqliteDb.prepare(sql);
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    }
  }

  async get(sql, params = []) {
    const rows = await this.query(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async all(sql, params = []) {
    return this.query(sql, params);
  }

  async run(sql, params = []) {
    await this.init();

    if (this.isPg) {
      const pgSql = this.formatPgSql(sql);
      const result = await this.pgPool.query(pgSql, params);
      return { changes: result.rowCount };
    } else {
      this.sqliteDb.run(sql, params);
      this.saveSqlite();
      return { changes: 1 };
    }
  }

  async transaction(fn) {
    await this.init();
    if (this.isPg) {
      const client = await this.pgPool.connect();
      try {
        await client.query('BEGIN');
        const res = await fn(this);
        await client.query('COMMIT');
        return res;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      try {
        this.startBatch();
        this.sqliteDb.run('BEGIN TRANSACTION;');
        const res = await fn(this);
        this.sqliteDb.run('COMMIT;');
        this.endBatch();
        return res;
      } catch (err) {
        this.sqliteDb.run('ROLLBACK;');
        this.batchMode = false;
        this.hasPendingSave = false;
        throw err;
      }
    }
  }
}

export const db = new DatabaseService();
export default db;
