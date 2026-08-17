const router = require('express').Router();
const multer = require('multer');
const { verifyJWT } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/security');
const { register, login, me, updateProfile, uploadAvatar, getAvatar, clearAuthCookie } = require('../controllers/authController');

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 4, parts: 6 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, and WebP profile pictures are supported.'));
    }
    cb(null, true);
  },
});

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many authentication attempts. Please wait and try again.',
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', (req, res) => { clearAuthCookie(res); return res.json({ success: true, message: 'Signed out.' }); });
router.get('/me', verifyJWT, me);
router.patch('/me/profile', verifyJWT, updateProfile);
router.post('/me/avatar', verifyJWT, avatarUpload.single('avatar'), uploadAvatar);
router.get('/me/avatar', verifyJWT, getAvatar);

module.exports = router;
