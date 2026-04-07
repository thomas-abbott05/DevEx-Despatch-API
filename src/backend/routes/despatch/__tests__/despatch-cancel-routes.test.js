const express = require('express');

jest.mock('../../../middleware/api-key-validation', () =>
  jest.fn((req, res, next) => {
    req.apiKey = 'issued-test-key';
    next();
  })
);

jest.mock('../../../despatch/cancellation/despatch-cancel-order', () => ({
  cancelDespatchAdvice: jest.fn(),
  getCancellation: jest.fn()
}));

jest.mock('../../../despatch/cancellation/despatch-cancel-fulfilment', () => ({
  createFulfilmentCancellation: jest.fn(),
  getFulfilmentCancellation: jest.fn()
}));

jest.mock('../../../despatch/cancellation/despatch-cancel-order-request-helper', () => ({
  buildCancelRequestMetadata: jest.fn(() => ({ adviceId: 'e553cc8e-8b37-4a9b-a0cf-87c34ea70a35' })),
  buildCancelRetrievalMetadata: jest.fn(() => ({ adviceId: 'e553cc8e-8b37-4a9b-a0cf-87c34ea70a35' }))
}));

jest.mock('../../../despatch/cancellation/despatch-cancel-fulfilment-helper', () => ({
  buildFulfilmentCancelRequestMetadata: jest.fn(() => ({ adviceId: 'e553cc8e-8b37-4a9b-a0cf-87c34ea70a35', cancellationReason: 'No stock' })),
  buildFulfilmentCancelRetrievalMetadata: jest.fn(() => ({ adviceId: 'e553cc8e-8b37-4a9b-a0cf-87c34ea70a35' }))
}));

const { cancelDespatchAdvice, getCancellation } = require('../../../despatch/cancellation/despatch-cancel-order');
const { createFulfilmentCancellation, getFulfilmentCancellation } = require('../../../despatch/cancellation/despatch-cancel-fulfilment');

const VALID_ADVICE_ID = 'e553cc8e-8b37-4a9b-a0cf-87c34ea70a35';
const VALID_CANCELLATION_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

function startServerWithRouter(router) {
  const app = express();
  app.use('/api/v1/despatch/cancel', router);

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

describe('despatch cancellation routes', () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    const router = require('../despatch-cancellation-routes');
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

  describe('POST /order', () => {
    test('returns 200 with cancellation result on success', async () => {
      cancelDespatchAdvice.mockResolvedValue({
        'order-cancellation-id': VALID_CANCELLATION_ID,
      });

      const response = await fetch(`${baseUrl}/api/v1/despatch/cancel/order`, {
        method: 'POST',
        headers: { 'api-key': 'issued-test-key', 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'advice-id': VALID_ADVICE_ID, 'order-cancellation-document': '<OrderCancellation/>' })
      });

      const payload = await response.json();
      expect(response.status).toBe(200);
      expect(payload['order-cancellation-id']).toBe(VALID_CANCELLATION_ID);
      expect(cancelDespatchAdvice).toHaveBeenCalledWith('issued-test-key', expect.any(Object));
    });

    test('returns 404 when despatch not found', async () => {
      const error = new Error('Not found');
      error.statusCode = 404;
      cancelDespatchAdvice.mockRejectedValue(error);

      const response = await fetch(`${baseUrl}/api/v1/despatch/cancel/order`, {
        method: 'POST',
        headers: { 'api-key': 'issued-test-key', 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'advice-id': VALID_ADVICE_ID, 'order-cancellation-document': '<OrderCancellation/>' })
      });

      expect(response.status).toBe(404);
    });

    test('returns 400 on validation error', async () => {
      const error = new Error('Missing required field: advice-id');
      error.statusCode = 400;
      cancelDespatchAdvice.mockRejectedValue(error);

      const response = await fetch(`${baseUrl}/api/v1/despatch/cancel/order`, {
        method: 'POST',
        headers: { 'api-key': 'issued-test-key', 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(400);
    });

    test('returns 403 when api key does not match resource owner', async () => {
      const error = new Error('Unauthorised access.');
      error.statusCode = 403;
      cancelDespatchAdvice.mockRejectedValue(error);

      const response = await fetch(`${baseUrl}/api/v1/despatch/cancel/order`, {
        method: 'POST',
        headers: { 'api-key': 'issued-test-key', 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'advice-id': VALID_ADVICE_ID, 'order-cancellation-document': '<OrderCancellation/>' })
      });

      expect(response.status).toBe(403);
    });

    test('returns detailed XML validation errors when available', async () => {
      const error = new Error('XML validation failed');
      error.statusCode = 400;
      error.errors = ['Missing OrderCancellation root element'];
      cancelDespatchAdvice.mockRejectedValue(error);

      const response = await fetch(`${baseUrl}/api/v1/despatch/cancel/order`, {
        method: 'POST',
        headers: { 'api-key': 'issued-test-key', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'advice-id': VALID_ADVICE_ID,
          'order-cancellation-document': '<OrderCancellation/>'
        })
      });

      const payload = await response.json();
      expect(response.status).toBe(400);
      expect(payload.errors).toEqual(['Missing OrderCancellation root element']);
    });

    test('returns 500 when error has no statusCode', async () => {
      cancelDespatchAdvice.mockRejectedValue(new Error('unexpected crash'));

      const response = await fetch(`${baseUrl}/api/v1/despatch/cancel/order`, {
        method: 'POST',
        headers: { 'api-key': 'issued-test-key', 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'advice-id': VALID_ADVICE_ID })
      });

      expect(response.status).toBe(500);
    });
  });

  describe('GET /order', () => {
    test('returns 200 with cancellation result on success', async () => {
      getCancellation.mockResolvedValue({
        'order-cancellation-id': VALID_CANCELLATION_ID
      });

      const response = await fetch(
        `${baseUrl}/api/v1/despatch/cancel/order?id=${VALID_ADVICE_ID}`,
        { headers: { 'api-key': 'issued-test-key' } }
      );

      const payload = await response.json();
      expect(response.status).toBe(200);
      expect(payload['order-cancellation-id']).toBe(VALID_CANCELLATION_ID);
      expect(getCancellation).toHaveBeenCalledWith('issued-test-key', expect.any(Object));
    });

    test('returns 404 when cancellation not found', async () => {
      const error = new Error('Not found');
      error.statusCode = 404;
      getCancellation.mockRejectedValue(error);

      const response = await fetch(
        `${baseUrl}/api/v1/despatch/cancel/order?id=${VALID_ADVICE_ID}`,
        { headers: { 'api-key': 'issued-test-key' } }
      );

      expect(response.status).toBe(404);
    });

    test('returns 403 when api key does not match resource owner', async () => {
      const error = new Error('Unauthorised access.');
      error.statusCode = 403;
      getCancellation.mockRejectedValue(error);

      const response = await fetch(
        `${baseUrl}/api/v1/despatch/cancel/order?id=${VALID_ADVICE_ID}`,
        { headers: { 'api-key': 'issued-test-key' } }
      );

      expect(response.status).toBe(403);
    });
  });

  describe('POST /fulfilment', () => {
    test('returns 200 with fulfilment cancellation result on success', async () => {
      createFulfilmentCancellation.mockResolvedValue({
        'fulfilment-cancellation': '<FulfilmentCancellation/>',
        'fulfilment-cancellation-reason': 'No stock',
        'fulfilment-cancellation-id': VALID_CANCELLATION_ID,
        'advice-id': VALID_ADVICE_ID,
        'executed-at': new Date()
      });

      const response = await fetch(`${baseUrl}/api/v1/despatch/cancel/fulfilment`, {
        method: 'POST',
        headers: { 'api-key': 'issued-test-key', 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'advice-id': VALID_ADVICE_ID, 'fulfilment-cancellation-reason': 'No stock' })
      });

      const payload = await response.json();
      expect(response.status).toBe(200);
      expect(payload['fulfilment-cancellation-id']).toBe(VALID_CANCELLATION_ID);
      expect(createFulfilmentCancellation).toHaveBeenCalledWith('issued-test-key', expect.any(Object));
    });

    test('returns 404 when despatch not found', async () => {
      const error = new Error('Not found');
      error.statusCode = 404;
      createFulfilmentCancellation.mockRejectedValue(error);

      const response = await fetch(`${baseUrl}/api/v1/despatch/cancel/fulfilment`, {
        method: 'POST',
        headers: { 'api-key': 'issued-test-key', 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'advice-id': VALID_ADVICE_ID, 'fulfilment-cancellation-reason': 'No stock' })
      });

      expect(response.status).toBe(404);
    });

    test('returns 400 on validation error', async () => {
      const error = new Error('Missing required field: advice-id');
      error.statusCode = 400;
      createFulfilmentCancellation.mockRejectedValue(error);

      const response = await fetch(`${baseUrl}/api/v1/despatch/cancel/fulfilment`, {
        method: 'POST',
        headers: { 'api-key': 'issued-test-key', 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(400);
    });

    test('returns 403 when api key does not match resource owner', async () => {
      const error = new Error('Unauthorised access.');
      error.statusCode = 403;
      createFulfilmentCancellation.mockRejectedValue(error);

      const response = await fetch(`${baseUrl}/api/v1/despatch/cancel/fulfilment`, {
        method: 'POST',
        headers: { 'api-key': 'issued-test-key', 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'advice-id': VALID_ADVICE_ID, 'fulfilment-cancellation-reason': 'No stock' })
      });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /fulfilment', () => {
    test('returns 200 with fulfilment cancellation result on success', async () => {
      getFulfilmentCancellation.mockResolvedValue({
        'fulfilment-cancellation': '<FulfilmentCancellation/>',
        'fulfilment-cancellation-reason': 'No stock',
        'fulfilment-cancellation-id': VALID_CANCELLATION_ID,
        'advice-id': VALID_ADVICE_ID,
        'executed-at': new Date()
      });

      const response = await fetch(
        `${baseUrl}/api/v1/despatch/cancel/fulfilment?id=${VALID_ADVICE_ID}`,
        { headers: { 'api-key': 'issued-test-key' } }
      );

      const payload = await response.json();
      expect(response.status).toBe(200);
      expect(payload['fulfilment-cancellation-id']).toBe(VALID_CANCELLATION_ID);
      expect(getFulfilmentCancellation).toHaveBeenCalledWith('issued-test-key', expect.any(Object));
    });

    test('returns 404 when fulfilment cancellation not found', async () => {
      const error = new Error('Not found');
      error.statusCode = 404;
      getFulfilmentCancellation.mockRejectedValue(error);

      const response = await fetch(
        `${baseUrl}/api/v1/despatch/cancel/fulfilment?id=${VALID_ADVICE_ID}`,
        { headers: { 'api-key': 'issued-test-key' } }
      );

      expect(response.status).toBe(404);
    });

    test('returns 403 when api key does not match resource owner', async () => {
      const error = new Error('Unauthorised access.');
      error.statusCode = 403;
      getFulfilmentCancellation.mockRejectedValue(error);

      const response = await fetch(
        `${baseUrl}/api/v1/despatch/cancel/fulfilment?id=${VALID_ADVICE_ID}`,
        { headers: { 'api-key': 'issued-test-key' } }
      );

      expect(response.status).toBe(403);
    });

    test('returns 500 and falls back to message when error has no errors array', async () => {
      const error = new Error('unexpected crash');
      getFulfilmentCancellation.mockRejectedValue(error);

      const response = await fetch(
        `${baseUrl}/api/v1/despatch/cancel/fulfilment?id=${VALID_ADVICE_ID}`,
        { headers: { 'api-key': 'issued-test-key' } }
      );

      const payload = await response.json();
      expect(response.status).toBe(500);
      expect(payload.errors).toEqual(['unexpected crash']);
    });
  });

  describe('GET /order - error fallbacks', () => {
    test('returns 500 and falls back to message when error has no errors array', async () => {
      const error = new Error('db crash');
      getCancellation.mockRejectedValue(error);

      const response = await fetch(
        `${baseUrl}/api/v1/despatch/cancel/order?id=${VALID_ADVICE_ID}`,
        { headers: { 'api-key': 'issued-test-key' } }
      );

      const payload = await response.json();
      expect(response.status).toBe(500);
      expect(payload.errors).toEqual(['db crash']);
    });
  });

  describe('POST /fulfilment - error fallbacks', () => {
    test('returns 500 when error has no statusCode or errors array', async () => {
      createFulfilmentCancellation.mockRejectedValue(new Error('crash'));

      const response = await fetch(`${baseUrl}/api/v1/despatch/cancel/fulfilment`, {
        method: 'POST',
        headers: { 'api-key': 'issued-test-key', 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const payload = await response.json();
      expect(response.status).toBe(500);
      expect(payload.errors).toEqual(['crash']);
    });
  });
});