const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AdminLog = require('../models/AdminLog');
const path = require('path');
const sharp = require('sharp');
const { uploadBuffer, getFile, openDownloadStream, deleteFile, isStoredFileId, isAllowedLegacyPath, legacyFileExists } = require('../services/storageService');
const AUTH_COOKIE = 'fitcoach_session';

function setAuthCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production';
  const parts = [
    `${AUTH_COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    `SameSite=${secure ? 'None' : 'Lax'}`,
    'Max-Age=604800',
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearAuthCookie(res) {
  const secure = process.env.NODE_ENV === 'production';
  const parts = [`${AUTH_COOKIE}=`, 'HttpOnly', 'Path=/', `SameSite=${secure ? 'None' : 'Lax'}`, 'Max-Age=0'];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}


async function register(req, res) {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser) {
    return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name: name.trim(), email: normalizedEmail, passwordHash });
  await AdminLog.create({ event: 'User signup', targetUser: user._id, status: 'Success', metadata: { email: normalizedEmail } });

  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });
  setAuthCookie(res, token);

  return res.status(201).json({
    success: true,
    message: 'Account created successfully.',
    data: { user: publicUser(user) },
  });
}

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');

  if (!user || !user.isActive || (user.accountStatus && user.accountStatus !== 'active')) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  user.lastLogin = new Date();
  await user.save();
  await AdminLog.create({ event: 'User login', targetUser: user._id, status: 'Success', metadata: { email: user.email } });

  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });

  setAuthCookie(res, token);
  return res.json({ success: true, data: { user: publicUser(user) } });
}

async function me(req, res) {
  const user = req.user;
  return res.json({ success: true, data: { user: publicUser(user) } });
}

async function uploadAvatar(req, res) {
  if (!req.file?.buffer) {
    return res.status(400).json({ success: false, message: 'A profile picture is required.' });
  }

  const previousFileId = req.user.profile?.avatarPath;

  try {
    const optimizedBuffer = await sharp(req.file.buffer, { failOn: 'error' })
      .rotate()
      .resize(512, 512, { fit: 'cover', position: 'centre' })
      .webp({ quality: 86 })
      .toBuffer();

    const stored = await uploadBuffer(optimizedBuffer, {
      filename: `${String(req.user._id)}-${Date.now()}.webp`,
      contentType: 'image/webp',
      metadata: {
        ownerUserId: String(req.user._id),
        purpose: 'profile-avatar',
      },
    });

    req.user.profile.avatarPath = stored.fileId;
    await req.user.save();

    if (previousFileId && isStoredFileId(previousFileId)) {
      await deleteFile(previousFileId).catch((error) => {
        console.warn('Previous avatar cleanup failed:', error.message);
      });
    }

    return res.json({
      success: true,
      message: 'Profile picture updated.',
      data: { user: publicUser(req.user) },
    });
  } catch (error) {
    throw error;
  }
}

async function getAvatar(req, res) {
  const avatarFileId = req.user.profile?.avatarPath;

  if (isStoredFileId(avatarFileId)) {
    const file = await getFile(avatarFileId);
    if (!file) {
      return res.status(404).json({ success: false, message: 'Profile picture not found.' });
    }

    res.setHeader('Content-Type', file.contentType || 'image/webp');
    res.setHeader('Content-Length', String(file.length));
    res.setHeader('Cache-Control', 'private, max-age=300, must-revalidate');

    const stream = openDownloadStream(avatarFileId);
    stream.on('error', (error) => {
      if (!res.headersSent) {
        res.status(404).json({ success: false, message: 'Profile picture not found.' });
      } else {
        res.destroy(error);
      }
    });
    return stream.pipe(res);
  }

  // Backward-compatible fallback for legacy local avatars. New uploads never
  // use the Railway filesystem.
  const avatarDirectory = path.join(__dirname, '..', 'uploads', 'profiles');
  const avatarPath = avatarFileId ? path.join(avatarDirectory, path.basename(avatarFileId)) : null;
  if (!avatarPath || !isAllowedLegacyPath(avatarPath) || !(await legacyFileExists(avatarPath))) {
    // Clear only the stale pointer; the user account remains intact.
    if (avatarFileId && req.user.profile?.avatarPath === avatarFileId) {
      req.user.profile.avatarPath = null;
      await req.user.save().catch((error) => {
        console.warn('Unable to clear stale legacy avatar reference:', error.message);
      });
    }
    return res.status(404).json({ success: false, message: 'Profile picture is no longer available. Please upload a new picture.' });
  }
  res.setHeader('Cache-Control', 'private, max-age=300, must-revalidate');
  return new Promise((resolve) => {
    res.sendFile(path.resolve(avatarPath), (error) => {
      if (!error) return resolve();
      if (!res.headersSent) {
        res.status(404).json({ success: false, message: 'Profile picture is no longer available.' });
      }
      resolve();
    });
  });
}

async function updateProfile(req, res) {
  const allowed = ['age', 'gender', 'heightCm', 'weightKg', 'goal', 'activityLevel', 'dietaryPreference', 'allergies'];
  const profile = {};
  for (const key of allowed) {
    if (req.body.profile?.[key] !== undefined) profile[key] = req.body.profile[key];
  }

  const name = req.body.name !== undefined ? String(req.body.name).trim() : undefined;
  const email = req.body.email !== undefined ? String(req.body.email).trim().toLowerCase() : undefined;

  if (name !== undefined) {
    if (!name || name.length > 100) {
      return res.status(400).json({ success: false, message: 'Name must be between 1 and 100 characters.' });
    }
    req.user.name = name;
  }

  if (email !== undefined && email !== req.user.email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }
    const existing = await User.findOne({ email, _id: { $ne: req.user._id } }).select('_id');
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }
    req.user.email = email;
  }

  req.user.profile = { ...req.user.profile.toObject?.(), ...profile };
  await req.user.save();
  return res.json({ success: true, message: 'Profile updated.', data: { user: publicUser(req.user) } });
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    accountStatus: user.accountStatus,
    lastLogin: user.lastLogin,
    profile: user.profile,
    planUsage: user.planUsage,
    billing: user.billing,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

module.exports = { register, login, me, updateProfile, uploadAvatar, getAvatar, clearAuthCookie };
