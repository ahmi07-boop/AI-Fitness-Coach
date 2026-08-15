const Stripe = require('stripe');

let stripeClient;

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    const error = new Error('Stripe is not configured. Set STRIPE_SECRET_KEY in server/.env.');
    error.statusCode = 503;
    throw error;
  }
  if (!stripeClient) stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripeClient;
}

function getPriceId() {
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    const error = new Error('Stripe subscription price is not configured. Set STRIPE_PRICE_ID in server/.env.');
    error.statusCode = 503;
    throw error;
  }
  return priceId;
}

function getSuccessUrl() {
  return process.env.STRIPE_SUCCESS_URL || `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/billing?success=1`;
}

function getCancelUrl() {
  return process.env.STRIPE_CANCEL_URL || `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/billing?canceled=1`;
}

async function createCheckoutSession(user) {
  const stripe = getStripe();
  const priceId = getPriceId();
  user.billing = user.billing || {};
  let customerId = user.billing?.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: String(user._id) },
    });
    customerId = customer.id;
    user.billing.stripeCustomerId = customerId;
    await user.save();
  }

  return stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: getSuccessUrl(),
    cancel_url: getCancelUrl(),
    allow_promotion_codes: true,
    metadata: { userId: String(user._id) },
    subscription_data: { metadata: { userId: String(user._id) } },
  });
}

async function createPortalSession(user) {
  if (!user.billing?.stripeCustomerId) {
    const error = new Error('No Stripe customer exists for this account yet.');
    error.statusCode = 400;
    throw error;
  }
  const stripe = getStripe();
  return stripe.billingPortal.sessions.create({
    customer: user.billing.stripeCustomerId,
    return_url: `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/billing`,
  });
}

async function retrieveSubscription(subscriptionId) {
  if (!subscriptionId) return null;
  return getStripe().subscriptions.retrieve(subscriptionId);
}

module.exports = { getStripe, getPriceId, createCheckoutSession, createPortalSession, retrieveSubscription };
