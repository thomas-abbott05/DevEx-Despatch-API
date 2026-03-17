const express = require('express');

process.env.MASTER_API_KEY = 'master-test-key';
process.env.EMAIL_USER = 'devex@ad.unsw.edu.au';
process.env.DEFAULT_DOCS_URL = 'https://devex.cloud.tcore.network/api-docs';

jest.mock('../../database', () => ({
  getDb: jest.fn()
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn()
}));

jest.mock('../../config/email-template-service', () => ({
  renderEmailTemplate: jest.fn()
}));

const { getDb } = require('../../database');
const nodemailer = require('nodemailer');
const { renderEmailTemplate } = require('../../config/email-template-service');
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
    renderEmailTemplate.mockReturnValue('<p>email</p>');
    nodemailer.createTransport.mockReturnValue({
      sendMail: jest.fn().mockResolvedValue({})
    });
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

  test('POST /create returns 400 when contactEmail domain is invalid', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
        insertOne: jest.fn()
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/api-key/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        teamName: 'team-a',
        contactEmail: 'user@gmail.com',
        contactName: 'John Doe'
      })
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.errors[0]).toContain('Invalid email format');
  });

  test('POST /create resends key details when contactEmail already exists', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue({ _id: 'existing-key-1' }),
        insertOne: jest.fn()
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/api-key/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        teamName: 'team-a',
        contactEmail: 'user@unsw.edu.au',
        contactName: 'John Doe'
      })
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.message).toContain('already been issued');
    expect(renderEmailTemplate).toHaveBeenCalledWith(
      'api-key-reminder.html',
      expect.objectContaining({
        contactName: 'John Doe',
        teamName: 'team-a',
        apiKey: 'existing-key-1'
      })
    );
  });

  test('POST /create creates key and sends created template email', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    const insertOne = jest.fn().mockResolvedValue({ acknowledged: true });
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne,
        insertOne
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/api-key/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        teamName: 'team-a',
        contactEmail: 'new.user@ad.unsw.edu.au',
        contactName: 'Jane Doe'
      })
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.message).toContain('API key created successfully');
    expect(insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: expect.any(String),
        teamName: 'team-a',
        contactEmail: 'new.user@ad.unsw.edu.au',
        contactName: 'Jane Doe',
        createdAt: expect.any(Number)
      })
    );
    expect(renderEmailTemplate).toHaveBeenCalledWith(
      'api-key-created.html',
      expect.objectContaining({
        contactName: 'Jane Doe',
        teamName: 'team-a',
        supportEmail: process.env.EMAIL_USER,
        docsUrl: process.env.DEFAULT_DOCS_URL
      })
    );
  });

  test('POST /create returns 500 when sending email throws', async () => {
    const sendMail = jest.fn().mockRejectedValue(new Error('smtp failed'));
    nodemailer.createTransport.mockReturnValue({ sendMail });
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
        insertOne: jest.fn().mockResolvedValue({ acknowledged: true })
      })
    });

    const response = await fetch(`${baseUrl}/api/v1/api-key/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        teamName: 'team-a',
        contactEmail: 'new.user@student.unsw.edu.au',
        contactName: 'Jane Doe'
      })
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
