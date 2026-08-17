const User = require('../models/User');
const BillingEvent = require('../models/BillingEvent');
const { createCheckoutSession, createPortalSession, getStripe } = require('../services/stripeService');

function publicBilling(user) {
  return {
    freePlanLimit: Number(process.env.FREE_PLAN_LIMIT || 4),
    freeGenerationsUsed: Number(user.planUsage?.freeGenerationsUsed || 0),
    freeGenerationsRemaining: Math.max(0, Number(process.env.FREE_PLAN_LIMIT || 4) - Number(user.planUsage?.freeGenerationsUsed || 0)),
    subscriptionStatus: user.billing?.subscriptionStatus || 'none',
    subscriptionActive: ['active', 'trialing'].includes(user.billing?.subscriptionStatus),
    currentPeriodEnd: user.billing?.currentPeriodEnd || null,
    cancelAtPeriodEnd: Boolean(user.billing?.cancelAtPeriodEnd),
  };
}

async function getBillingStatus(req, res) {
  const user = await User.findById(req.user._id);
  res.json({ success: true, data: publicBilling(user) });
}

async function createCheckout(req, res) {
  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  if (['active', 'trialing'].includes(user.billing?.subscriptionStatus)) {
    return res.status(409).json({ success: false, message: 'You already have an active subscription.' });
  }
  const session = await createCheckoutSession(user);
  res.json({ success: true, data: { url: session.url, sessionId: session.id } });
}

async function createPortal(req, res) {
  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  const session = await createPortalSession(user);
  res.json({ success: true, data: { url: session.url } });
}

async function handleSubscription(user, subscription) {
  if (!user || !subscription) return;
  user.billing = user.billing || {};
  user.billing.stripeSubscriptionId = subscription.id;
  user.billing.subscriptionStatus = subscription.status || 'none';
  user.billing.priceId = subscription.items?.data?.[0]?.price?.id || null;
  user.billing.currentPeriodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null;
  user.billing.cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);
  await user.save();
}

async function webhook(req, res) {
  const signature = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.replace(/\s+/g, '');
  if (!secret) return res.status(503).send('Stripe webhook is not configured.');

  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, signature, secret);
  } catch (error) {
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  const existing = await BillingEvent.findOne({ stripeEventId: event.id });
  if (existing) return res.json({ received: true, duplicate: true });

  const object = event.data.object;
  let userId = object?.metadata?.userId || null;
  if (!userId && object?.customer) {
    const customerUser = await User.findOne({ 'billing.stripeCustomerId': object.customer }).select('_id');
    userId = customerUser?._id || null;
  }

  const user = userId ? await User.findById(userId) : null;

  switch (event.type) {
    case 'checkout.session.completed': {
      const subscriptionId = object.subscription;
      if (user && subscriptionId) {
        const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
        await handleSubscription(user, subscription);
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await handleSubscription(user, object);
      break;
    case 'invoice.paid':
      if (user && object.subscription) {
        const subscription = await getStripe().subscriptions.retrieve(object.subscription);
        await handleSubscription(user, subscription);
      }
      break;
    case 'invoice.payment_failed':
      if (user) {
        user.billing.subscriptionStatus = 'past_due';
        await user.save();
      }
      break;
    default:
      break;
  }

  await BillingEvent.create({ stripeEventId: event.id, type: event.type, user: user?._id || null });
  return res.json({ received: true });
}

module.exports = { getBillingStatus, createCheckout, createPortal, webhook };
