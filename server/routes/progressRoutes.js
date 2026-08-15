const router = require('express').Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { verifyJWT } = require('../middleware/auth');
const uploadDirectory = path.join(__dirname, '..', 'uploads', 'progress');
fs.mkdirSync(uploadDirectory, { recursive: true });
const upload = multer({ dest: uploadDirectory, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return cb(new Error('Only JPG, PNG, and WebP photos are supported.'));
  cb(null, true);
} });
const {
  getWeeklyInsights,
  uploadProgressPhoto,
  getProgressPhoto,
  listProgress,
  getTodayProgress,
  saveWorkoutCompletion,
  saveTodayProgress,
  saveTodayNutrition,
  getProgress,
  createProgress,
  updateProgress,
} = require('../controllers/progressController');

router.use(verifyJWT);

router.get('/weekly-insights', getWeeklyInsights);
router.post('/photos', upload.single('photo'), uploadProgressPhoto);
router.get('/:id/photo/:type', getProgressPhoto);
router.get('/', listProgress);
router.get('/today', getTodayProgress);
router.put('/today', saveTodayProgress);
router.put('/today/nutrition', saveTodayNutrition);
router.post('/workout-completion', saveWorkoutCompletion);
router.get('/:id', getProgress);
router.post('/', createProgress);
router.patch('/:id', updateProgress);

module.exports = router;
