const Plan = require('../models/Plan');
const BodyAnalysis = require('../models/BodyAnalysis');
const { generatePersonalizedPlan, normalizeGoal } = require('../services/planGenerator');

const FREE_PLAN_LIMIT = Number(process.env.FREE_PLAN_LIMIT || 4);

function hasActiveSubscription(user) {
  return ['active', 'trialing'].includes(user.billing?.subscriptionStatus);
}

async function reserveFreeGeneration(userId) {
  const updated = await require('../models/User').findOneAndUpdate(
    { _id: userId, 'planUsage.freeGenerationsUsed': { $lt: FREE_PLAN_LIMIT }, $or: [
      { 'billing.subscriptionStatus': { $exists: false } },
      { 'billing.subscriptionStatus': { $nin: ['active', 'trialing'] } },
    ] },
    { $inc: { 'planUsage.freeGenerationsUsed': 1 } },
    { returnDocument: 'after' }
  );
  return updated;
}

function cleanPlanPayload(body) {
  const allowed = ['user', 'goal', 'title', 'summary', 'calories', 'protein', 'carbs', 'fat', 'hydrationLiters', 'meals', 'workout', 'notes', 'status', 'generatedBy', 'model', 'lastModifiedBy'];
  return Object.fromEntries(Object.entries(body).filter(([key]) => allowed.includes(key)));
}

async function listPlans(req, res) {
  const filter = {};
  if (req.user.role === 'admin') {
    if (req.query.userId) filter.user = req.query.userId;
  } else {
    filter.user = req.user._id;
  }
  if (req.query.status) filter.status = req.query.status;
  const plans = await Plan.find(filter).populate('user', 'name email').sort({ updatedAt: -1 });
  res.json({ success: true, count: plans.length, data: { plans } });
}

async function getMyPlan(req, res) {
  const plan = await Plan.findOne({ user: req.user._id }).sort({ updatedAt: -1 });
  res.json({ success: true, data: { plan: plan || null } });
}

async function getPlan(req, res) {
  const plan = await Plan.findById(req.params.id).populate('user', 'name email');
  if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });
  if (req.user.role !== 'admin' && String(plan.user._id || plan.user) !== String(req.user._id)) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }
  res.json({ success: true, data: { plan } });
}

async function generatePlan(req, res) {
  const requestedGoal = normalizeGoal(req.body?.goal || req.user.profile?.goal);
  const allowedGoals = ['weight-loss', 'weight-gain', 'muscle-building', 'maintenance'];
  if (!allowedGoals.includes(requestedGoal)) {
    return res.status(400).json({ success: false, message: 'Please select a valid fitness goal first.' });
  }

  const subscribed = hasActiveSubscription(req.user);
  let reservedFreeGeneration = false;

  if (!subscribed) {
    const used = Number(req.user.planUsage?.freeGenerationsUsed || 0);
    if (used >= FREE_PLAN_LIMIT) {
      return res.status(402).json({
        success: false,
        code: 'SUBSCRIPTION_REQUIRED',
        message: `You have used all ${FREE_PLAN_LIMIT} free AI plan generations. Please subscribe to continue.`,
        data: {
          freePlanLimit: FREE_PLAN_LIMIT,
          freeGenerationsUsed: used,
          subscriptionRequired: true,
        },
      });
    }

    const reservedUser = await reserveFreeGeneration(req.user._id);
    if (!reservedUser) {
      return res.status(402).json({
        success: false,
        code: 'SUBSCRIPTION_REQUIRED',
        message: `You have used all ${FREE_PLAN_LIMIT} free AI plan generations. Please subscribe to continue.`,
        data: { freePlanLimit: FREE_PLAN_LIMIT, subscriptionRequired: true },
      });
    }
    req.user = reservedUser;
    reservedFreeGeneration = true;
  }

  try {
    req.user.profile.goal = requestedGoal;
    await req.user.save();
    const analysis = await BodyAnalysis.findOne({ userId: req.user._id }).sort({ createdAt: -1 });
    const { plan: aiPlan, usage } = await generatePersonalizedPlan(req.user, analysis);

    const payload = {
      user: req.user._id,
      goal: requestedGoal,
      title: aiPlan.title,
      summary: aiPlan.summary,
      calories: aiPlan.calories,
      protein: aiPlan.protein,
      carbs: aiPlan.carbs,
      fat: aiPlan.fat,
      hydrationLiters: aiPlan.hydrationLiters,
      meals: aiPlan.meals,
      workout: aiPlan.workout,
      notes: aiPlan.notes,
      status: 'AI Generated',
      generatedBy: aiPlan.generatedBy,
      model: aiPlan.model,
      aiUsage: {
        promptTokens: Number(usage?.prompt_tokens || 0),
        completionTokens: Number(usage?.completion_tokens || 0),
        totalTokens: Number(usage?.total_tokens || 0),
        latencyMs: Number(usage?.latency_ms || 0),
      },
    };

    const plan = await Plan.findOneAndUpdate(
      { user: req.user._id }, payload,
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

    res.status(201).json({
      success: true,
      message: 'Personalized AI plan generated successfully.',
      data: {
        plan,
        usage,
        billing: {
          freePlanLimit: FREE_PLAN_LIMIT,
          freeGenerationsUsed: req.user.planUsage?.freeGenerationsUsed || 0,
          subscriptionActive: hasActiveSubscription(req.user),
        },
      },
    });
  } catch (error) {
    if (reservedFreeGeneration) {
      await require('../models/User').updateOne(
        { _id: req.user._id },
        { $inc: { 'planUsage.freeGenerationsUsed': -1 } }
      );
    }
    throw error;
  }
}

async function getPlanUsage(req, res) {
  const user = await require('../models/User').findById(req.user._id).select('planUsage billing');
  res.json({
    success: true,
    data: {
      freePlanLimit: FREE_PLAN_LIMIT,
      freeGenerationsUsed: Number(user?.planUsage?.freeGenerationsUsed || 0),
      freeGenerationsRemaining: Math.max(0, FREE_PLAN_LIMIT - Number(user?.planUsage?.freeGenerationsUsed || 0)),
      subscriptionActive: hasActiveSubscription(user),
      subscriptionStatus: user?.billing?.subscriptionStatus || 'none',
    },
  });
}

async function createPlan(req, res) {
  const payload = cleanPlanPayload(req.body);
  if (!payload.user || !payload.goal) return res.status(400).json({ success: false, message: 'user and goal are required.' });
  const plan = await Plan.create(payload);
  const populated = await plan.populate('user', 'name email');
  res.status(201).json({ success: true, message: 'Plan created.', data: { plan: populated } });
}

async function updatePlan(req, res) {
  const payload = cleanPlanPayload(req.body);
  const plan = await Plan.findByIdAndUpdate(req.params.id, payload, { returnDocument: 'after', runValidators: true }).populate('user', 'name email');
  if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });
  res.json({ success: true, message: 'Plan updated.', data: { plan } });
}

async function deletePlan(req, res) {
  const plan = await Plan.findByIdAndDelete(req.params.id);
  if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });
  res.json({ success: true, message: 'Plan deleted.' });
}

module.exports = { listPlans, getMyPlan, getPlan, generatePlan, getPlanUsage, createPlan, updatePlan, deletePlan };
