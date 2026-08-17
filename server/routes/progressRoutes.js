const router = require('express').Router();
const multer = require('multer');
const { verifyJWT } = require('../middleware/auth');
const { uploadProgressPhoto, getProgressPhoto, getWeeklyInsights, listProgress, getTodayProgress, saveWorkoutCompletion, saveTodayProgress, saveTodayNutrition, getProgress, createProgress, updateProgress } = require('../controllers/progressController');

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 8, parts: 10 },
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, and WebP photos are supported.'));
    }
    cb(null, true);
  },
});

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
