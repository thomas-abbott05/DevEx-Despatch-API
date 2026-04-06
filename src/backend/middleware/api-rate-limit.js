const { rateLimit } = require('express-rate-limit');

const RATELIMIT_WINDOW_MS = 60 * 1000;
const RATELIMIT_MAX_REQUESTS = 100;

function parsePositiveInteger(value, fallback) {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
}

function buildRateLimitConfig(overrides = {}) {
  const windowMs = parsePositiveInteger(overrides.windowMs, RATELIMIT_WINDOW_MS);
  const limit = parsePositiveInteger(overrides.limit, RATELIMIT_MAX_REQUESTS);

  return {
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: overrides.handler || ((req, res, _next, options) => {
      return res.status(options.statusCode || 429).json({
        errors: ['Too many requests. Please try again later.'],
        'executed-at': Math.floor(Date.now() / 1000)
      });
    })
  };
}

function createApiRateLimiter(overrides = {}) {
  return rateLimit(buildRateLimitConfig(overrides));
}

const apiRateLimiter = createApiRateLimiter();

module.exports = {
  apiRateLimiter,
  createApiRateLimiter,
  buildRateLimitConfig,
};