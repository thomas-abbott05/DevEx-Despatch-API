const express = require('express');

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
  class RequestValidationError extends Error {}

  return {
    RequestValidationError,
    buildRequestMetadata: jest.fn(() => ({ userAgent: 'jest-test-agent' }))
  };
});

jest.mock('../../validators/order-xml-validator-service', () => {
  class BasicXmlValidationError extends Error {}

  return { BasicXmlValidationError };
});

const { listDespatchAdvices, createDespatchAdvice } = require('../../despatch/despatch-service');
const { RequestValidationError } = require('../../despatch/despatch-request-helper');

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

  test('POST /create returns generated despatch XML and headers', async () => {
    createDespatchAdvice.mockResolvedValue({
      adviceId: 'advice-abc',
      despatchXml: '<DespatchAdvice>ok</DespatchAdvice>'
    });

    const response = await fetch(`${baseUrl}/api/v1/despatch/create`, {
      method: 'POST',
      headers: {
        'Api-Key': 'issued-test-key',
        'Content-Type': 'application/xml'
      },
      body: '<Order>valid</Order>'
    });
    const bodyText = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('advice-id')).toBe('advice-abc');
    expect(response.headers.get('executed-at')).toEqual(expect.any(String));
    expect(bodyText).toBe('<DespatchAdvice>ok</DespatchAdvice>');
  });

  test('POST /create returns 400 on request validation error', async () => {
    createDespatchAdvice.mockRejectedValue(new RequestValidationError('Invalid despatch XML payload'));

    const response = await fetch(`${baseUrl}/api/v1/despatch/create`, {
      method: 'POST',
      headers: {
        'Api-Key': 'issued-test-key',
        'Content-Type': 'application/xml'
      },
      body: '<Order>bad</Order>'
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      success: false,
      error: 'Invalid despatch XML payload'
    });
  });
});
