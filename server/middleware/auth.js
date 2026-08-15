const jwt = require('jsonwebtoken');
const User = require('../models/User');

const AUTH_COOKIE = 'fitcoach_session';

function getCookieValue(header, name) {
  if (!header) return null;
  const entry = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}

async function verifyJWT(req, res, next) {
  try {
    const auth = req.headers.authorization;
    const bearerToken = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null;
    const cookieToken = getCookieValue(req.headers.cookie, AUTH_COOKIE);
    const token = (bearerToken || cookieToken || '').trim();

    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized', requestId: req.requestId });
    }
    if (!token || token.length > 4096) {
      return res.status(401).json({ success: false, message: 'Invalid token', requestId: req.requestId });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });

    if (!decoded?.id) {
      return res.status(401).json({ success: false, message: 'Invalid token', requestId: req.requestId });
    }

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid user', requestId: req.requestId });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid token', requestId: req.requestId });
  }
}

function checkRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ success: false, message: 'Access denied', requestId: req.requestId });
    }
    return next();
  };
}

module.exports = { verifyJWT, checkRole };
