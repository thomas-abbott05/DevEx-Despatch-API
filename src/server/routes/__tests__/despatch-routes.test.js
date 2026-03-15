const express = require('express');
const { RequestValidationError, validateXmlRequest } = require('../../despatch/despatch-request-helper');
const { listDespatchAdvices, createDespatchAdvice } = require('../../despatch/despatch-service');

jest.mock('../../middleware/api-key-validation', () =>
  jest.fn((req, res, next) => {
    req.apiKey = 'issued-test-key';
    req.apiKeyOwner = 'team-a';
    next();
  })
);

jest.mock('../../despatch/despatch-service', () => ({
  listDespatchAdvices: jest.fn(),
  createDespatchAdvice: jest.fn()
}));

jest.mock('../../despatch/despatch-request-helper', () => {
  class RequestValidationError extends Error {
    constructor(message) {
      super(message || 'Request validation failed');
      this.name = 'RequestValidationError';
      this.statusCode = 400;
    }
  }

  return {
    RequestValidationError,
    validateXmlRequest: jest.fn(),
    buildRequestMetadata: jest.fn(() => ({ userAgent: 'jest-test-agent' }))
  };
});

jest.mock('../../validators/basic-xml-validator-service', () => {
  class BasicXmlValidationError extends Error {
    constructor(errors) {
      super('XML validation failed');
      this.name = 'BasicXmlValidationError';
      this.errors = errors;
      this.statusCode = 400;
    }
  }

  return { BasicXmlValidationError };
});


function startServerWithRouter(router) {
  const app = express();
  app.use('/api/v1/despatch', router);

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

describe('despatch routes', () => {
  let server;
  let baseUrl;
  let router;

  beforeAll(async () => {
    router = require('../despatch-advice-routes');
    const started = await startServerWithRouter(router);
    server = started.server;
    baseUrl = started.baseUrl;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    validateXmlRequest.mockImplementation(() => {});
  });

  test('GET /list returns despatch results', async () => {
    listDespatchAdvices.mockResolvedValue([{ adviceId: 'advice-1' }]);

    const response = await fetch(`${baseUrl}/api/v1/despatch/list`, {
      headers: {
        'Api-Key': 'issued-test-key'
      }
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.results).toEqual([{ adviceId: 'advice-1' }]);
    expect(payload['executed-at']).toEqual(expect.any(Number));
    expect(listDespatchAdvices).toHaveBeenCalledWith('issued-test-key');
  });

  test('GET /list returns 500 when despatch listing fails', async () => {
    listDespatchAdvices.mockRejectedValue(new Error('Database read failed'));

    const response = await fetch(`${baseUrl}/api/v1/despatch/list`, {
      headers: {
        'Api-Key': 'issued-test-key'
      }
    });
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.errors).toEqual(['Database read failed']);
  });

  test('POST /create returns adviceIds and executed-at in JSON body', async () => {
    createDespatchAdvice.mockResolvedValue({
      adviceIds: ['advice-abc', 'advice-def']
    });

    const response = await fetch(`${baseUrl}/api/v1/despatch/create`, {
      method: 'POST',
      headers: {
        'Api-Key': 'issued-test-key',
        'Content-Type': 'application/xml'
      },
      body: '<Order>valid</Order>'
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.adviceIds).toEqual(['advice-abc', 'advice-def']);
    expect(payload['executed-at']).toEqual(expect.any(Number));
  });

  test('POST /create returns 400 with invalid XML', async () => {
    validateXmlRequest.mockImplementation(() => {
      throw new RequestValidationError('Invalid XML format');
    });
    const response = await fetch(`${baseUrl}/api/v1/despatch/create`, {
      method: 'POST',
      headers: {
        'Api-Key': 'issued-test-key',
        'Content-Type': 'application/xml'
      },
      body: '<Order>invalid</Order>'
    });
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.errors).toEqual(['Invalid XML format']);
  });

  test('POST /create returns error message and success false if createDespatchAdvice throws an error', async () => {
    createDespatchAdvice.mockImplementation(() => {
      throw new Error('Database error');
    });
    const response = await fetch(`${baseUrl}/api/v1/despatch/create`, {
      method: 'POST',
      headers: {
        'Api-Key': 'issued-test-key',
        'Content-Type': 'application/xml'
      },
      body: '<Order>valid</Order>'
    });
    const payload = await response.json();
    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.errors).toEqual(['Database error']);
  });
});
