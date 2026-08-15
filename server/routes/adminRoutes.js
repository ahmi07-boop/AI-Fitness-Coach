const router = require('express').Router();
const { verifyJWT, checkRole } = require('../middleware/auth');
const {
  listUsers,
  getUserAvatar,
  updateUser,
  dashboardSummary,
  listPlanTemplates,
  createPlanTemplate,
  updatePlanTemplate,
  assignPlanTemplate,
  listPlans,
  updatePlan,
  listAIOutputs,
  updateAIOutputStatus,
  listPromptTemplates,
  updatePromptTemplate,
  listImages,
  getImageFile,
  updateImageModeration,
  listChatModeration,
  moderateChat,
  listLogs,
  listAIUsage,
  listErrors,
} = require('../controllers/adminController');

router.use(verifyJWT, checkRole('admin'));

router.get('/summary', dashboardSummary);
router.get('/users', listUsers);
router.patch('/users/:id', updateUser);
router.get('/users/:id/avatar', getUserAvatar);
router.get('/plans/templates', listPlanTemplates);
router.post('/plans/templates', createPlanTemplate);
router.patch('/plans/templates/:id', updatePlanTemplate);
router.post('/plans/assign-template', assignPlanTemplate);
router.get('/plans', listPlans);
router.patch('/plans/:id', updatePlan);
router.get('/ai/outputs', listAIOutputs);
router.patch('/ai/outputs/:id', updateAIOutputStatus);
router.get('/ai/prompts', listPromptTemplates);
router.patch('/ai/prompts/:key', updatePromptTemplate);
router.get('/moderation/images', listImages);
router.get('/moderation/images/:id/file/:position', getImageFile);
router.patch('/moderation/images/:id', updateImageModeration);
router.get('/moderation/chats', listChatModeration);
router.patch('/moderation/chats/:id', moderateChat);
router.get('/logs', listLogs);
router.get('/logs/ai-usage', listAIUsage);
router.get('/logs/errors', listErrors);

module.exports = router;
