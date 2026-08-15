const router = require('express').Router();
const { verifyJWT } = require('../middleware/auth');
const { retrieveContext } = require('../services/ragService');

router.use(verifyJWT);

router.post('/search', async (req, res, next) => {
  try {
    const query = String(req.body?.query || '').trim();
    if (!query) return res.status(400).json({ success: false, message: 'query is required.' });
    const docs = await retrieveContext(req.user._id, query, req.user);
    res.json({
      success: true,
      data: docs.map(({ id, sourceType, sourceId, content, score }) => ({
        id,
        sourceType,
        sourceId,
        content,
        score,
      })),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
