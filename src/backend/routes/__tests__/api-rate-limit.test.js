const express = require('express');
const { buildRateLimitConfig, createApiRateLimiter } = require('../../middleware/api-rate-limit');

jest.mock('../../database', () => ({
  getDb: jest.fn(),
  getDbClient: jest.fn(),
  connectToDatabase: jest.fn()
}));

jest.mock('../../config/server-config', () => ({
  getServerConstants: jest.fn().mockReturnValue({
    API_VERSION: 'test',
    STARTED_AT: new Date(),
    HEALTHY: true
  })
}));

function startServerWithRouter(router) {
  const app = express();
  app.use('/api/v1', router);

  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${port}`
      });
    });
  });
}

describe('API rate limiting', () => {
  let server;
  let baseUrl;
  let router;

  beforeAll(async () => {
    router = require('../index');

    const started = await startServerWithRouter(router);
    server = started.server;
    baseUrl = started.baseUrl;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('health remains available while API routes are rate limited', async () => {
    const healthResponse = await fetch(`${baseUrl}/api/v1/health`);
    const healthPayload = await healthResponse.json();

    expect(healthResponse.status).toBe(200);
    expect(healthPayload.status).toBe('healthy');

    let limitedResponse;

    for (let attempt = 0; attempt <= 100; attempt += 1) {
      limitedResponse = await fetch(`${baseUrl}/api/v1/api-key/list`);
    }

    const limitedPayload = await limitedResponse.json();

    expect(limitedResponse.status).toBe(429);
    expect(limitedPayload.errors).toEqual([
      'Too many requests. Please try again later.'
    ]);
    expect(limitedPayload['executed-at']).toEqual(expect.any(Number));
  });
});

describe('buildRateLimitConfig', () => {
  test('uses defaults when no overrides are provided', () => {
    const config = buildRateLimitConfig();
    expect(config.windowMs).toBe(60 * 1000);
    expect(config.limit).toBe(100);
    expect(config.standardHeaders).toBe(true);
    expect(config.legacyHeaders).toBe(false);
  });

  test('accepts valid positive integer overrides for windowMs and limit', () => {
    const config = buildRateLimitConfig({ windowMs: 30000, limit: 50 });
    expect(config.windowMs).toBe(30000);
    expect(config.limit).toBe(50);
  });

  test('falls back to defaults when windowMs is not a positive integer', () => {
    const config = buildRateLimitConfig({ windowMs: 'invalid', limit: -5 });
    expect(config.windowMs).toBe(60 * 1000);
    expect(config.limit).toBe(100);
  });

  test('falls back to defaults when windowMs is zero', () => {
    const config = buildRateLimitConfig({ windowMs: 0, limit: 0 });
    expect(config.windowMs).toBe(60 * 1000);
    expect(config.limit).toBe(100);
  });

  test('uses provided custom handler', () => {
    const customHandler = jest.fn();
    const config = buildRateLimitConfig({ handler: customHandler });
    expect(config.handler).toBe(customHandler);
  });

  test('default handler returns 429 with error message', () => {
    const config = buildRateLimitConfig();
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const req = {};
    const next = jest.fn();

    config.handler(req, res, next, { statusCode: 429 });

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      errors: ['Too many requests. Please try again later.'],
      'executed-at': expect.any(Number)
    }));
  });

  test('default handler falls back to 429 when options.statusCode is missing', () => {
    const config = buildRateLimitConfig();
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    config.handler({}, res, jest.fn(), {});

    expect(res.status).toHaveBeenCalledWith(429);
  });
});