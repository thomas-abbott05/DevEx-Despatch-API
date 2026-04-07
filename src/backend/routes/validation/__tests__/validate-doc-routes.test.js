const express = require('express');
const { validateXml } = require('../../../validators/common/xsd-validator-service');

jest.mock('../../../middleware/api-key-validation', () =>
  jest.fn((req, res, next) => {
    req.apiKey = 'issued-test-key';
    req.apiKeyOwner = 'team-a';
    next();
  })
);

jest.mock('../../../validators/common/xsd-validator-service', () => ({
  validateXml: jest.fn()
}));

function startServerWithRouter(router) {
  const app = express();
  app.use('/api/v1/validate-doc', router);

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

describe('validate-doc routes', () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    const router = require('../validate-doc-routes');
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

  test('POST /order returns validation response for valid route', async () => {
    validateXml.mockResolvedValue({ success: true, errors: [] });

    const response = await fetch(`${baseUrl}/api/v1/validate-doc/order`, {
      method: 'POST',
      headers: {
        'Api-Key': 'issued-test-key',
        'Content-Type': 'application/xml'
      },
      body: '<Order><id>123</id></Order>'
    });

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.valid).toBe(true);
    expect(payload.errors).toEqual([]);
    expect(payload['executed-at']).toEqual(expect.any(Number));
    expect(validateXml).toHaveBeenCalledWith('order', '<Order><id>123</id></Order>');
  });

  test('POST with invalid document type returns 400', async () => {
    const response = await fetch(`${baseUrl}/api/v1/validate-doc/not-real`, {
      method: 'POST',
      headers: {
        'Api-Key': 'issued-test-key',
        'Content-Type': 'application/xml'
      },
      body: '<Order><id>123</id></Order>'
    });

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.errors[0]).toContain('is not a valid option');
    expect(payload['executed-at']).toEqual(expect.any(Number));
    expect(validateXml).not.toHaveBeenCalled();
  });

  test('POST with empty body returns 400', async () => {
    const response = await fetch(`${baseUrl}/api/v1/validate-doc/order`, {
      method: 'POST',
      headers: {
        'Api-Key': 'issued-test-key',
        'Content-Type': 'application/xml'
      },
      body: '   '
    });

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.errors).toContain('Missing required parameter: XML body must be provided.');
    expect(validateXml).not.toHaveBeenCalled();
  });

  test('POST returns 500 when validateXml throws', async () => {
    validateXml.mockRejectedValue(new Error('unexpected parse failure'));

    const response = await fetch(`${baseUrl}/api/v1/validate-doc/order`, {
      method: 'POST',
      headers: {
        'Api-Key': 'issued-test-key',
        'Content-Type': 'application/xml'
      },
      body: '<Order/>'
    });

    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.errors).toContain('Internal server error during validation.');
  });

  test('POST returns empty errors array when validateXml returns success with no errors field', async () => {
    validateXml.mockResolvedValue({ success: true });

    const response = await fetch(`${baseUrl}/api/v1/validate-doc/order`, {
      method: 'POST',
      headers: {
        'Api-Key': 'issued-test-key',
        'Content-Type': 'application/xml'
      },
      body: '<Order/>'
    });

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.valid).toBe(true);
    expect(payload.errors).toEqual([]);
  });
});
