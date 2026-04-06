const express = require('express');
const session = require('express-session');
const v2Router = require('../index');

function startServer() {
  const app = express();
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false
  }));

  app.post('/test-login', (req, res) => {
    req.session.userId = 'test-user';
    res.status(204).send();
  });

  app.use('/api/v2', v2Router);

  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({
        server,
        baseUrl: 'http://127.0.0.1:' + port
      });
    });
  });
}

describe('v2 user routes', () => {
  let server;
  let baseUrl;
  let cookieHeader;

  beforeAll(async () => {
    const started = await startServer();
    server = started.server;
    baseUrl = started.baseUrl;

    const loginResponse = await fetch(baseUrl + '/test-login', {
      method: 'POST'
    });

    cookieHeader = loginResponse.headers.get('set-cookie');
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('blocks unauthenticated requests', async () => {
    const response = await fetch(baseUrl + '/api/v2/user/orders');
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.errors[0]).toMatch(/not authenticated/i);
  });

  test('returns combined home summary payload', async () => {
    const response = await fetch(baseUrl + '/api/v2/user/home-summary', {
      headers: { cookie: cookieHeader }
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(Array.isArray(payload.orders)).toBe(true);
    expect(Array.isArray(payload.despatch)).toBe(true);
    expect(Array.isArray(payload.invoices)).toBe(true);
    expect(payload.orders.length).toBeGreaterThan(3);
    expect(payload.invoices.length).toBe(0);
  });

  test('returns order detail for known UUID', async () => {
    const listResponse = await fetch(baseUrl + '/api/v2/user/orders', {
      headers: { cookie: cookieHeader }
    });
    const listPayload = await listResponse.json();
    const knownUuid = listPayload.orders[0].uuid;

    const detailResponse = await fetch(baseUrl + '/api/v2/user/orders/' + knownUuid, {
      headers: { cookie: cookieHeader }
    });
    const detailPayload = await detailResponse.json();

    expect(detailResponse.status).toBe(200);
    expect(detailPayload.success).toBe(true);
    expect(detailPayload.order.uuid).toBe(knownUuid);
    expect(typeof detailPayload.order.xml).toBe('string');
  });

  test('returns 404 for missing despatch UUID', async () => {
    const response = await fetch(baseUrl + '/api/v2/user/despatch/missing-uuid', {
      headers: { cookie: cookieHeader }
    });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.success).toBe(false);
    expect(payload.errors[0]).toMatch(/despatch/i);
  });

  test('returns empty invoice list payload', async () => {
    const response = await fetch(baseUrl + '/api/v2/user/invoices', {
      headers: { cookie: cookieHeader }
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(Array.isArray(payload.invoices)).toBe(true);
    expect(payload.invoices.length).toBe(0);
  });
});
