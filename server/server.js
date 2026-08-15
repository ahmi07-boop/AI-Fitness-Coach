const dotenv = require('dotenv');

// Load environment variables before importing any module that reads process.env.
dotenv.config();

const express = require('express');
const cors = require('cors');
const {
  requestContext,
  securityHeaders,
  createRateLimiter,
} = require('./middleware/security');
const jwt = require('jsonwebtoken');

// db.js exports both connectDB and disconnectDB.
const { connectDB } = require('./config/db');
const User = require('./models/User');

const authRoutes = require('./routes/authRoutes');
const planRoutes = require('./routes/planRoutes');
const progressRoutes = require('./routes/progressRoutes');
const chatRoutes = require('./routes/chatRoutes');
const adminRoutes = require('./routes/adminRoutes');
const ragRoutes = require('./routes/ragRoutes');
const analysisRoutes = require('./routes/analysisRoutes');
const billingRoutes = require('./routes/billingRoutes');
const { webhook: stripeWebhook } = require('./controllers/billingController');
const errorHandler = require('./middleware/errorHandler');

const http = require('http');
const { Server } = require('socket.io');

const app = express();

const PORT = Number(process.env.PORT) || 5000;

/*
 * CLIENT_ORIGIN can contain one or more comma-separated origins.
 *
 * Development:
 * CLIENT_ORIGIN=http://localhost:5173
 *
 * Production:
 * CLIENT_ORIGIN=https://your-frontend-domain.com
 *
 * Multiple production origins:
 * CLIENT_ORIGIN=https://app.example.com,https://admin.example.com
 */
const CLIENT_ORIGINS = String(
  process.env.CLIENT_ORIGIN || 'http://localhost:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

/*
 * Required security configuration.
 */
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error(
    'JWT_SECRET must be configured and at least 32 characters long.'
  );
}

/*
 * In production, localhost origins are almost always a configuration mistake.
 */
if (
  process.env.NODE_ENV === 'production' &&
  CLIENT_ORIGINS.some((origin) => /localhost|127\.0\.0\.1/.test(origin))
) {
  console.warn(
    'Production server includes a localhost CLIENT_ORIGIN; verify deployment configuration.'
  );
}

/*
 * Only trust forwarded proxy headers when the application is actually
 * behind a trusted reverse proxy/load balancer.
 *
 * Development:
 * TRUST_PROXY=false
 *
 * Production behind trusted proxy:
 * TRUST_PROXY=true
 */
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);

app.disable('x-powered-by');

/*
 * Security middleware.
 */
app.use(requestContext);
app.use(securityHeaders);

/*
 * HTTP API CORS.
 */
app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no Origin header (e.g. server-to-server/health checks).
      if (!origin) {
        return callback(null, true);
      }

      if (CLIENT_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('CORS origin is not allowed.'));
    },
    credentials: true,
  })
);

/*
 * Global rate limiting.
 */
app.use(
  createRateLimiter({
    windowMs: 60_000,
    max: Number(process.env.GLOBAL_RATE_LIMIT || 240),
  })
);

/*
 * Stripe requires the untouched raw request body for webhook
 * signature verification.
 *
 * This route MUST remain before express.json().
 */
app.post(
  '/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhook
);

/*
 * Normal request body parsers.
 */
app.use(express.json({ limit: '2mb', strict: true }));
app.use(express.urlencoded({ extended: true }));

/*
 * Health check.
 */
app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  const dbState = mongoose.connection.readyState;

  res.status(dbState === 1 ? 200 : 503).json({
    success: dbState === 1,
    service: 'AI Fitness Coach API',
    status: dbState === 1 ? 'ok' : 'degraded',
    database: dbState === 1 ? 'connected' : 'disconnected',
    realtime: true,
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
  });
});

/*
 * API routes.
 */
app.use('/api/auth', authRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/billing', billingRoutes);

/*
 * 404 handler.
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

/*
 * Centralized error handler.
 */
app.use(errorHandler);

/*
 * Start server.
 */
async function startServer() {
  try {
    await connectDB();

    const server = http.createServer(app);

    /*
     * Socket.IO CORS.
     *
     * IMPORTANT:
     * Use CLIENT_ORIGINS here, not CLIENT_ORIGIN.
     *
     * CLIENT_ORIGINS is the parsed/validated array created above.
     */
    const io = new Server(server, {
      cors: {
        origin: CLIENT_ORIGINS,
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    /*
     * Make Socket.IO available to REST controllers so a successful
     * API operation can immediately broadcast the same state to
     * connected clients.
     */
    app.locals.io = io;

    /*
     * Socket authentication.
     */
    io.use(async (socket, next) => {
      try {
        const cookieHeader = socket.handshake.headers.cookie || '';
        const cookie = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith('fitcoach_session='));
        const token = socket.handshake.auth?.token || (cookie ? decodeURIComponent(cookie.slice('fitcoach_session='.length)) : null);

        if (!token) {
          return next(new Error('Authentication required.'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id);

        if (!user || !user.isActive) {
          return next(new Error('Invalid user.'));
        }

        socket.user = user;

        next();
      } catch {
        next(new Error('Invalid socket authentication.'));
      }
    });

    /*
     * Socket connections.
     */
    io.on('connection', (socket) => {
      const userRoom = `user:${String(socket.user._id)}`;

      socket.join(userRoom);

      socket.emit('realtime:connected', {
        userId: String(socket.user._id),
        timestamp: new Date().toISOString(),
      });

      socket.on('join-chat', (conversationId) => {
        if (conversationId) {
          socket.join(`chat:${String(conversationId)}`);
        }
      });

      socket.on('leave-chat', (conversationId) => {
        if (conversationId) {
          socket.leave(`chat:${String(conversationId)}`);
        }
      });

      socket.on('disconnect', () => {
        // Socket.IO automatically removes the socket from all rooms.
      });
    });

    /*
     * Graceful shutdown.
     */
    const shutdown = async (signal) => {
      console.log(`Received ${signal}; shutting down gracefully.`);

      server.close(async () => {
        try {
          const { disconnectDB } = require('./config/db');

          await disconnectDB();
        } finally {
          process.exit(0);
        }
      });

      /*
       * Prevent the process from hanging indefinitely.
       */
      setTimeout(() => process.exit(1), 10_000).unref();
    };

    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));

    /*
     * Start HTTP server.
     */
    server.listen(PORT, () => {
      console.log(`AI Fitness Coach API running on port ${PORT}`);
      console.log(
        `Allowed client origins: ${CLIENT_ORIGINS.join(', ')}`
      );
      console.log('Socket.IO realtime updates enabled.');
    });
  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;