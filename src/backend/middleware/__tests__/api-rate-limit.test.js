jest.mock('express-rate-limit', () => ({
  rateLimit: jest.fn((config) => ({
    limiterConfig: config
  }))
}));

const { rateLimit } = require('express-rate-limit');
const {
  apiRateLimiter,
  createApiRateLimiter,
  buildRateLimitConfig,
} = require('../api-rate-limit');

describe('api-rate-limit middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('buildRateLimitConfig uses the expected defaults', () => {
    const config = buildRateLimitConfig();

    expect(config.windowMs).toBe(60 * 1000);
    expect(config.limit).toBe(100);
    expect(config.standardHeaders).toBe(true);
    expect(config.legacyHeaders).toBe(false);
    expect(typeof config.handler).toBe('function');
  });

  test('createApiRateLimiter passes custom options to express-rate-limit', () => {
    const customLimiter = createApiRateLimiter({
      windowMs: 5000,
      limit: 2
    });

    expect(rateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        windowMs: 5000,
        limit: 2,
        standardHeaders: true,
        legacyHeaders: false
      })
    );
    expect(customLimiter).toEqual({
      limiterConfig: expect.objectContaining({
        windowMs: 5000,
        limit: 2
      })
    });
  });

  test('exports a default limiter instance', () => {
    expect(apiRateLimiter).toEqual({
      limiterConfig: expect.objectContaining({
        windowMs: 60 * 1000,
        limit: 100
      })
    });
  });

  test('buildRateLimitConfig falls back to defaults when given invalid overrides', () => {
    const config = buildRateLimitConfig({ windowMs: 'invalid', limit: -10 });
    expect(config.windowMs).toBe(60 * 1000);
    expect(config.limit).toBe(100);
  });

  test('buildRateLimitConfig falls back to defaults when given zero values', () => {
    const config = buildRateLimitConfig({ windowMs: 0, limit: 0 });
    expect(config.windowMs).toBe(60 * 1000);
    expect(config.limit).toBe(100);
  });

  test('buildRateLimitConfig uses provided custom handler', () => {
    const customHandler = jest.fn();
    const config = buildRateLimitConfig({ handler: customHandler });
    expect(config.handler).toBe(customHandler);
  });

  test('default handler uses statusCode from options', () => {
    const config = buildRateLimitConfig();
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    config.handler({}, res, jest.fn(), { statusCode: 429 });

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      errors: ['Too many requests. Please try again later.'],
      'executed-at': expect.any(Number)
    }));
  });

  test('default handler falls back to 429 when statusCode is missing from options', () => {
    const config = buildRateLimitConfig();
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    config.handler({}, res, jest.fn(), {});

    expect(res.status).toHaveBeenCalledWith(429);
  });
});