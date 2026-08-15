const router = require('express').Router();
const { verifyJWT, checkRole } = require('../middleware/auth');
const {
  listConversations,
  getMyConversation,
  getConversation,
  createConversation,
  addMessage,
  sendMessage,
  updateModeration,
} = require('../controllers/chatController');

router.use(verifyJWT);

router.get('/', listConversations);
router.get('/me', getMyConversation);
router.post('/', createConversation);
router.post('/message', sendMessage);
router.get('/:id', getConversation);
router.post('/:id/messages', addMessage);
router.patch('/:id/moderation', checkRole('admin'), updateModeration);

module.exports = router;
