const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');

jest.mock('../../../database', () => ({
  getDb: jest.fn()
}));

const { getDb } = require('../../../database');
const router = require('../auth-routes');

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

  beforeAll(async () => {
    const started = await startServerWithRouter(router);
    server = started.server;
    baseUrl = started.baseUrl;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    jest.clearAllMocks();
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
        profilePhotoUuid: null
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
      firstName: 'Test',
      lastName: 'User'
    }));

    expect(insertOne.mock.calls[0][0].passwordHash).not.toBe('Password123');
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
        profilePhotoUuid: null,
        firstName: 'Test',
        lastName: 'User'
      })
      .mockResolvedValueOnce({
        _id: { toString: () => userId },
        email: 'tester@example.com',
        passwordHash,
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
