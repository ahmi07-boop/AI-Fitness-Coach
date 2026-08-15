const OpenAI = require('openai');
const ChatLog = require('../models/ChatLog');
const { retrieveContext } = require('../services/ragService');
const AIUsageLog = require('../models/AIUsageLog');
const PromptTemplate = require('../models/PromptTemplate');
const MODERATION_MODEL = process.env.OPENAI_MODERATION_MODEL || 'omni-moderation-latest';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

function cleanMessage(value) {
  return String(value || '').trim().slice(0, 10000);
}

async function listConversations(req, res) {
  const filter = req.user.role === 'admin' && req.query.userId
    ? { user: req.query.userId }
    : { user: req.user._id };
  if (req.query.status) filter.moderationStatus = req.query.status;

  const conversations = await ChatLog.find(filter)
    .populate('user', 'name email')
    .sort({ updatedAt: -1 })
    .limit(50);
  res.json({ success: true, count: conversations.length, data: { conversations } });
}

async function getMyConversation(req, res) {
  const conversation = await ChatLog.findOne({ user: req.user._id, moderationStatus: { $ne: 'Blocked' } })
    .sort({ updatedAt: -1 });
  res.json({ success: true, data: { conversation: conversation || null } });
}

async function getConversation(req, res) {
  const conversation = await ChatLog.findById(req.params.id).populate('user', 'name email');
  if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found.' });
  if (req.user.role !== 'admin' && String(conversation.user._id || conversation.user) !== String(req.user._id)) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }
  res.json({ success: true, data: { conversation } });
}

async function createConversation(req, res) {
  const conversation = await ChatLog.create({ user: req.user._id, messages: [], model: CHAT_MODEL });
  res.status(201).json({ success: true, message: 'Conversation created.', data: { conversation } });
}

async function addMessage(req, res) {
  const role = ['user', 'assistant', 'system'].includes(req.body?.role) ? req.body.role : null;
  const content = cleanMessage(req.body?.content);
  if (!role || !content) return res.status(400).json({ success: false, message: 'role and content are required.' });

  const conversation = await ChatLog.findById(req.params.id);
  if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found.' });
  if (req.user.role !== 'admin' && String(conversation.user) !== String(req.user._id)) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }

  conversation.messages.push({ role, content });
  await conversation.save();
  res.json({ success: true, message: 'Message added.', data: { conversation } });
}

async function sendMessage(req, res) {
  const content = cleanMessage(req.body?.message);
  if (!content) return res.status(400).json({ success: false, message: 'message is required.' });

  let safetyFlagged = false;
  try {
    const moderation = await client.moderations.create({ model: MODERATION_MODEL, input: content });
    safetyFlagged = Boolean(moderation.results?.[0]?.flagged);
  } catch (moderationError) {
    console.warn('Chat moderation unavailable:', moderationError.message);
  }

  let conversation = null;
  if (req.body?.conversationId) {
    conversation = await ChatLog.findById(req.body.conversationId);
    if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found.' });
    if (String(conversation.user) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (conversation.moderationStatus === 'Blocked') {
      return res.status(403).json({ success: false, message: 'This conversation is blocked.' });
    }
  } else {
    conversation = await ChatLog.create({ user: req.user._id, messages: [], model: CHAT_MODEL });
  }

  if (safetyFlagged) {
    conversation.moderationStatus = 'Flagged';
    conversation.messages.push({ role: 'user', content });
    await conversation.save();
    await AIUsageLog.create({ user: req.user._id, operation: 'chat-moderation', model: MODERATION_MODEL, endpoint: '/api/chat/message', status: 'success', metadata: { flagged: true } });
    return res.status(400).json({ success: false, message: 'This message was flagged by the safety system. Please rephrase your request.' });
  }

  const contextDocs = await retrieveContext(req.user._id, content, req.user);
  const context = contextDocs.length
    ? contextDocs.map((doc) => `[${doc.sourceType}]\n${doc.content}`).join('\n\n---\n\n')
    : 'No personal plan or progress context is available yet.';

  const history = conversation.messages.slice(-12).map((message) => ({
    role: message.role === 'assistant' ? 'assistant' : message.role === 'user' ? 'user' : 'system',
    content: message.content,
  }));

  const promptTemplate = await PromptTemplate.findOne({ key: 'chatbot', active: true }).lean();
  const systemPrompt = `${promptTemplate?.template || 'You are FitCoach AI, a supportive fitness and wellness coach.'}\n\nUse the user's retrieved personal context below when it is relevant. Do not invent plan values, progress numbers, meals, workouts, or personal details. If the context does not contain an answer, say that clearly and give general wellness guidance. Keep recommendations practical and concise. Do not diagnose medical conditions or present medical advice as certainty. Encourage a qualified professional for medical concerns, injuries, eating disorders, or other high-risk situations.\n\nRETRIEVED PERSONAL CONTEXT:\n${context}`;

  const startedAt = Date.now();
  let response;
  try {
    response = await client.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.4,
    messages: [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content },
    ],
  });
    await AIUsageLog.create({
      user: req.user._id, operation: 'chat', model: response.model || CHAT_MODEL, endpoint: '/api/chat/message',
      promptTokens: Number(response.usage?.prompt_tokens || 0), completionTokens: Number(response.usage?.completion_tokens || 0),
      totalTokens: Number(response.usage?.total_tokens || 0), latencyMs: Date.now() - startedAt, status: 'success'
    });
  } catch (error) {
    await AIUsageLog.create({ user: req.user._id, operation: 'chat', model: CHAT_MODEL, endpoint: '/api/chat/message', latencyMs: Date.now() - startedAt, status: 'error', error: error.message });
    throw error;
  }

  const assistantContent = response.choices?.[0]?.message?.content?.trim();
  if (!assistantContent) throw new Error('The AI returned an empty response.');

  conversation.messages.push({ role: 'user', content });
  conversation.messages.push({ role: 'assistant', content: assistantContent });
  conversation.model = response.model || CHAT_MODEL;
  conversation.tokens = (conversation.tokens || 0) + Number(response.usage?.total_tokens || 0);
  await conversation.save();

  const io = req.app.locals.io;
  if (io) {
    const latestUserMessage = conversation.messages[conversation.messages.length - 2];
    const latestAssistantMessage = conversation.messages[conversation.messages.length - 1];
    // The chat page joins both the authenticated user room and the conversation room.
    // Emitting the same chat event to both rooms delivers it twice to the same socket.
    // Use the user room once; it already receives all chat updates for this user.
    io.to(`user:${String(req.user._id)}`).emit('chat:message', {
      conversationId: String(conversation._id),
      messages: [latestUserMessage, latestAssistantMessage],
      timestamp: new Date().toISOString(),
    });
  }

  res.json({
    success: true,
    message: 'AI response generated.',
    data: {
      conversation,
      reply: assistantContent,
      model: conversation.model,
      usage: response.usage || null,
      context: contextDocs.map(({ id, sourceType, score }) => ({ id, sourceType, score: Number(score.toFixed(4)) })),
    },
  });
}

async function updateModeration(req, res) {
  const { moderationStatus } = req.body;
  const allowed = ['Normal', 'Flagged', 'Blocked'];
  if (!allowed.includes(moderationStatus)) {
    return res.status(400).json({ success: false, message: 'Invalid moderation status.' });
  }

  const conversation = await ChatLog.findByIdAndUpdate(
    req.params.id,
    { moderationStatus },
    { new: true, runValidators: true }
  ).populate('user', 'name email');

  if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found.' });
  res.json({ success: true, message: `Conversation marked ${moderationStatus}.`, data: { conversation } });
}

module.exports = {
  listConversations,
  getMyConversation,
  getConversation,
  createConversation,
  addMessage,
  sendMessage,
  updateModeration,
};
