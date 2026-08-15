const router = require('express').Router();
const { verifyJWT } = require('../middleware/auth');
const { getBillingStatus, createCheckout, createPortal } = require('../controllers/billingController');

router.use(verifyJWT);
router.get('/status', getBillingStatus);
router.post('/checkout', createCheckout);
router.post('/portal', createPortal);

module.exports = router;
