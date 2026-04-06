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
});