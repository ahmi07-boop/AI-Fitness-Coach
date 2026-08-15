const router = require('express').Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { verifyJWT } = require('../middleware/auth');
const { bodyAnalysis, history, compare } = require('../controllers/analysisController');

const uploadDirectory = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
  dest: uploadDirectory,
  limits: { fileSize: 10 * 1024 * 1024, files: 4, fields: 8, parts: 12, fieldNameSize: 64 },
  fileFilter: (req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(new Error('Only JPG, PNG, and WebP body images are supported.'));
    }
    callback(null, true);
  },
});

const uploadFields = upload.fields([
  { name: 'front', maxCount: 1 },
  { name: 'back', maxCount: 1 },
  { name: 'left', maxCount: 1 },
  { name: 'right', maxCount: 1 },
]);

router.post('/body-analysis', verifyJWT, uploadFields, bodyAnalysis);
router.get('/history', verifyJWT, history);
router.get('/compare', verifyJWT, compare);

module.exports = router;
