const express = require('express');

process.env.MASTER_API_KEY = process.env.MASTER_API_KEY;

jest.mock('../../database', () => ({
  getDb: jest.fn()
}));

const { getDb } = require('../../database');
const router = require('../api-key-management-routes');

function startServerWithRouter(router) {
  const app = express();
  app.use('/api/v1/api-key', router);

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

describe('api-key-management routes', () => {
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

  test('GET /list returns 401 without master key', async () => {
    const response = await fetch(`${baseUrl}/api/v1/api-key/list`);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.errors[0]).toContain('master key');
  });

  test('GET /list returns 401 with invalid master key', async () => {
    const response = await fetch(`${baseUrl}/api/v1/api-key/list`, {
      headers: {
        'Api-Key': 'wrong-master-key'
      }
    });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.errors).toEqual(['Invalid master API key']);
  });

  test('GET /list returns key metadata with valid master key', async () => {
    const mockToArray = jest.fn().mockResolvedValue([{ key: 'k1', teamName: 'team-a' }]);
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        find: jest.fn().mockReturnValue({ toArray: mockToArray })
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/api-key/list`, {
      headers: {
        'Api-Key': process.env.MASTER_API_KEY
      }
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.results).toEqual([{ key: 'k1', teamName: 'team-a' }]);
    expect(payload['executed-at']).toEqual(expect.any(Number));
  });

  test('POST /create creates a key with valid master key and teamName, contactEmail, and contactName', async () => {
    const mockInsertOne = jest.fn().mockResolvedValue({ acknowledged: true });
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        insertOne: mockInsertOne
      })
    });
    const mockFindOne = jest.fn().mockResolvedValue(null);
    getDb().collection().findOne = mockFindOne;

    const response = await fetch(`${baseUrl}/api/v1/api-key/create`, {
      method: 'POST',
      headers: {
        'Api-Key': process.env.MASTER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ teamName: 'team-a', contactEmail: 'contact@example.com', contactName: 'John Doe' })
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.apiKey).toEqual(expect.any(String));
    expect(payload.apiKey).toHaveLength(64);
    expect(payload['executed-at']).toEqual(expect.any(Number));

    expect(mockInsertOne).toHaveBeenCalledWith(expect.objectContaining({
      teamName: 'team-a',
      contactEmail: 'contact@example.com',
      contactName: 'John Doe',
      _id: expect.any(String),
      key: expect.any(String),
      createdAt: expect.any(Number)
    }));
  });
});
