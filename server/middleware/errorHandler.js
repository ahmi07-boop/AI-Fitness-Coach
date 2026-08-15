const AdminLog = require('../models/AdminLog');

async function errorHandler(err, req, res, next) {
  console.error(`[${req.requestId || 'no-request-id'}]`, err);
  try {
    await AdminLog.create({
      admin: req.user?._id || null,
      event: err.message || 'Internal server error',
      targetUser: req.user?._id || null,
      status: 'Error',
      metadata: { method: req.method, endpoint: req.originalUrl, statusCode: err.statusCode || 500 },
    });
  } catch (logError) {
    console.error('Failed to record error log:', logError.message);
  }

  const statusCode = Number(err.statusCode) || (err.name === 'MulterError' ? 400 : 500);
  const expose = statusCode < 500 || process.env.NODE_ENV !== 'production';

  if (err.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: 'Validation failed', errors: Object.values(err.errors).map((item) => item.message), requestId: req.requestId });
  }
  if (err.code === 11000) {
    return res.status(409).json({ success: false, message: 'A record with this value already exists.', requestId: req.requestId });
  }
  return res.status(statusCode).json({ success: false, message: expose ? (err.message || 'Request failed') : 'Internal server error', requestId: req.requestId });
}

module.exports = errorHandler;
