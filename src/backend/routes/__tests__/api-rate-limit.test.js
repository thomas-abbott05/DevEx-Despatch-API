const express = require('express');

function startServerWithRouter(router) {
  const app = express();
  app.use('/api/v1', router);

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

describe('API rate limiting', () => {
  let server;
  let baseUrl;
  let router;

  beforeAll(async () => {
    jest.resetModules();
    router = require('../index');

    const started = await startServerWithRouter(router);
    server = started.server;
    baseUrl = started.baseUrl;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('health remains available while API routes are rate limited', async () => {
    const healthResponse = await fetch(`${baseUrl}/api/v1/health`);
    const healthPayload = await healthResponse.json();

    expect(healthResponse.status).toBe(200);
    expect(healthPayload.status).toBe('healthy');

    let limitedResponse;

    for (let attempt = 0; attempt <= 100; attempt += 1) {
      limitedResponse = await fetch(`${baseUrl}/api/v1/api-key/list`);
    }

    const limitedPayload = await limitedResponse.json();

    expect(limitedResponse.status).toBe(429);
    expect(limitedPayload.errors).toEqual([
      'Too many requests. Please try again later.'
    ]);
    expect(limitedPayload['executed-at']).toEqual(expect.any(Number));
  });
});