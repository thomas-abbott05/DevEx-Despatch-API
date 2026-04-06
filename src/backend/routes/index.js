// This is the entry point that loads all of our API routes.
const express = require('express');
const { getServerConstants } = require('../config/server-config');
const apiKeyManagementRoutes = require('./api-key/api-key-management-routes');
const authRoutes = require('./auth/auth-routes');
const despatchRoutes = require('./despatch/despatch-advice-routes');
const despatchCancellationRoutes = require('./despatch/despatch-cancellation-routes');
const validateDocRoutes = require('./validation/validate-doc-routes');

const router = express.Router();

// no API key required
router.get('/health', (req, res) => {
  const { API_VERSION, STARTED_AT, HEALTHY } = getServerConstants();
  res.send({
    status: HEALTHY ? 'healthy' : 'error',
    uptime: Math.floor((Date.now() - STARTED_AT.getTime()) / 1000),
    version: API_VERSION,
    'executed-at': Math.floor(Date.now() / 1000)
  });
});

router.use(require('../middleware/api-rate-limit').apiRateLimiter);

// Internal API key management routes, protected with master key in .env file.
router.use('/api-key', apiKeyManagementRoutes);

// User authentication routes (login/registration/session).
router.use('/auth', authRoutes);

// External despatch routes - protected with normal issued API keys.
router.use('/despatch', despatchRoutes);

// Despatch cancellation routes - protected with normal issued API keys.
router.use('/despatch/cancel', despatchCancellationRoutes);

// Utility document validation route - protected with normal issued API keys.
router.use('/validate-doc', validateDocRoutes);

module.exports = router;
