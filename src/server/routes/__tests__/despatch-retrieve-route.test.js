// SYSTEM TEST for /despatch/retrieve endpoint, covering both search types (advice-id and order)
const express = require('express');

jest.mock('../../middleware/api-key-validation', () =>
  jest.fn((req, res, next) => {
    req.apiKey = 'issued-test-key';
    next();
  })
);

jest.mock('../../despatch/despatch-advice-service', () => ({
  getDespatchAdviceByAdviceId: jest.fn(),
  getDespatchAdviceByOrderId: jest.fn(),
  listDespatchAdvices: jest.fn(),
  createDespatchAdvice: jest.fn()
}));

jest.mock('../../validators/order-xml-validator-service', () => ({
  validateOrder: jest.fn()
}));

jest.mock('../../despatch/order-parser-service', () => ({
  parseOrderXml: jest.fn()
}));

jest.mock('../../validators/basic-xml-validator-service', () => ({
  isValidUuid: jest.fn()
}));

const { getDespatchAdviceByAdviceId, getDespatchAdviceByOrderId } = require('../../despatch/despatch-advice-service');
const { validateOrder } = require('../../validators/order-xml-validator-service');
const { parseOrderXml } = require('../../despatch/order-parser-service');
const { isValidUuid } = require('../../validators/basic-xml-validator-service');

const VALID_UUID = 'e553cc8e-8b37-4a9b-a0cf-87c34ea70a35';
const SAMPLE_ORDER_XML = '<Order><cbc:ID>ORD-001</cbc:ID></Order>';

function startServerWithRouter(router) {
  const app = express();
  app.use('/api/v1/despatch', router);

  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

describe('GET /despatch/retrieve', () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    const router = require('../despatch-advice-routes');
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

  describe('parameter validation', () => {
    test('returns 400 when search-type is missing', async () => {
      const response = await fetch(`${baseUrl}/api/v1/despatch/retrieve?query=something`, {
        headers: { 'Api-Key': 'issued-test-key' }
      });
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.errors[0]).toMatch(/search-type/);
      expect(payload['executed-at']).toEqual(expect.any(Number));
    });

    test('returns 400 when search-type is not a recognised value', async () => {
      const response = await fetch(`${baseUrl}/api/v1/despatch/retrieve?search-type=unknown&query=something`, {
        headers: { 'Api-Key': 'issued-test-key' }
      });
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.errors[0]).toMatch(/search-type/);
    });

    test('returns 400 when query parameter is missing', async () => {
      const response = await fetch(`${baseUrl}/api/v1/despatch/retrieve?search-type=advice-id`, {
        headers: { 'Api-Key': 'issued-test-key' }
      });
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.errors[0]).toMatch(/query/);
    });
  });

  describe('search-type: advice-id', () => {
    test('returns 400 when query is not a valid UUID', async () => {
      isValidUuid.mockReturnValue(false);

      const response = await fetch(`${baseUrl}/api/v1/despatch/retrieve?search-type=advice-id&query=not-a-uuid`, {
        headers: { 'Api-Key': 'issued-test-key' }
      });
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.errors[0]).toMatch(/UUID/);
      expect(payload['executed-at']).toEqual(expect.any(Number));
    });

    test('returns 404 when advice-id is not found', async () => {
      isValidUuid.mockReturnValue(true);
      getDespatchAdviceByAdviceId.mockResolvedValue(null);

      const response = await fetch(`${baseUrl}/api/v1/despatch/retrieve?search-type=advice-id&query=${VALID_UUID}`, {
        headers: { 'Api-Key': 'issued-test-key' }
      });
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(payload.errors[0]).toMatch(/not found/);
      expect(payload['executed-at']).toEqual(expect.any(Number));
    });

    test('returns 200 with despatch advice XML when advice-id is found', async () => {
      isValidUuid.mockReturnValue(true);
      getDespatchAdviceByAdviceId.mockResolvedValue({ despatchXml: '<DespatchAdvice/>' });

      const response = await fetch(`${baseUrl}/api/v1/despatch/retrieve?search-type=advice-id&query=${VALID_UUID}`, {
        headers: { 'Api-Key': 'issued-test-key' }
      });
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload['despatch-advice']).toBe('<DespatchAdvice/>');
      expect(payload['advice-id']).toBe(VALID_UUID);
      expect(payload['executed-at']).toEqual(expect.any(Number));
      expect(getDespatchAdviceByAdviceId).toHaveBeenCalledWith('issued-test-key', VALID_UUID);
    });
  });

  describe('search-type: order', () => {
    test('returns 400 when order XML cannot be parsed', async () => {
      parseOrderXml.mockImplementation(() => { throw new Error('XML parse error'); });

      const response = await fetch(
        `${baseUrl}/api/v1/despatch/retrieve?search-type=order&query=${encodeURIComponent(SAMPLE_ORDER_XML)}`,
        { headers: { 'Api-Key': 'issued-test-key' } }
      );
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.errors[0]).toContain('XML parse error');
    });

    test('returns 400 when order XML fails validation', async () => {
      parseOrderXml.mockReturnValue({ tree: 'parsed' });
      validateOrder.mockResolvedValue({ success: false, errors: ['Missing required field: cbc:ID'] });

      const response = await fetch(
        `${baseUrl}/api/v1/despatch/retrieve?search-type=order&query=${encodeURIComponent(SAMPLE_ORDER_XML)}`,
        { headers: { 'Api-Key': 'issued-test-key' } }
      );
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.errors).toEqual(['Missing required field: cbc:ID']);
    });

    test('returns 400 when validated order XML contains no orderId', async () => {
      parseOrderXml.mockReturnValue({ tree: 'parsed' });
      validateOrder.mockResolvedValue({ success: true, orderId: null });

      const response = await fetch(
        `${baseUrl}/api/v1/despatch/retrieve?search-type=order&query=${encodeURIComponent(SAMPLE_ORDER_XML)}`,
        { headers: { 'Api-Key': 'issued-test-key' } }
      );
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.errors[0]).toMatch(/cbc:ID/);
    });

    test('returns 404 when no despatch advice is found for the order', async () => {
      parseOrderXml.mockReturnValue({ tree: 'parsed' });
      validateOrder.mockResolvedValue({ success: true, orderId: 'ORD-001' });
      getDespatchAdviceByOrderId.mockResolvedValue(null);

      const response = await fetch(
        `${baseUrl}/api/v1/despatch/retrieve?search-type=order&query=${encodeURIComponent(SAMPLE_ORDER_XML)}`,
        { headers: { 'Api-Key': 'issued-test-key' } }
      );
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(payload.errors[0]).toMatch(/not found/);
      expect(payload['executed-at']).toEqual(expect.any(Number));
    });

    test('returns 200 with despatch advice XML when order is found', async () => {
      parseOrderXml.mockReturnValue({ tree: 'parsed' });
      validateOrder.mockResolvedValue({ success: true, orderId: 'ORD-001' });
      getDespatchAdviceByOrderId.mockResolvedValue({ despatchXml: '<DespatchAdvice/>', _id: VALID_UUID });

      const response = await fetch(
        `${baseUrl}/api/v1/despatch/retrieve?search-type=order&query=${encodeURIComponent(SAMPLE_ORDER_XML)}`,
        { headers: { 'Api-Key': 'issued-test-key' } }
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload['despatch-advice']).toBe('<DespatchAdvice/>');
      expect(payload['advice-id']).toBe(VALID_UUID);
      expect(payload['executed-at']).toEqual(expect.any(Number));
      expect(getDespatchAdviceByOrderId).toHaveBeenCalledWith('issued-test-key', 'ORD-001');
    });
  });
});
