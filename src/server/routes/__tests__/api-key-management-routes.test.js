const express = require('express');

process.env.MASTER_API_KEY = 'master-test-key';

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

  test('POST /create returns 400 when teamName is missing', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
        insertOne: jest.fn()
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/api-key/create`, {
      method: 'POST',
      headers: {
        'Api-Key': process.env.MASTER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ contactEmail: 'contact@example.com', contactName: 'John Doe' })
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(['Missing teamName in request body']);
  });

  test('POST /create returns 400 when contactEmail is missing', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
        insertOne: jest.fn()
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/api-key/create`, {
      method: 'POST',
      headers: {
        'Api-Key': process.env.MASTER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ teamName: 'team-a', contactName: 'John Doe' })
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(['Missing contactEmail in request body']);
  });

  test('POST /create returns 400 when contactName is missing', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
        insertOne: jest.fn()
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/api-key/create`, {
      method: 'POST',
      headers: {
        'Api-Key': process.env.MASTER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ teamName: 'team-a', contactEmail: 'contact@example.com' })
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(['Missing contactName in request body']);
  });

  test('POST /create returns 400 when contactEmail already has an issued key', async () => {
    const mockFindOne = jest.fn().mockResolvedValue({ key: 'existing' });
    const mockInsertOne = jest.fn();
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: mockFindOne,
        insertOne: mockInsertOne
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/api-key/create`, {
      method: 'POST',
      headers: {
        'Api-Key': process.env.MASTER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ teamName: 'team-a', contactEmail: 'contact@example.com', contactName: 'John Doe' })
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(['An API key has already been issued for this contact email']);
    expect(mockInsertOne).not.toHaveBeenCalled();
  });

  test('POST /create returns 500 when database insert fails', async () => {
    const mockFindOne = jest.fn().mockResolvedValue(null);
    const mockInsertOne = jest.fn().mockRejectedValue(new Error('insert failed'));
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: mockFindOne,
        insertOne: mockInsertOne
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/api-key/create`, {
      method: 'POST',
      headers: {
        'Api-Key': process.env.MASTER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ teamName: 'team-a', contactEmail: 'contact@example.com', contactName: 'John Doe' })
    });
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.errors).toEqual(['Internal server error']);
  });

  test('GET /list returns 500 when database read fails', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockRejectedValue(new Error('list failed'))
        })
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/api-key/list`, {
      headers: {
        'Api-Key': process.env.MASTER_API_KEY
      }
    });
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.errors).toEqual(['Internal server error']);
  });

  test('GET /retrieve/:key returns key data when key exists', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue({ key: 'k1', teamName: 'team-a' })
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/api-key/retrieve/k1`, {
      headers: {
        'Api-Key': process.env.MASTER_API_KEY
      }
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ key: 'k1', teamName: 'team-a' });
  });

  test('GET /retrieve/:key returns 404 when key is missing', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null)
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/api-key/retrieve/missing`, {
      headers: {
        'Api-Key': process.env.MASTER_API_KEY
      }
    });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.errors).toEqual(['API key not found']);
  });

  test('GET /retrieve/:key returns 500 when lookup fails', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockRejectedValue(new Error('lookup failed'))
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/api-key/retrieve/k1`, {
      headers: {
        'Api-Key': process.env.MASTER_API_KEY
      }
    });
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.errors).toEqual(['Internal server error']);
  });

  test('DELETE /delete/:key returns success when a key is deleted', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 })
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/api-key/delete/k1`, {
      method: 'DELETE',
      headers: {
        'Api-Key': process.env.MASTER_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.errors).toEqual([]);
    expect(payload['executed-at']).toEqual(expect.any(Number));
  });

  test('DELETE /delete/:key returns 404 when key does not exist', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        deleteOne: jest.fn().mockResolvedValue({ deletedCount: 0 })
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/api-key/delete/missing`, {
      method: 'DELETE',
      headers: {
        'Api-Key': process.env.MASTER_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.errors).toEqual(['API key not found']);
  });

  test('DELETE /delete/:key returns 500 when delete fails', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        deleteOne: jest.fn().mockRejectedValue(new Error('delete failed'))
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/api-key/delete/k1`, {
      method: 'DELETE',
      headers: {
        'Api-Key': process.env.MASTER_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.errors).toEqual(['Internal server error']);
  });
});
