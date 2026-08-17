const fs = require('fs/promises');
const path = require('path');
const User = require('../models/User');
const Plan = require('../models/Plan');
const Progress = require('../models/Progress');
const ChatLog = require('../models/ChatLog');
const BodyAnalysis = require('../models/BodyAnalysis');
const AdminLog = require('../models/AdminLog');
const AIUsageLog = require('../models/AIUsageLog');
const PromptTemplate = require('../models/PromptTemplate');
const PlanTemplate = require('../models/PlanTemplate');
const { getFile, openDownloadStream, deleteFile, isStoredFileId, isAllowedLegacyPath, legacyFileExists } = require('../services/storageService');

const REPORT_TIMEZONE = process.env.APP_TIMEZONE || 'UTC';

function dateKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function safeRegex(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function writeAdminLog(admin, event, targetUser = null, status = 'Success', metadata = {}) {
  try {
    await AdminLog.create({ admin, event, targetUser, status, metadata });
  } catch (error) {
    console.error('Admin log error:', error.message);
  }
}


async function getUserAvatar(req, res) {
  const user = await User.findById(req.params.id).select('profile.avatarPath');
  if (!user?.profile?.avatarPath) return res.status(404).end();

  const avatarFileId = user.profile.avatarPath;
  if (isStoredFileId(avatarFileId)) {
    const file = await getFile(avatarFileId);
    if (!file) return res.status(404).end();

    res.setHeader('Content-Type', file.contentType || 'image/webp');
    res.setHeader('Content-Length', String(file.length));
    res.setHeader('Cache-Control', 'private, max-age=300, must-revalidate');

    const stream = openDownloadStream(avatarFileId);
    stream.on('error', (error) => {
      if (!res.headersSent) res.status(404).end();
      else res.destroy(error);
    });
    return stream.pipe(res);
  }

  // Backward-compatible fallback for legacy local avatars.
  const avatarDirectory = path.join(__dirname, '..', 'uploads', 'profiles');
  const avatarPath = path.join(avatarDirectory, path.basename(avatarFileId));
  if (!isAllowedLegacyPath(avatarPath) || !(await legacyFileExists(avatarPath))) {
    await User.updateOne(
      { _id: user._id, 'profile.avatarPath': avatarFileId },
      { $set: { 'profile.avatarPath': null } }
    ).catch((error) => {
      console.warn('Unable to clear stale legacy admin avatar reference:', error.message);
    });
    return res.status(404).end();
  }
  res.setHeader('Cache-Control', 'private, max-age=300, must-revalidate');
  return new Promise((resolve) => {
    res.sendFile(path.resolve(avatarPath), (error) => {
      if (!error) return resolve();
      if (!res.headersSent) res.status(404).end();
      resolve();
    });
  });
}

async function assignPlanTemplate(req, res) {
  const { userId, templateId } = req.body || {};
  if (!userId || !templateId) return res.status(400).json({ success:false, message:'userId and templateId are required.' });
  const [user, template] = await Promise.all([User.findById(userId).select('_id name email'), PlanTemplate.findById(templateId)]);
  if (!user) return res.status(404).json({ success:false, message:'User not found.' });
  if (!template || !template.active) return res.status(404).json({ success:false, message:'Active plan template not found.' });
  const plan = await Plan.create({
    user: user._id, goal: template.goal, title: template.name, summary: `Assigned by admin from ${template.name}.`,
    calories: template.calories, protein: template.protein, carbs: template.carbs, fat: template.fat,
    hydrationLiters: template.hydrationLiters, meals: template.meals || [], workout: template.workout || { daysPerWeek: 0, weeklySplit: [] },
    notes: template.notes || [], status: 'Manual Template', generatedBy: 'Admin', lastModifiedBy: req.user._id,
  });
  await writeAdminLog(req.user._id, 'Plan template assigned', user._id, 'Success', { planId: plan._id, templateId: template._id });
  const populated = await Plan.findById(plan._id).populate('user','name email');
  res.status(201).json({ success:true, message:'Template assigned to user.', data:{ plan: populated } });
}

async function listUsers(req, res) {
  const search = req.query.search?.trim();
  const status = req.query.status;
  const filter = {};
  const andFilters = [];

  if (search) {
    const regex = new RegExp(safeRegex(search), 'i');
    andFilters.push({ $or: [{ name: regex }, { email: regex }] });
  }

  if (status === 'Active') {
    andFilters.push({ $or: [{ accountStatus: 'active' }, { accountStatus: { $exists: false }, isActive: true }] });
  }
  if (status === 'Inactive') {
    andFilters.push({ $or: [{ accountStatus: 'inactive' }, { accountStatus: { $exists: false }, isActive: false }] });
  }
  if (status === 'Banned') {
    andFilters.push({ accountStatus: 'banned' });
  }

  if (andFilters.length) filter.$and = andFilters;

  const users = await User.find(filter).sort({ createdAt: -1 }).select('-passwordHash');
  const userIds = users.map((user) => user._id);
  const [plans, progress] = await Promise.all([
    Plan.find({ user: { $in: userIds } }).sort({ updatedAt: -1 }).select('user title goal status updatedAt'),
    Progress.find({ user: { $in: userIds } }).sort({ date: -1 }).select('user fitnessScore habitCompletionPercent workoutCompleted date').limit(Math.max(userIds.length * 30, 100)),
  ]);

  const planByUser = new Map();
  plans.forEach((plan) => { if (!planByUser.has(String(plan.user))) planByUser.set(String(plan.user), plan); });
  const progressByUser = new Map();
  progress.forEach((item) => {
    const key = String(item.user);
    if (!progressByUser.has(key)) progressByUser.set(key, []);
    if (progressByUser.get(key).length < 30) progressByUser.get(key).push(item);
  });

  const data = users.map((user) => {
    const history = progressByUser.get(String(user._id)) || [];
    const scoreValues = history.map((item) => item.fitnessScore).filter((value) => Number.isFinite(value));
    const progressPercent = history.length
      ? Math.round(history.reduce((sum, item) => sum + Number(item.habitCompletionPercent || 0), 0) / history.length)
      : 0;
    return {
      ...user.toObject(),
      plan: planByUser.get(String(user._id)) || null,
      progressStats: {
        entries: history.length,
        averageFitnessScore: scoreValues.length ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length) : null,
        averageCompletion: progressPercent,
        workouts: history.filter((item) => item.workoutCompleted).length,
      },
    };
  });

  res.json({ success: true, count: data.length, data: { users: data } });
}

async function updateUser(req, res) {
  const allowed = ['name', 'role', 'isActive', 'accountStatus', 'profile'];
  const payload = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));

  if (payload.role && !['user', 'admin'].includes(payload.role)) {
    return res.status(400).json({ success: false, message: 'Invalid role.' });
  }

  if (payload.accountStatus && !['active', 'inactive', 'banned'].includes(payload.accountStatus)) {
    return res.status(400).json({ success: false, message: 'Invalid account status.' });
  }

  const user = await User.findById(req.params.id).select('-passwordHash');
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

  const nextStatus = payload.accountStatus || (payload.isActive === false ? 'inactive' : payload.isActive === true ? 'active' : user.accountStatus || 'active');

  if (user.role === 'admin' && nextStatus !== 'active') {
    const activeAdmins = await User.countDocuments({
      role: 'admin',
      isActive: true,
      $or: [{ accountStatus: 'active' }, { accountStatus: { $exists: false } }],
    });
    if (activeAdmins <= 1) {
      return res.status(409).json({ success: false, message: 'The last active administrator cannot be deactivated or banned.' });
    }
  }

  if (user.role === 'admin' && payload.role && payload.role !== 'admin') {
    const activeAdmins = await User.countDocuments({
      role: 'admin',
      isActive: true,
      $or: [{ accountStatus: 'active' }, { accountStatus: { $exists: false } }],
    });
    if (activeAdmins <= 1 && (user.accountStatus || 'active') === 'active' && user.isActive) {
      return res.status(409).json({ success: false, message: 'The last active administrator cannot be demoted.' });
    }
  }

  payload.accountStatus = nextStatus;
  payload.isActive = nextStatus === 'active';

  Object.assign(user, payload);
  await user.save();

  await writeAdminLog(req.user._id, `User ${nextStatus}`, user._id, 'Success', { changes: payload });
  res.json({ success: true, message: 'User updated.', data: { user } });
}

async function dashboardSummary(req, res) {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalUsers, activeToday, activeWeek, totalPlans, totalConversations, chatMessages, progressScores, recentUsers, logs, aiRequests, averageAIResponse, activeUsersDaily, planCompletionDaily, aiUsageDaily, flaggedImages, flaggedChats, recentAdminLogs, recentAIUsage, recentUsersActivity, recentChatsActivity, recentImagesActivity] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ lastLogin: { $gte: dayAgo } }),
    User.countDocuments({ lastLogin: { $gte: weekAgo } }),
    Plan.countDocuments(),
    ChatLog.countDocuments(),
    ChatLog.aggregate([
      { $unwind: '$messages' },
      { $match: { 'messages.role': 'user', 'messages.createdAt': { $gte: monthAgo } } },
      { $count: 'count' },
    ]),
    Progress.aggregate([{ $match: { fitnessScore: { $ne: null } } }, { $group: { _id: null, average: { $avg: '$fitnessScore' } } }]),
    User.aggregate([{ $match: { createdAt: { $gte: new Date(now.getTime() - 8 * 30 * 24 * 60 * 60 * 1000) } } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: REPORT_TIMEZONE } }, users: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    AdminLog.countDocuments({ createdAt: { $gte: dayAgo } }),
    AIUsageLog.countDocuments({ createdAt: { $gte: monthAgo } }),
    AIUsageLog.aggregate([{ $match: { createdAt: { $gte: monthAgo }, status: 'success', latencyMs: { $gt: 0 } } }, { $group: { _id: null, average: { $avg: '$latencyMs' } } }]),
    AdminLog.aggregate([{ $match: { event: { $regex: /login/i }, createdAt: { $gte: weekAgo } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: REPORT_TIMEZONE } }, users: { $addToSet: '$targetUser' } } }, { $project: { _id: 1, users: { $size: '$users' } } }, { $sort: { _id: 1 } }]),
    Progress.aggregate([{ $match: { date: { $gte: weekAgo } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: REPORT_TIMEZONE } }, completion: { $avg: '$habitCompletionPercent' } } }, { $sort: { _id: 1 } }]),
    AIUsageLog.aggregate([{ $match: { createdAt: { $gte: weekAgo } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: REPORT_TIMEZONE } }, requests: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    BodyAnalysis.countDocuments({ moderationStatus: 'Flagged' }),
    ChatLog.countDocuments({ moderationStatus: { $in: ['Flagged', 'Blocked'] } }),
    AdminLog.find().populate('admin', 'name email').populate('targetUser', 'name email').sort({ createdAt: -1 }).limit(8).lean(),
    AIUsageLog.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(8).lean(),
    User.find().select('name email createdAt').sort({ createdAt: -1 }).limit(8).lean(),
    ChatLog.find().populate('user', 'name email').select('user moderationStatus updatedAt createdAt').sort({ updatedAt: -1 }).limit(8).lean(),
    BodyAnalysis.find().populate('userId', 'name email').select('userId moderationStatus createdAt updatedAt').sort({ createdAt: -1 }).limit(8).lean(),
  ]);

  const completedDays = await Progress.countDocuments({ completedDay: true });
  const totalProgressDays = await Progress.countDocuments();
  const planCompletion = totalProgressDays ? Math.round((completedDays / totalProgressDays) * 100) : 0;
  const chatbotRequests = Number(chatMessages[0]?.count || 0);
  const averageFitnessScore = Math.round(progressScores[0]?.average || 0);

  const activity = [
    ...recentAdminLogs.map((item) => ({
      id: `admin-${item._id}`, type: 'admin', title: item.event,
      detail: item.targetUser?.name || item.targetUser?.email || 'Admin activity',
      status: item.status, createdAt: item.createdAt,
    })),
    ...recentAIUsage.map((item) => ({
      id: `ai-${item._id}`, type: 'ai', title: item.operation === 'chat-moderation' ? 'AI safety check' : 'AI request',
      detail: `${item.operation}${item.user?.name ? ` · ${item.user.name}` : ''}`,
      status: item.status, createdAt: item.createdAt,
    })),
    ...recentUsersActivity.map((item) => ({
      id: `user-${item._id}`, type: 'user', title: 'New user registered',
      detail: item.name || item.email || 'New platform user', status: 'Success', createdAt: item.createdAt,
    })),
    ...recentChatsActivity.map((item) => ({
      id: `chat-${item._id}`, type: 'chat', title: 'Chat activity',
      detail: `Conversation updated${item.user?.name ? ` · ${item.user.name}` : ''}`,
      status: item.moderationStatus, createdAt: item.updatedAt || item.createdAt,
    })),
    ...recentImagesActivity.map((item) => ({
      id: `image-${item._id}`, type: 'moderation', title: 'Body image activity',
      detail: `${item.moderationStatus || 'Pending'}${item.userId?.name ? ` · ${item.userId.name}` : ''}`,
      status: item.moderationStatus, createdAt: item.createdAt || item.updatedAt,
    })),
  ]
    .filter((item) => item.createdAt)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 12)
    .map((item) => ({ ...item, createdAt: new Date(item.createdAt).toISOString() }));

  res.json({
    success: true,
    data: {
      users: totalUsers,
      activeToday,
      activeWeek,
      plans: totalPlans,
      conversations: totalConversations,
      chatbotRequests,
      aiRequests,
      avgResponseMs: Math.round(Number(averageAIResponse[0]?.average || 0)),
      uptimeSeconds: Math.round(process.uptime()),
      averageFitnessScore,
      planCompletion,
      systemEventsToday: logs,
      flaggedImages,
      flaggedChats,
      userGrowth: recentUsers.map((item) => ({ month: item._id, users: item.users })),
      activeUsersDaily: activeUsersDaily.map((item) => ({ day: item._id.slice(5), users: item.users })),
      planCompletionDaily: planCompletionDaily.map((item) => ({ day: item._id.slice(5), completion: Math.round(item.completion || 0) })),
      aiUsageDaily: aiUsageDaily.map((item) => ({ day: item._id.slice(5), requests: item.requests })),
      activity,
    },
  });
}

async function listPlanTemplates(req, res) {
  const templates = await PlanTemplate.find({ active: true }).populate('createdBy', 'name email').sort({ updatedAt: -1 });
  res.json({ success: true, count: templates.length, data: { templates } });
}

async function createPlanTemplate(req, res) {
  const { name, goal, calories, protein, carbs, fat, hydrationLiters, meals, workout, notes } = req.body;
  if (!name || !goal || calories === undefined || protein === undefined || carbs === undefined || fat === undefined) {
    return res.status(400).json({ success: false, message: 'name, goal and macro targets are required.' });
  }
  const template = await PlanTemplate.create({ name, goal, calories, protein, carbs, fat, hydrationLiters, meals, workout, notes, createdBy: req.user._id });
  await writeAdminLog(req.user._id, 'Plan template created', null, 'Success', { templateId: template._id });
  res.status(201).json({ success: true, message: 'Plan template created.', data: { template } });
}

async function updatePlanTemplate(req, res) {
  const payload = Object.fromEntries(Object.entries(req.body).filter(([key]) => ['name','goal','calories','protein','carbs','fat','hydrationLiters','meals','workout','notes','active'].includes(key)));
  payload.updatedBy = req.user._id;
  const template = await PlanTemplate.findByIdAndUpdate(req.params.id, payload, { returnDocument: 'after', runValidators: true });
  if (!template) return res.status(404).json({ success: false, message: 'Plan template not found.' });
  await writeAdminLog(req.user._id, 'Plan template updated', null, 'Success', { templateId: template._id });
  res.json({ success: true, data: { template } });
}

async function listPlans(req, res) {
  const search = req.query.search?.trim();
  const filter = {};
  if (search) {
    const regex = new RegExp(safeRegex(search), 'i');
    const users = await User.find({ $or: [{ name: regex }, { email: regex }] }).select('_id');
    filter.$or = [{ title: regex }, { goal: regex }, { user: { $in: users.map((u) => u._id) } }];
  }
  const plans = await Plan.find(filter).populate('user', 'name email').sort({ updatedAt: -1 }).limit(250);
  res.json({ success: true, count: plans.length, data: { plans } });
}

async function updatePlan(req, res) {
  const allowed = ['title', 'summary', 'calories', 'protein', 'carbs', 'fat', 'hydrationLiters', 'meals', 'workout', 'notes', 'status'];
  const payload = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  payload.status = payload.status || 'Admin Modified';
  payload.lastModifiedBy = req.user._id;
  const plan = await Plan.findByIdAndUpdate(req.params.id, payload, { returnDocument: 'after', runValidators: true }).populate('user', 'name email');
  if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });
  await writeAdminLog(req.user._id, 'Plan updated', plan.user?._id || plan.user, 'Success', { planId: plan._id });
  res.json({ success: true, message: 'Plan updated.', data: { plan } });
}

async function listAIOutputs(req, res) {
  const [plans, chats] = await Promise.all([
    Plan.find().populate('user', 'name email').sort({ updatedAt: -1 }).limit(150),
    ChatLog.find().populate('user', 'name email').sort({ updatedAt: -1 }).limit(100),
  ]);
  const outputs = [
    ...plans.map((plan) => ({ id: String(plan._id), type: plan.meals?.length ? 'Diet Plan' : 'Workout Plan', user: plan.user, model: plan.model || plan.generatedBy || 'OpenAI', createdAt: plan.createdAt, updatedAt: plan.updatedAt, status: plan.moderationStatus || 'Pending', tokens: Number(plan.aiUsage?.totalTokens || 0), output: plan })),
    ...chats.map((chat) => ({ id: String(chat._id), type: 'Chatbot', user: chat.user, model: chat.model || 'OpenAI', createdAt: chat.createdAt, updatedAt: chat.updatedAt, status: chat.aiModerationStatus || (chat.moderationStatus === 'Flagged' ? 'Flagged' : 'Pending'), tokens: chat.tokens, output: chat })),
  ];
  res.json({ success: true, count: outputs.length, data: { outputs } });
}

async function updateAIOutputStatus(req, res) {
  const { type, status } = req.body;
  if (!['Approved', 'Flagged', 'Pending'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid status.' });
  if (type === 'Chatbot') {
    const moderationStatus = status === 'Flagged' ? 'Flagged' : status === 'Approved' ? 'Normal' : 'Normal';
    const chat = await ChatLog.findByIdAndUpdate(
      req.params.id,
      { moderationStatus, aiModerationStatus: status },
      { returnDocument: 'after', runValidators: true }
    );
    if (!chat) return res.status(404).json({ success: false, message: 'Chat output not found.' });
    await writeAdminLog(req.user._id, 'AI chatbot output moderated', chat.user, 'Success', { status });
    return res.json({ success: true, data: { item: chat } });
  }
  const plan = await Plan.findByIdAndUpdate(
    req.params.id,
    {
      moderationStatus: status,
      moderationReason: String(req.body?.reason || ''),
      moderatedAt: new Date(),
      moderatedBy: req.user._id,
    },
    { returnDocument: 'after', runValidators: true }
  );
  if (!plan) return res.status(404).json({ success: false, message: 'AI plan output not found.' });
  await writeAdminLog(req.user._id, 'AI plan output moderated', plan.user, 'Success', { status });
  res.json({ success: true, data: { item: plan } });
}

async function listPromptTemplates(req, res) {
  const defaults = [
    { key: 'diet', title: 'Diet Plan Prompt', description: 'Personalized nutrition generation.', template: 'Generate a safe personalized diet plan using the user profile, goal and body analysis.' },
    { key: 'workout', title: 'Workout Prompt', description: 'Goal-aware workout generation.', template: 'Generate a safe workout plan using the user profile, goal and body analysis.' },
    { key: 'chatbot', title: 'Chatbot Prompt', description: 'Context-aware coaching.', template: 'Answer using the user plan and progress context. Avoid medical diagnosis.' },
  ];
  for (const item of defaults) await PromptTemplate.updateOne({ key: item.key }, { $setOnInsert: item }, { upsert: true });
  const templates = await PromptTemplate.find().sort({ key: 1 });
  res.json({ success: true, data: { templates } });
}

async function updatePromptTemplate(req, res) {
  const payload = {};
  if (req.body.title !== undefined) payload.title = req.body.title;
  if (req.body.description !== undefined) payload.description = req.body.description;
  if (req.body.template !== undefined) payload.template = req.body.template;
  if (req.body.active !== undefined) payload.active = Boolean(req.body.active);
  payload.updatedBy = req.user._id;
  const template = await PromptTemplate.findOneAndUpdate({ key: req.params.key }, payload, { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true, runValidators: true });
  await writeAdminLog(req.user._id, 'Prompt template updated', null, 'Success', { key: req.params.key });
  res.json({ success: true, data: { template } });
}


async function streamStoredAdminFile(fileId, req, res) {
  if (!isStoredFileId(fileId)) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_FILE_ID',
      message: 'Invalid stored file identifier.',
    });
  }

  const file = await getFile(fileId);
  if (!file) {
    return res.status(404).json({
      success: false,
      code: 'FILE_NOT_FOUND',
      message: 'Image file not found.',
    });
  }

  const contentType = String(file.contentType || file.metadata?.contentType || 'application/octet-stream');
  const length = Number(file.length);

  res.setHeader('Content-Type', contentType);
  if (Number.isFinite(length) && length >= 0) {
    res.setHeader('Content-Length', String(length));
  }
  res.setHeader('Cache-Control', 'private, max-age=300, must-revalidate');
  res.setHeader('Content-Disposition', `inline; filename="${String(file.filename || 'image').replace(/["\\\r\n]/g, '_')}"`);

  const stream = openDownloadStream(fileId);
  if (!stream) {
    return res.status(404).json({
      success: false,
      code: 'FILE_NOT_FOUND',
      message: 'Image file not found.',
    });
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };

    stream.once('error', (error) => {
      console.warn(`Admin image stream failed [${req.requestId || 'no-request-id'}]:`, error.message);
      if (!res.headersSent) {
        res.status(404).json({
          success: false,
          code: 'FILE_NOT_FOUND',
          message: 'Image file is no longer available.',
        });
      } else {
        res.destroy(error);
      }
      finish();
    });

    stream.once('end', finish);
    stream.pipe(res);
  });
}

async function getModerationFile(req, res) {
  const fileId = String(req.params.fileId || '').trim();

  // Do not expose arbitrary GridFS files to an admin endpoint. Confirm that
  // this file is referenced by at least one body-analysis moderation record.
  if (!isStoredFileId(fileId)) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_FILE_ID',
      message: 'Invalid stored file identifier.',
      requestId: req.requestId,
    });
  }

  const referenced = await BodyAnalysis.exists({
    $or: [
      { 'images.front': fileId },
      { 'images.back': fileId },
      { 'images.left': fileId },
      { 'images.right': fileId },
    ],
  });

  if (!referenced) {
    return res.status(404).json({
      success: false,
      code: 'FILE_NOT_REFERENCED',
      message: 'Image file is not associated with a body-analysis record.',
      requestId: req.requestId,
    });
  }

  return streamStoredAdminFile(fileId, req, res);
}

async function getImageFile(req, res) {
  const allowedPositions = new Set(['front', 'back', 'left', 'right']);
  const position = String(req.params.position || '').toLowerCase();
  if (!allowedPositions.has(position)) {
    return res.status(400).json({ success: false, message: 'Invalid image position.' });
  }

  const image = await BodyAnalysis.findById(req.params.id).select('userId images moderationStatus').lean();
  if (!image) return res.status(404).json({ success: false, message: 'Image analysis not found.' });

  const storedFileId = image.images?.[position];
  if (!storedFileId) {
    return res.status(404).json({ success: false, message: 'Requested image is not available.' });
  }

  if (isStoredFileId(storedFileId)) {
    return streamStoredAdminFile(storedFileId, req, res);
  }

  // Backward-compatible fallback for legacy local files. New uploads never
  // depend on the Railway filesystem.
  const resolved = path.resolve(storedFileId);
  if (!isAllowedLegacyPath(resolved)) {
    return res.status(404).json({ success: false, message: 'Image file is no longer available.' });
  }

  if (!(await legacyFileExists(resolved))) {
    // Preserve the moderation record but clear only the stale file pointer.
    await BodyAnalysis.updateOne(
      { _id: image._id, [`images.${position}`]: storedFileId },
      { $unset: { [`images.${position}`]: 1, [`imageMetadata.${position}`]: 1 } }
    ).catch((error) => {
      console.warn('Unable to clear stale legacy moderation image reference:', error.message);
    });
    return res.status(404).json({ success: false, message: 'Image file is no longer available. Please re-upload the body analysis.' });
  }

  return new Promise((resolve) => {
    res.sendFile(resolved, (error) => {
      if (!error) return resolve();
      if (!res.headersSent) {
        res.status(404).json({ success: false, message: 'Image file is no longer available.' });
      }
      resolve();
    });
  });
}

async function listImages(req, res) {
  const images = await BodyAnalysis.find().populate('userId', 'name email').sort({ createdAt: -1 }).limit(200);
  res.json({ success: true, count: images.length, data: { images } });
}

async function updateImageModeration(req, res) {
  const { status, reason } = req.body;
  if (!['Pending', 'Approved', 'Flagged', 'Deleted'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid moderation status.' });
  }

  const image = await BodyAnalysis.findByIdAndUpdate(
    req.params.id,
    { moderationStatus: status, moderationReason: reason || '', moderatedAt: new Date() },
    { returnDocument: 'after' }
  ).populate('userId', 'name email');

  if (!image) return res.status(404).json({ success: false, message: 'Image analysis not found.' });

  if (status === 'Deleted') {
    for (const value of Object.values(image.images || {})) {
      if (!value) continue;

      if (isStoredFileId(value)) {
        await deleteFile(value).catch((error) => {
          console.warn('GridFS body-image cleanup failed:', error.message);
        });
      } else {
        // Legacy local-file cleanup only; never accept arbitrary paths.
        const resolved = path.resolve(value);
        const uploadsRoot = path.resolve(path.join(__dirname, '..', 'uploads'));
        if (resolved.startsWith(`${uploadsRoot}${path.sep}`)) {
          await fs.unlink(resolved).catch(() => {});
        }
      }
    }
  }

  await writeAdminLog(
    req.user._id,
    `Body image ${status.toLowerCase()}`,
    image.userId?._id || image.userId,
    'Success',
    { analysisId: image._id, reason }
  );

  res.json({ success: true, message: `Image marked ${status}.`, data: { image } });
}

async function listChatModeration(req, res) {
  const chats = await ChatLog.find().populate('user', 'name email isActive role accountStatus').sort({ updatedAt: -1 }).limit(200);
  res.json({ success: true, count: chats.length, data: { chats } });
}

async function moderateChat(req, res) {
  const { status } = req.body;
  if (!['Normal', 'Flagged', 'Blocked'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid chat status.' });
  const chat = await ChatLog.findById(req.params.id).populate('user', 'name email role isActive accountStatus');
  if (!chat) return res.status(404).json({ success: false, message: 'Conversation not found.' });

  if (status === 'Blocked' && chat.user?.role === 'admin') {
    const activeAdmins = await User.countDocuments({
      role: 'admin',
      isActive: true,
      $or: [{ accountStatus: 'active' }, { accountStatus: { $exists: false } }],
    });
    if (activeAdmins <= 1) {
      return res.status(409).json({ success: false, message: 'The last active administrator cannot be banned.' });
    }
  }

  chat.moderationStatus = status;
  await chat.save();

  if (status === 'Blocked' && chat.user?._id) {
    await User.findByIdAndUpdate(chat.user._id, { isActive: false, accountStatus: 'banned' });
  }
  await writeAdminLog(req.user._id, `Chat ${status.toLowerCase()}`, chat.user?._id || chat.user, 'Success', { conversationId: chat._id });
  res.json({ success: true, message: `Chat marked ${status}.`, data: { chat } });
}

async function listLogs(req, res) {
  const logs = await AdminLog.find().populate('admin', 'name email').populate('targetUser', 'name email').sort({ createdAt: -1 }).limit(250);
  res.json({ success: true, count: logs.length, data: { logs } });
}

async function listAIUsage(req, res) {
  const logs = await AIUsageLog.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(250);
  res.json({ success: true, count: logs.length, data: { logs } });
}

async function listErrors(req, res) {
  const logs = await AdminLog.find({ status: 'Error' }).sort({ createdAt: -1 }).limit(250);
  res.json({ success: true, count: logs.length, data: { logs } });
}

module.exports = {
  listUsers, getUserAvatar, updateUser, dashboardSummary, listPlanTemplates, createPlanTemplate, updatePlanTemplate, assignPlanTemplate, listPlans, updatePlan,
  listAIOutputs, updateAIOutputStatus, listPromptTemplates, updatePromptTemplate,
  listImages, getImageFile, getModerationFile, updateImageModeration, listChatModeration, moderateChat,
  listLogs, listAIUsage, listErrors, writeAdminLog,
};
