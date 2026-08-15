const router = require('express').Router();
const { verifyJWT, checkRole } = require('../middleware/auth');
const { listPlans, getMyPlan, getPlan, generatePlan, getPlanUsage, createPlan, updatePlan, deletePlan } = require('../controllers/planController');

router.use(verifyJWT);
router.get('/', listPlans);
router.get('/me', getMyPlan);
router.get('/usage', getPlanUsage);
router.post('/generate', generatePlan);
router.get('/:id', getPlan);
router.post('/', checkRole('admin'), createPlan);
router.patch('/:id', checkRole('admin'), updatePlan);
router.delete('/:id', checkRole('admin'), deletePlan);

module.exports = router;
