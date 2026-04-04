const express = require('express');
const fs = require('fs');
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
  const distPath = path.join(__dirname, '../../../dist');
  const distIndexPath = path.join(distPath, 'index.html');
  const publicPath = path.join(__dirname, '../../../public');

    app.use(requestLogger);

    // parse JSON bodies
    app.use(express.json());

    // Serve built frontend first, then legacy static assets like our email images
    app.use(express.static(distPath));
    app.use(express.static(publicPath));

    // Swagger config
    const swaggerSpecJSON = require('./swagger-config.json');
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecJSON));

    // Serve the frontend root page from the Vite production build.
    app.get('/', (req, res) => {
      if (fs.existsSync(distIndexPath)) {
        return res.sendFile(distIndexPath);
      }

      return res.status(503).send('Frontend build not found. Run "npm run build" for production or "npm run dev" for development.');
    });

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