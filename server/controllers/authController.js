const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AdminLog = require('../models/AdminLog');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
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
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'A profile picture is required.' });
  }

  const avatarDirectory = path.join(__dirname, '..', 'uploads', 'profiles');
  fs.mkdirSync(avatarDirectory, { recursive: true });
  const filename = `${String(req.user._id)}-${Date.now()}.webp`;
  const outputPath = path.join(avatarDirectory, filename);

  try {
    await sharp(req.file.path)
      .rotate()
      .resize(512, 512, { fit: 'cover', position: 'centre' })
      .webp({ quality: 86 })
      .toFile(outputPath);

    const previousFilename = req.user.profile?.avatarPath;
    req.user.profile.avatarPath = filename;
    await req.user.save();

    if (previousFilename && previousFilename !== filename) {
      fs.unlink(path.join(avatarDirectory, path.basename(previousFilename)), () => {});
    }
    fs.unlink(req.file.path, () => {});

    return res.json({
      success: true,
      message: 'Profile picture updated.',
      data: { user: publicUser(req.user) },
    });
  } catch (error) {
    fs.unlink(req.file.path, () => {});
    throw error;
  }
}

async function getAvatar(req, res) {
  const avatarFilename = req.user.profile?.avatarPath;
  const avatarDirectory = path.join(__dirname, '..', 'uploads', 'profiles');
  const avatarPath = avatarFilename ? path.join(avatarDirectory, path.basename(avatarFilename)) : null;
  if (!avatarPath || !fs.existsSync(avatarPath)) {
    return res.status(404).json({ success: false, message: 'Profile picture not found.' });
  }
  res.setHeader('Cache-Control', 'private, max-age=300');
  return res.sendFile(path.resolve(avatarPath));
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
