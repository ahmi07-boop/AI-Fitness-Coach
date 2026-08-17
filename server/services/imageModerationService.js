const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODERATION_MODEL = process.env.OPENAI_MODERATION_MODEL || 'omni-moderation-latest';

async function moderateImage(input, mimeType = 'image/jpeg') {
  if (!process.env.OPENAI_API_KEY) {
    return { status: 'Pending', reason: 'Automatic moderation is unavailable; manual review required.' };
  }

  const buffer = Buffer.isBuffer(input) ? input : null;
  if (!buffer || buffer.length === 0) {
    return { status: 'Pending', reason: 'The uploaded image could not be read; manual review required.' };
  }

  const allowedMimes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!allowedMimes.has(mimeType)) {
    return { status: 'Pending', reason: 'The uploaded image format could not be verified for automatic moderation; manual review required.' };
  }

  const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;

  const response = await client.moderations.create({
    model: MODERATION_MODEL,
    input: [{ type: 'image_url', image_url: { url: dataUrl } }],
  });

  const result = response.results?.[0];
  if (!result) return { status: 'Pending', reason: 'No moderation result returned; manual review required.' };

  if (result.flagged) {
    const categories = Object.entries(result.categories || {})
      .filter(([, value]) => Boolean(value))
      .map(([key]) => key)
      .slice(0, 6);

    return {
      status: 'Flagged',
      reason: categories.length
        ? `Automatic safety review flagged: ${categories.join(', ')}`
        : 'Automatic safety review flagged this upload.',
    };
  }

  return { status: 'Approved', reason: 'Automatic safety review passed.' };
}

module.exports = { moderateImage };
