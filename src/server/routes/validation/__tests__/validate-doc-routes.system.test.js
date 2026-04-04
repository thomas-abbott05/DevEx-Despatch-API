const express = require('express');
const fs = require('node:fs');
const path = require('node:path');

jest.mock('../../../middleware/api-key-validation', () =>
  jest.fn((req, res, next) => {
    req.apiKey = 'issued-test-key';
    req.apiKeyOwner = 'team-a';
    next();
  })
);

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

describe('validate-doc route system tests', () => {
  let server;
  let baseUrl;
  const mockDir = path.join(__dirname, '../../../despatch/mocks');

  const fixtures = {
    order: fs.readFileSync(path.join(mockDir, 'order-mock.xml'), 'utf8'),
    receipt: fs.readFileSync(path.join(mockDir, 'receipt-advice-mock.xml'), 'utf8'),
    despatch: fs.readFileSync(path.join(mockDir, 'despatch-advice-mock.xml'), 'utf8'),
    'order-cancel': fs.readFileSync(path.join(mockDir, 'order-cancellation-mock.xml'), 'utf8'),
    'order-change': fs.readFileSync(path.join(mockDir, 'order-change-mock.xml'), 'utf8'),
    'fulfilment-cancel': fs.readFileSync(path.join(mockDir, 'fulfilment-cancellation-mock.xml'), 'utf8')
  };

  beforeAll(async () => {
    const router = require('../validate-doc-routes');
    const started = await startServerWithRouter(router);
    server = started.server;
    baseUrl = started.baseUrl;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test.each(Object.keys(fixtures))('POST /%s returns 200 with valid=true for valid XML', async (documentType) => {
    const response = await fetch(`${baseUrl}/api/v1/validate-doc/${documentType}`, {
      method: 'POST',
      headers: {
        'Api-Key': 'issued-test-key',
        'Content-Type': 'application/xml'
      },
      body: fixtures[documentType]
    });

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.valid).toBe(true);
    expect(payload.errors).toEqual([]);
    expect(payload['executed-at']).toEqual(expect.any(Number));
  });

  test('POST /order returns valid=false for malformed XML', async () => {
    const response = await fetch(`${baseUrl}/api/v1/validate-doc/order`, {
      method: 'POST',
      headers: {
        'Api-Key': 'issued-test-key',
        'Content-Type': 'application/xml'
      },
      body: '<Order><broken></Order>'
    });

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.valid).toBe(false);
    expect(payload.errors).toEqual(['Invalid XML content - check your root XML elements are present and closed properly.']);
    expect(payload['executed-at']).toEqual(expect.any(Number));
  });

  test('POST with unsupported document type returns 400', async () => {
    const response = await fetch(`${baseUrl}/api/v1/validate-doc/not-real`, {
      method: 'POST',
      headers: {
        'Api-Key': 'issued-test-key',
        'Content-Type': 'application/xml'
      },
      body: fixtures.order
    });

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.errors[0]).toContain('is not a valid option');
    expect(payload['executed-at']).toEqual(expect.any(Number));
  });

  test('POST with missing XML body returns 400', async () => {
    const response = await fetch(`${baseUrl}/api/v1/validate-doc/order`, {
      method: 'POST',
      headers: {
        'Api-Key': 'issued-test-key',
        'Content-Type': 'application/xml'
      }
    });

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.errors).toEqual(['Missing required parameter: XML body must be provided.']);
    expect(payload['executed-at']).toEqual(expect.any(Number));
  });
});
