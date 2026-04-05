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
});
