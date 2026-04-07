const mockApp = {
  set: jest.fn(),
  use: jest.fn(),
  get: jest.fn()
};

const mockExpress = Object.assign(jest.fn(() => mockApp), {
  json: jest.fn(() => 'json-middleware'),
  static: jest.fn((path) => `static:${path}`)
});

jest.mock('express', () => mockExpress);

jest.mock('fs', () => ({
  existsSync: jest.fn()
}));

jest.mock('swagger-ui-express', () => ({
  serve: jest.fn(() => 'swagger-serve-middleware'),
  setup: jest.fn(() => 'swagger-setup-middleware')
}));

const fs = require('fs');
const swaggerUi = require('swagger-ui-express');
const { createExpressApp, setupErrorHandling, getServerConstants } = require('../server-config');

function createMockResponse() {
  return {
    set: jest.fn().mockReturnThis(),
    type: jest.fn().mockReturnThis(),
    send: jest.fn(),
    sendFile: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    end: jest.fn()
  };
}

describe('server-config', () => {
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('creates the app with runtime config, favicon, and frontend routes', () => {
    const app = createExpressApp();

    expect(app.set).toHaveBeenCalledWith('trust proxy', 1);
    expect(swaggerUi.setup).toHaveBeenCalled();

    const runtimeRoute = app.get.mock.calls.find(([path]) => path === '/runtime-config.js')[1];
    const faviconRoute = app.get.mock.calls.find(([path]) => path === '/favicon.ico')[1];
    const frontendRoute = app.get.mock.calls.find(([path]) => path instanceof RegExp)[1];
    const requestLogger = app.use.mock.calls.find(([handler]) => typeof handler === 'function')[0];

    const next = jest.fn();
    requestLogger({ method: 'GET', url: '/api/health', ip: '127.0.0.1' }, {}, next);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('GET /api/health - 127.0.0.1'));
    expect(next).toHaveBeenCalledTimes(1);

    process.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY = 'site-key-123';
    const runtimeResponse = createMockResponse();
    runtimeRoute({}, runtimeResponse);

    expect(runtimeResponse.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(runtimeResponse.type).toHaveBeenCalledWith('application/javascript');
    expect(runtimeResponse.send).toHaveBeenCalledWith(
      expect.stringContaining('"turnstileSiteKey":"site-key-123"')
    );

    fs.existsSync.mockReturnValue(true);
    const faviconResponse = createMockResponse();
    faviconRoute({}, faviconResponse);
    expect(faviconResponse.type).toHaveBeenCalledWith('image/x-icon');
    expect(faviconResponse.sendFile).toHaveBeenCalledWith(expect.stringContaining('favicon.ico'));

    const frontendResponse = createMockResponse();
    frontendRoute({}, frontendResponse);
    expect(frontendResponse.sendFile).toHaveBeenCalledWith(expect.stringContaining('dist'));
  });

  test('serves a 503 when the frontend build is missing and 404 when favicon files are absent', () => {
    const app = createExpressApp();
    const faviconRoute = app.get.mock.calls.find(([path]) => path === '/favicon.ico')[1];
    const frontendRoute = app.get.mock.calls.find(([path]) => path instanceof RegExp)[1];

    fs.existsSync.mockReturnValue(false);

    const faviconResponse = createMockResponse();
    faviconRoute({}, faviconResponse);
    expect(faviconResponse.status).toHaveBeenCalledWith(404);
    expect(faviconResponse.end).toHaveBeenCalledTimes(1);

    const frontendResponse = createMockResponse();
    frontendRoute({}, frontendResponse);
    expect(frontendResponse.status).toHaveBeenCalledWith(503);
    expect(frontendResponse.send).toHaveBeenCalledWith(
      'Frontend build not found. Run "npm run build" for production or "npm run dev" for development.'
    );
  });

  test('setupErrorHandling wires the not-found and error handlers', () => {
    const app = { use: jest.fn() };

    setupErrorHandling(app);

    const notFoundHandler = app.use.mock.calls[0][0];
    const errorHandler = app.use.mock.calls[1][0];
    const notFoundResponse = createMockResponse();
    const errorResponse = createMockResponse();

    notFoundHandler({ method: 'GET', path: '/missing' }, notFoundResponse);
    expect(notFoundResponse.status).toHaveBeenCalledWith(404);
    expect(notFoundResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: [
          expect.stringContaining('Route GET /missing not found - see API documentation at https://devex.cloud.tcore.network/api-docs.')
        ]
      })
    );

    errorHandler(new Error('boom'), {}, errorResponse, jest.fn());
    expect(errorResponse.status).toHaveBeenCalledWith(500);
    expect(errorResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: ['An internal server error occurred. Please try again later.'],
        'executed-at': expect.any(Number)
      })
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR] Error: boom'));
  });

  test('getServerConstants returns stable server metadata', () => {
    const constants = getServerConstants();

    expect(constants).toEqual(
      expect.objectContaining({
        API_VERSION: 'v1',
        HEALTHY: true
      })
    );
    expect(constants.STARTED_AT).toBeInstanceOf(Date);
  });
});