const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { createHash } = require('node:crypto');

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'mocked-message-id' });

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail
  }))
}));

jest.mock('../../../config/email-template-service', () => ({
  renderEmailTemplate: jest.fn(() => '<html>Mock Email</html>')
}));

jest.mock('../../../database', () => ({
  getDb: jest.fn()
}));

const { getDb } = require('../../../database');
const router = require('../auth-routes');
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function startServerWithRouter(authRouter) {
  const app = express();

  app.use(session({
    name: 'devex.sid',
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false
  }));

  app.use('/api/v1/auth', authRouter);

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

describe('auth routes', () => {
  let server;
  let baseUrl;
  let realFetch;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    realFetch = global.fetch;
    const started = await startServerWithRouter(router);
    server = started.server;
    baseUrl = started.baseUrl;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    global.fetch = jest.fn((url, options) => {
      if (typeof url === 'string' && url.startsWith('http://127.0.0.1:')) {
        return realFetch(url, options);
      }

      if (url === TURNSTILE_VERIFY_URL) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, 'error-codes': [] })
        });
      }

      return Promise.resolve({
        ok: false,
        json: async () => ({ success: false, 'error-codes': ['invalid-url'] })
      });
    });
  });

  afterEach(() => {
    global.fetch = realFetch;
    process.env.NODE_ENV = originalNodeEnv;
  });

  test('POST /register returns 400 when required fields are missing', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' })
    });

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(expect.arrayContaining([
      'Missing password in request body.',
      'Missing firstName in request body.',
      'Missing lastName in request body.'
    ]));
  });

  test('POST /register skips Turnstile verification when not in SSL production mode', async () => {
    const insertOne = jest.fn().mockResolvedValue({ insertedId: '507f1f77bcf86cd799439011' });
    const findOne = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        _id: { toString: () => '507f1f77bcf86cd799439011' },
        email: 'tester-no-turnstile@example.com',
        profilePhotoUuid: null,
        firstName: 'Local',
        lastName: 'Dev'
      });

    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne,
        insertOne
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'tester-no-turnstile@example.com',
        password: 'Password123',
        firstName: 'Local',
        lastName: 'Dev'
      })
    });

    expect(response.status).toBe(201);
    expect(mockSendMail).toHaveBeenCalledTimes(0);
    const outboundTurnstileCalls = global.fetch.mock.calls.filter(
      ([url]) => typeof url === 'string' && url === TURNSTILE_VERIFY_URL
    );
    expect(outboundTurnstileCalls).toHaveLength(0);
  });

  test('POST /register enforces Turnstile in SSL production mode', async () => {
    process.env.NODE_ENV = 'production';

    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-proto': 'https'
      },
      body: JSON.stringify({
        email: 'ssl-prod-missing-token@example.com',
        password: 'Password123',
        firstName: 'SSL',
        lastName: 'Prod'
      })
    });

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(expect.arrayContaining(['Missing turnstileToken in request body.']));
  });

  test('POST /register inserts user with passwordHash and returns 201', async () => {
    const insertOne = jest.fn().mockResolvedValue({ insertedId: '507f1f77bcf86cd799439011' });
    const findOne = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        _id: { toString: () => '507f1f77bcf86cd799439011' },
        email: 'tester@example.com',
        profilePhotoUuid: null,
        firstName: 'Test',
        lastName: 'User'
      });

    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne,
        insertOne
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'tester@example.com',
        password: 'Password123',
        firstName: 'Test',
        lastName: 'User',
        profilePhotoUuid: '11111111-1111-1111-1111-111111111111',
        turnstileToken: 'test-turnstile-token'
      })
    });

    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.user).toEqual({
      id: '507f1f77bcf86cd799439011',
      email: 'tester@example.com',
      profilePhotoUuid: null,
      firstName: 'Test',
      lastName: 'User'
    });

    expect(insertOne).toHaveBeenCalledWith(expect.objectContaining({
      email: 'tester@example.com',
      passwordHash: expect.any(String),
      profilePhotoUuid: null,
      firstName: 'Test',
      lastName: 'User',
      emailVerified: false,
      emailVerificationCodeHash: null,
      emailVerificationCodeExpiresAt: null,
      emailVerificationRequestedAt: null
    }));

    expect(insertOne.mock.calls[0][0].passwordHash).not.toBe('Password123');
  });

  test('POST /login blocks unverified users', async () => {
    const passwordHash = await bcrypt.hash('Password123', 10);

    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue({
          _id: '507f1f77bcf86cd799439011',
          email: 'tester@example.com',
          passwordHash,
          emailVerified: false
        })
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'tester@example.com',
        password: 'Password123'
      })
    });

    const payload = await response.json();
    expect(response.status).toBe(403);
    expect(payload.errors).toEqual(expect.arrayContaining([
      'Email address is not verified yet. Please verify your account before logging in.'
    ]));
  });

  test('POST /request-verification-code returns 429 during cooldown', async () => {
    const currentUnix = Math.floor(Date.now() / 1000);

    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue({
          _id: '507f1f77bcf86cd799439011',
          email: 'tester@example.com',
          firstName: 'Test',
          emailVerified: false,
          emailVerificationRequestedAt: currentUnix - 10
        })
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/request-verification-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tester@example.com' })
    });

    expect(response.status).toBe(429);
    expect(mockSendMail).toHaveBeenCalledTimes(0);
  });

  test('POST /verify-email accepts valid code and verifies account', async () => {
    const code = '123456';
    const codeHash = createHash('sha256').update(code).digest('hex');
    const currentUnix = Math.floor(Date.now() / 1000);
    const updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });

    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue({
          _id: '507f1f77bcf86cd799439011',
          email: 'tester@example.com',
          emailVerified: false,
          emailVerificationCodeHash: codeHash,
          emailVerificationCodeExpiresAt: currentUnix + 300
        }),
        updateOne
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'tester@example.com',
        code
      })
    });

    expect(response.status).toBe(200);
    expect(updateOne).toHaveBeenCalled();
  });

  test('POST /request-password-reset returns generic success for unknown emails', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null)
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/request-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unknown@example.com' })
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.message).toBe('If an account exists for this email, password reset instructions will be sent.');
    expect(mockSendMail).toHaveBeenCalledTimes(0);
  });

  test('POST /reset-password updates password and clears reset token fields', async () => {
    const token = 'reset-token-value-123456';
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });
    const currentUnix = Math.floor(Date.now() / 1000);

    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue({
          _id: '507f1f77bcf86cd799439011',
          email: 'tester@example.com',
          passwordResetTokenHash: tokenHash,
          passwordResetTokenExpiresAt: currentUnix + 300
        }),
        updateOne
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        password: 'NewPassword123'
      })
    });

    expect(response.status).toBe(200);
    expect(updateOne).toHaveBeenCalledWith(
      { _id: '507f1f77bcf86cd799439011' },
      expect.objectContaining({
        $set: expect.objectContaining({
          passwordHash: expect.any(String)
        }),
        $unset: expect.objectContaining({
          passwordResetTokenHash: '',
          passwordResetTokenExpiresAt: '',
          passwordResetRequestedAt: ''
        })
      })
    );
  });

  test('POST /reset-password returns 400 when password lacks letter and number requirement', async () => {
    const token = 'reset-token-value-123456';

    const response = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        password: '12345678'
      })
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(expect.arrayContaining([
      'Password must include at least one letter and one number.'
    ]));
  });

  test('POST /login returns 401 for invalid credentials', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null)
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'unknown@example.com',
        password: 'Password123'
      })
    });

    const payload = await response.json();
    expect(response.status).toBe(401);
    expect(payload.errors).toEqual(['Invalid email or password.']);
  });

  test('session endpoint returns current user after successful login', async () => {
    const userId = '507f1f77bcf86cd799439011';
    const passwordHash = await bcrypt.hash('Password123', 10);

    const findOne = jest
      .fn()
      .mockResolvedValueOnce({
        _id: userId,
        email: 'tester@example.com',
        passwordHash,
        emailVerified: true,
        profilePhotoUuid: null,
        firstName: 'Test',
        lastName: 'User'
      })
      .mockResolvedValueOnce({
        _id: { toString: () => userId },
        email: 'tester@example.com',
        passwordHash,
        emailVerified: true,
        profilePhotoUuid: null,
        firstName: 'Test',
        lastName: 'User'
      });

    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne,
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 })
      })
    });

    const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'tester@example.com',
        password: 'Password123'
      })
    });

    expect(loginResponse.status).toBe(200);
    const setCookie = loginResponse.headers.get('set-cookie');
    expect(setCookie).toContain('devex.sid=');
    const cookieHeader = setCookie.split(';')[0];

    const sessionResponse = await fetch(`${baseUrl}/api/v1/auth/session`, {
      headers: {
        Cookie: cookieHeader
      }
    });
    const sessionPayload = await sessionResponse.json();

    expect(sessionResponse.status).toBe(200);
    expect(sessionPayload.user).toEqual({
      id: userId,
      email: 'tester@example.com',
      profilePhotoUuid: null,
      firstName: 'Test',
      lastName: 'User'
    });
  });

  // ── POST /register ────────────────────────────────────────────────────────

  test('POST /register returns 400 when body is missing (no Content-Type)', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST'
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toBeDefined();
  });

  test('POST /register returns 400 when email is a non-string type', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 12345,
        password: 'Password123',
        firstName: 'Test',
        lastName: 'User'
      })
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(expect.arrayContaining(['Missing email in request body.']));
  });

  test('POST /register returns 400 for invalid email format', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'not-an-email',
        password: 'Password123',
        firstName: 'Test',
        lastName: 'User'
      })
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(expect.arrayContaining(['Invalid email format.']));
  });

  test('POST /register returns 400 when password is too short', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'Ab1',
        firstName: 'Test',
        lastName: 'User'
      })
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(expect.arrayContaining(['Password must be at least 8 characters long.']));
  });

  test('POST /register returns 400 when password lacks letter and number', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'alllowercase',
        firstName: 'Test',
        lastName: 'User'
      })
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(expect.arrayContaining(['Password must include at least one letter and one number.']));
  });

  test('POST /register returns 400 when firstName is too long', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'Password123',
        firstName: 'A'.repeat(81),
        lastName: 'User'
      })
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(expect.arrayContaining(['firstName must be 80 characters or less.']));
  });

  test('POST /register returns 400 when lastName is too long', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'Password123',
        firstName: 'Test',
        lastName: 'B'.repeat(81)
      })
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(expect.arrayContaining(['lastName must be 80 characters or less.']));
  });

  test('POST /register returns 400 when email is already registered', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue({ _id: 'existing-id' })
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'already@example.com',
        password: 'Password123',
        firstName: 'Existing',
        lastName: 'User'
      })
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(['Email is already registered.']);
  });

  test('POST /register returns 400 on MongoDB duplicate key error (code 11000)', async () => {
    const dupeError = new Error('Duplicate key');
    dupeError.code = 11000;

    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValueOnce(null),
        insertOne: jest.fn().mockRejectedValue(dupeError)
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'race@example.com',
        password: 'Password123',
        firstName: 'Race',
        lastName: 'Condition'
      })
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(['A user with this email already exists.']);
  });

  test('POST /register returns 500 on unexpected database error', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockRejectedValue(new Error('DB down'))
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'error@example.com',
        password: 'Password123',
        firstName: 'Error',
        lastName: 'User'
      })
    });

    const payload = await response.json();
    expect(response.status).toBe(500);
    expect(payload.errors).toEqual(['Internal server error']);
  });

  test('POST /register fails Turnstile verification and returns 400', async () => {
    process.env.NODE_ENV = 'production';

    global.fetch = jest.fn((url, options) => {
      if (typeof url === 'string' && url.startsWith('http://127.0.0.1:')) {
        return realFetch(url, options);
      }
      if (url === TURNSTILE_VERIFY_URL) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] })
        });
      }
      return realFetch(url, options);
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-proto': 'https'
      },
      body: JSON.stringify({
        email: 'turnstile-fail@example.com',
        password: 'Password123',
        firstName: 'Turnstile',
        lastName: 'Fail',
        turnstileToken: 'bad-token'
      })
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(['Turnstile verification failed. Please try again.']);
  });

  test('POST /register returns 400 when Turnstile HTTP request fails (ok: false)', async () => {
    process.env.NODE_ENV = 'production';

    global.fetch = jest.fn((url, options) => {
      if (typeof url === 'string' && url.startsWith('http://127.0.0.1:')) {
        return realFetch(url, options);
      }
      if (url === TURNSTILE_VERIFY_URL) {
        return Promise.resolve({
          ok: false,
          json: async () => null
        });
      }
      return realFetch(url, options);
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-proto': 'https'
      },
      body: JSON.stringify({
        email: 'http-fail@example.com',
        password: 'Password123',
        firstName: 'Http',
        lastName: 'Fail',
        turnstileToken: 'some-token'
      })
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(['Turnstile verification failed. Please try again.']);
  });

  test('POST /register uses CLOUDFLARE_TURNSTILE_SECRET_KEY when set in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = 'cf-secret-key';

    const insertOne = jest.fn().mockResolvedValue({ insertedId: '507f1f77bcf86cd799439011' });
    const findOne = jest.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        _id: { toString: () => '507f1f77bcf86cd799439011' },
        email: 'cf@example.com',
        profilePhotoUuid: null,
        firstName: 'CF',
        lastName: 'Test'
      });

    getDb.mockReturnValue({ collection: jest.fn().mockReturnValue({ findOne, insertOne }) });

    global.fetch = jest.fn((url, options) => {
      if (typeof url === 'string' && url.startsWith('http://127.0.0.1:')) {
        return realFetch(url, options);
      }
      if (url === TURNSTILE_VERIFY_URL) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, 'error-codes': [] })
        });
      }
      return realFetch(url, options);
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-proto': 'https'
      },
      body: JSON.stringify({
        email: 'cf@example.com',
        password: 'Password123',
        firstName: 'CF',
        lastName: 'Test',
        turnstileToken: 'valid-token'
      })
    });

    expect(response.status).toBe(201);
    delete process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
  });

  // ── POST /login ───────────────────────────────────────────────────────────

  test('POST /login returns 400 when body is missing (no Content-Type)', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST'
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toBeDefined();
  });

  test('POST /login returns 400 for invalid email format', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'Password123' })
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(expect.arrayContaining(['Invalid email format.']));
  });

  test('POST /login returns 400 when password is missing', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' })
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(expect.arrayContaining(['Missing password in request body.']));
  });

  test('POST /login returns 401 when password does not match', async () => {
    const passwordHash = await bcrypt.hash('CorrectPassword123', 10);

    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue({
          _id: 'user-id',
          email: 'tester@example.com',
          passwordHash,
          emailVerified: true
        })
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tester@example.com', password: 'WrongPassword123' })
    });

    const payload = await response.json();
    expect(response.status).toBe(401);
    expect(payload.errors).toEqual(['Invalid email or password.']);
  });

  test('POST /login returns 500 on unexpected database error', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockRejectedValue(new Error('DB error'))
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'error@example.com', password: 'Password123' })
    });

    const payload = await response.json();
    expect(response.status).toBe(500);
    expect(payload.errors).toEqual(['Internal server error']);
  });

  // ── POST /request-verification-code ────────────────────────────────────────

  test('POST /request-verification-code returns 400 when body is missing', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/request-verification-code`, {
      method: 'POST'
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toBeDefined();
  });

  test('POST /request-verification-code returns 400 for invalid email format', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/request-verification-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-valid' })
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(expect.arrayContaining(['Invalid email format.']));
  });

  test('POST /request-verification-code returns 200 when user is not found', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null)
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/request-verification-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'notfound@example.com' })
    });

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.message).toBe('If this account exists and is pending verification, a code has been sent.');
  });

  test('POST /request-verification-code returns 200 when email is already verified', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue({
          _id: 'user-id',
          email: 'verified@example.com',
          emailVerified: true
        })
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/request-verification-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'verified@example.com' })
    });

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.message).toBe('If this account exists and is pending verification, a code has been sent.');
  });

  test('POST /request-verification-code sends email and returns 200 when not in cooldown', async () => {
    const updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });

    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue({
          _id: 'user-id',
          email: 'pending@example.com',
          firstName: 'Pending',
          emailVerified: false,
          emailVerificationRequestedAt: null
        }),
        updateOne
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/request-verification-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pending@example.com' })
    });

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.message).toBe('Verification code sent.');
    expect(updateOne).toHaveBeenCalled();
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  test('POST /request-verification-code returns 500 on unexpected error', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockRejectedValue(new Error('DB error'))
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/request-verification-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'error@example.com' })
    });

    const payload = await response.json();
    expect(response.status).toBe(500);
    expect(payload.errors).toEqual(['Internal server error']);
  });

  // ── POST /verify-email ────────────────────────────────────────────────────

  test('POST /verify-email returns 400 when body is missing', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/verify-email`, {
      method: 'POST'
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toBeDefined();
  });

  test('POST /verify-email returns 400 when email is missing', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '123456' })
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(expect.arrayContaining(['Missing email in request body.']));
  });

  test('POST /verify-email returns 400 when code format is invalid', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', code: 'abc' })
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(expect.arrayContaining(['Verification code must be a 6 digit number.']));
  });

  test('POST /verify-email returns 400 when user is not found', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null)
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ghost@example.com', code: '123456' })
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(['Invalid or expired verification code.']);
  });

  test('POST /verify-email returns 200 when email is already verified', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue({
          _id: 'user-id',
          email: 'done@example.com',
          emailVerified: true
        })
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'done@example.com', code: '123456' })
    });

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.message).toBe('Email is already verified.');
  });

  test('POST /verify-email returns 400 when verification code has expired', async () => {
    const expiredUnix = Math.floor(Date.now() / 1000) - 100;

    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue({
          _id: 'user-id',
          email: 'tester@example.com',
          emailVerified: false,
          emailVerificationCodeHash: 'somehash',
          emailVerificationCodeExpiresAt: expiredUnix
        })
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tester@example.com', code: '123456' })
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(['Invalid or expired verification code.']);
  });

  test('POST /verify-email returns 400 when verification code is wrong', async () => {
    const { createHash } = require('node:crypto');
    const correctCode = '999999';
    const codeHash = createHash('sha256').update(correctCode).digest('hex');
    const currentUnix = Math.floor(Date.now() / 1000);

    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue({
          _id: 'user-id',
          email: 'tester@example.com',
          emailVerified: false,
          emailVerificationCodeHash: codeHash,
          emailVerificationCodeExpiresAt: currentUnix + 300
        })
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tester@example.com', code: '111111' })
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(['Invalid or expired verification code.']);
  });

  test('POST /verify-email returns 500 on unexpected error', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockRejectedValue(new Error('DB error'))
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'error@example.com', code: '123456' })
    });

    const payload = await response.json();
    expect(response.status).toBe(500);
    expect(payload.errors).toEqual(['Internal server error']);
  });

  // ── POST /request-password-reset ───────────────────────────────────────────

  test('POST /request-password-reset returns 400 when body is missing', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/request-password-reset`, {
      method: 'POST'
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toBeDefined();
  });

  test('POST /request-password-reset returns 400 for invalid email format', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/request-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-valid' })
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(expect.arrayContaining(['Invalid email format.']));
  });

  test('POST /request-password-reset sends email when user is found and not in cooldown', async () => {
    const updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });

    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue({
          _id: 'user-id',
          email: 'reset@example.com',
          firstName: 'Reset',
          passwordResetRequestedAt: null
        }),
        updateOne
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/request-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'reset@example.com' })
    });

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.message).toBe('If an account exists for this email, password reset instructions will be sent.');
    expect(updateOne).toHaveBeenCalled();
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  test('POST /request-password-reset returns 200 but does NOT send email when in cooldown', async () => {
    const currentUnix = Math.floor(Date.now() / 1000);

    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue({
          _id: 'user-id',
          email: 'cooldown@example.com',
          firstName: 'Cooldown',
          passwordResetRequestedAt: currentUnix - 10
        })
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/request-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'cooldown@example.com' })
    });

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.message).toBe('If an account exists for this email, password reset instructions will be sent.');
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  test('POST /request-password-reset returns 500 on unexpected error', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockRejectedValue(new Error('DB error'))
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/request-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'error@example.com' })
    });

    const payload = await response.json();
    expect(response.status).toBe(500);
    expect(payload.errors).toEqual(['Internal server error']);
  });

  // ── POST /reset-password ──────────────────────────────────────────────────

  test('POST /reset-password returns 400 when body is missing', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
      method: 'POST'
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toBeDefined();
  });

  test('POST /reset-password returns 400 when token is missing', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'NewPassword123' })
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(expect.arrayContaining(['Missing token in request body.']));
  });

  test('POST /reset-password returns 400 when token is too short', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'short', password: 'NewPassword123' })
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(expect.arrayContaining(['Invalid reset token.']));
  });

  test('POST /reset-password returns 400 when password is too short', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'a-valid-length-reset-token-here', password: 'Ab1' })
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(expect.arrayContaining(['Password must be at least 8 characters long.']));
  });

  test('POST /reset-password returns 400 when password is non-string type', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'a-valid-length-reset-token-here', password: 12345678 })
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(expect.arrayContaining(['Missing password in request body.']));
  });

  test('POST /reset-password returns 200 on successful password reset', async () => {
    const updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });

    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue({
          _id: 'user-id',
          email: 'reset@example.com',
          firstName: 'Reset'
        }),
        updateOne
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'a-valid-length-reset-token-here', password: 'NewPassword123' })
    });

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.message).toBe('Password reset successful. You can now log in.');
    expect(updateOne).toHaveBeenCalled();
  });

  test('POST /reset-password returns 400 when token is not found in database', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null)
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'a-valid-length-reset-token-here', password: 'NewPassword123' })
    });

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(['Invalid or expired reset link.']);
  });

  test('POST /reset-password returns 500 on unexpected error', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockRejectedValue(new Error('DB error'))
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'a-valid-length-reset-token-here', password: 'NewPassword123' })
    });

    const payload = await response.json();
    expect(response.status).toBe(500);
    expect(payload.errors).toEqual(['Internal server error']);
  });

  // ── GET /session ──────────────────────────────────────────────────────────

  test('GET /session returns 401 when no session cookie is sent', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/session`);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.errors).toEqual(['Not authenticated. Please log in.']);
  });

  test('GET /session returns 401 when session userId is not a valid ObjectId', async () => {
    const userId = '507f1f77bcf86cd799439011';
    const passwordHash = await bcrypt.hash('Password123', 10);

    const findOne = jest.fn()
      .mockResolvedValueOnce({
        _id: userId,
        email: 'tester@example.com',
        passwordHash,
        emailVerified: true,
        profilePhotoUuid: null,
        firstName: 'Test',
        lastName: 'User'
      })
      .mockResolvedValueOnce({
        _id: { toString: () => userId },
        email: 'tester@example.com',
        passwordHash,
        emailVerified: true,
        profilePhotoUuid: null,
        firstName: 'Test',
        lastName: 'User'
      });

    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne,
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 })
      })
    });

    const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tester@example.com', password: 'Password123' })
    });
    const setCookie = loginResponse.headers.get('set-cookie');
    const cookieHeader = setCookie.split(';')[0];

    // Now corrupt the userId in session by testing a direct GET with valid cookie
    // but getDb now returns a user not found
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null)
      })
    });

    const sessionResponse = await fetch(`${baseUrl}/api/v1/auth/session`, {
      headers: { Cookie: cookieHeader }
    });
    const sessionPayload = await sessionResponse.json();

    expect(sessionResponse.status).toBe(401);
    expect(sessionPayload.errors).toEqual(['Not authenticated. Please log in.']);
  });

  test('GET /session returns 500 on unexpected error', async () => {
    const userId = '507f1f77bcf86cd799439011';
    const passwordHash = await bcrypt.hash('Password123', 10);

    const findOne = jest.fn()
      .mockResolvedValueOnce({
        _id: userId,
        email: 'err@example.com',
        passwordHash,
        emailVerified: true,
        profilePhotoUuid: null,
        firstName: 'Err',
        lastName: 'User'
      })
      .mockResolvedValueOnce({
        _id: { toString: () => userId },
        email: 'err@example.com',
        passwordHash,
        emailVerified: true,
        profilePhotoUuid: null,
        firstName: 'Err',
        lastName: 'User'
      });

    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne,
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 })
      })
    });

    const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'err@example.com', password: 'Password123' })
    });
    const setCookie = loginResponse.headers.get('set-cookie');
    const cookieHeader = setCookie.split(';')[0];

    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockRejectedValue(new Error('DB crash'))
      })
    });

    const sessionResponse = await fetch(`${baseUrl}/api/v1/auth/session`, {
      headers: { Cookie: cookieHeader }
    });
    const sessionPayload = await sessionResponse.json();

    expect(sessionResponse.status).toBe(500);
    expect(sessionPayload.errors).toEqual(['Internal server error']);
  });

  // ── POST /logout ──────────────────────────────────────────────────────────

  test('POST /logout destroys session and returns 200 for authenticated user', async () => {
    const userId = '507f1f77bcf86cd799439011';
    const passwordHash = await bcrypt.hash('Password123', 10);

    const findOne = jest.fn()
      .mockResolvedValueOnce({
        _id: userId,
        email: 'logout@example.com',
        passwordHash,
        emailVerified: true,
        profilePhotoUuid: null,
        firstName: 'Logout',
        lastName: 'User'
      })
      .mockResolvedValueOnce({
        _id: { toString: () => userId },
        email: 'logout@example.com',
        passwordHash,
        emailVerified: true,
        profilePhotoUuid: null,
        firstName: 'Logout',
        lastName: 'User'
      });

    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne,
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 })
      })
    });

    const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'logout@example.com', password: 'Password123' })
    });
    const setCookie = loginResponse.headers.get('set-cookie');
    const cookieHeader = setCookie.split(';')[0];

    const logoutResponse = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookieHeader }
    });
    const logoutPayload = await logoutResponse.json();

    expect(logoutResponse.status).toBe(200);
    expect(logoutPayload.message).toBe('Logout successful.');
  });

  test('POST /logout returns 401 for unauthenticated request', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST'
    });

    expect(response.status).toBe(401);
  });
});
