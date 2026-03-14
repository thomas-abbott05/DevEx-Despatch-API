// This is the entry point that loads all of our API routes.
const express = require('express');
const { getServerConstants } = require('../config/server-config');
const apiKeyManagementRoutes = require('./api-key-management-routes');
const despatchRoutes = require('./despatch-advice-routes');
const despatchCancellationRoutes = require('./despatch-cancellation-routes');

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

// Internal API key management routes, protected with master key in .env file.
router.use('/api-key', apiKeyManagementRoutes);

// External despatch routes - protected with normal issued API keys.
router.use('/despatch', despatchRoutes);

// Despatch cancellation routes - protected with normal issued API keys.
router.use('/despatch/cancel', despatchCancellationRoutes);

module.exports = router;
