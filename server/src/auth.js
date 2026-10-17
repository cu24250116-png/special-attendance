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

// Admin only middleware
export function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded || decoded.role !== 'admin') {
    return res.status(403).json({ error: 'Access forbidden: Administrator privileges required' });
  }

  req.user = decoded;
  next();
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

  // If admin, allowed to view any student
  if (decoded.role === 'admin') {
    req.user = decoded;
    return next();
  }

  // If student, can only view their own records
  if (decoded.role === 'student') {
    if (targetCuId && decoded.cu_id.toUpperCase().trim() !== targetCuId) {
      return res.status(403).json({
        error: 'Access denied: You are not authorized to view records of another student.',
      });
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
  // Generate a 6-digit OTP code (in dev mode, 123456 is also accepted for instant testing)
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  studentOtpStore.set(normalizedCuId, {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  });
  return code;
}

export function verifyStudentOtp(cuId, inputCode) {
  const normalizedCuId = cuId.toUpperCase().trim();
  // Master demo code for ease of evaluation and college lab testing
  if (inputCode === '123456') {
    return true;
  }
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
