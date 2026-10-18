import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import db from './database.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'college_attendance_super_secret_key_2026';
const JWT_EXPIRES_IN = '24h';

// Rate Limiter tracking
const rateLimitMap = new Map();

export function rateLimitMiddleware(limit = 60, windowMs = 60 * 1000) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown-ip';
    const key = `${ip}:${req.path}`;
    const now = Date.now();

    const record = rateLimitMap.get(key) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
    } else {
      record.count += 1;
    }

    rateLimitMap.set(key, record);

    if (record.count > limit) {
      return res.status(429).json({
        error: 'Too many requests. Please wait a moment before trying again.',
        retryAfterSeconds: Math.ceil((record.resetTime - now) / 1000),
      });
    }

    next();
  };
}

export function hashPassword(plainText) {
  return bcrypt.hashSync(plainText, 10);
}

export function comparePassword(plainText, hash) {
  return bcrypt.compareSync(plainText, hash);
}

export function generateToken(payload, expiresIn = JWT_EXPIRES_IN) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

export function isAdminRole(role) {
  return role === 'super_admin' || role === 'hod' || role === 'admin';
}

export function isSuperAdminRole(user) {
  if (!user) return false;
  return user.role === 'super_admin' || (user.role === 'admin' && (user.department === 'ALL' || !user.department));
}

// Admin only middleware (Super Admin or HOD)
export async function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded || !isAdminRole(decoded.role)) {
    return res.status(403).json({ error: 'Access forbidden: Administrator privileges required' });
  }

  try {
    const user = await db.get(
      'SELECT id, username, email, role, department, status, must_change_password FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!user) {
      return res.status(401).json({ error: 'Administrator account no longer exists' });
    }

    if (user.status === 'disabled') {
      return res.status(403).json({ error: 'This administrator account has been disabled. Please contact the Super Admin.' });
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role || decoded.role,
      department: user.department || 'ALL',
      status: user.status || 'active',
      must_change_password: Boolean(user.must_change_password),
    };
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to verify administrator status' });
  }
}

// Super Admin only middleware
export async function requireSuperAdmin(req, res, next) {
  await requireAdmin(req, res, () => {
    if (!isSuperAdminRole(req.user)) {
      return res.status(403).json({
        error: 'Access denied: Super Administrator privileges required. You do not have permission to manage administrator accounts.',
      });
    }
    next();
  });
}

// Student or Admin access middleware
export function requireStudentOrAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }

  const targetCuId = (req.params.cu_id || req.query.cu_id || req.body?.cu_id || '').toUpperCase().trim();

  // If admin or HOD, allowed to view student records
  if (isAdminRole(decoded.role)) {
    req.user = decoded;
    return next();
  }

  // If student, can ONLY view their own records
  if (decoded.role === 'student') {
    if (targetCuId) {
      const decodedUpper = (decoded.cu_id || '').toUpperCase().trim();
      const decodedClean = decodedUpper.replace(/^CU[-_ ]*/i, '');
      const targetClean = targetCuId.replace(/^CU[-_ ]*/i, '');
      if (decodedUpper !== targetCuId && decodedClean !== targetClean) {
        return res.status(403).json({
          error: 'Access denied: You are not authorized to view records of another student.',
        });
      }
    }
    req.user = decoded;
    return next();
  }

  return res.status(403).json({ error: 'Unauthorized access' });
}

// In-memory OTP storage for 2-factor student verification
const studentOtpStore = new Map();

export function generateStudentOtp(cuId) {
  const normalizedCuId = cuId.toUpperCase().trim();
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  studentOtpStore.set(normalizedCuId, {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  });
  return code;
}

export function verifyStudentOtp(cuId, inputCode) {
  const normalizedCuId = cuId.toUpperCase().trim();
  const stored = studentOtpStore.get(normalizedCuId);
  if (!stored) return false;
  if (Date.now() > stored.expiresAt) {
    studentOtpStore.delete(normalizedCuId);
    return false;
  }
  if (stored.code === inputCode.trim()) {
    studentOtpStore.delete(normalizedCuId);
    return true;
  }
  return false;
}
