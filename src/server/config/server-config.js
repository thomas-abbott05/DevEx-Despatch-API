const express = require('express');
const path = require('path');
const swaggerUi = require('swagger-ui-express');

const API_VERSION = 'v1';
const BASE_URL = "https://devex.cloud.tcore.network";
const STARTED_AT = new Date();
let HEALTHY = true;

// log all requests
function requestLogger(req, res, next) {
  const { method, url, ip } = req;
  console.log(`[${new Date().toISOString()}] ${method} ${url} - ${ip}`);
  next();
}

function createExpressApp() {
    const app = express();

    app.use(requestLogger);

    // Serve static files from public directory e.g. images
    app.use(express.static(path.join(__dirname, '../../../public')));

    // Swagger config
    const swaggerSpecJSON = require('./swagger-config.json');
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecJSON));

    return app;
}

// internal server error handler
function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${err.stack}`);
  res.status(500).json({
    errors: [
      'An internal server error occurred. Please try again later.'
    ],
    "executed-at": Math.floor(Date.now() / 1000)
  });
}

// 404 handler
function notFoundHandler(req, res) {
  res.status(404).json({
    errors: [
      `Route ${req.method} ${req.path} not found - see API documentation at ${BASE_URL}/api-docs.`
    ],
    "executed-at": Math.floor(Date.now() / 1000)
  });
}

// this function MUST be called after all routes are defined, otherwise it will catch valid routes as 404s
function setupErrorHandling(app) {
  app.use(notFoundHandler);
  app.use(errorHandler);
}

function getServerConstants() {
  return {
    API_VERSION,
    STARTED_AT,
    HEALTHY
  };
}

module.exports = {
  createExpressApp,
  setupErrorHandling,
  getServerConstants,
};