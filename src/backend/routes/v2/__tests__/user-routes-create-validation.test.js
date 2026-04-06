const mockGetDb = jest.fn();

jest.mock('../../../database', () => ({
  getDb: () => mockGetDb()
}));

jest.mock('../../../despatch/advice/despatch-advice-service', () => ({
  createDespatchAdvice: jest.fn(),
  getDespatchAdviceByAdviceId: jest.fn()
}));

jest.mock('../../../validators/common/basic-xml-validator-service', () => ({
  isValidUuid: jest.fn((value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value)))
}));

const { createDbMock, seedDefaultData, startServer } = require('../user/user-routes-test-helpers');

describe('v2 user routes create endpoint validation', () => {
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

  beforeEach(() => {
    mockGetDb.mockReturnValue(createDbMock(seedDefaultData()));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('returns 400 for invalid order create payload', async () => {
    const response = await fetch(baseUrl + '/api/v2/user/order/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader
      },
      body: JSON.stringify({
        data: {
          ID: '',
          IssueDate: 'invalid-date',
          BuyerCustomerParty: {},
          SellerSupplierParty: {},
          OrderLine: []
        },
        sellerPartyId: 123
      })
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(Array.isArray(payload.errors)).toBe(true);
    expect(payload.errors.length).toBeGreaterThan(0);
  });

  test('returns 400 for invalid despatch create payload', async () => {
    const response = await fetch(baseUrl + '/api/v2/user/despatch/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader
      },
      body: JSON.stringify({
        orderUuid: 'not-a-uuid',
        lineSelections: []
      })
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(Array.isArray(payload.errors)).toBe(true);
    expect(payload.errors.length).toBeGreaterThan(0);
  });

  test('returns 400 for invalid invoice create payload', async () => {
    const response = await fetch(baseUrl + '/api/v2/user/invoice/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader
      },
      body: JSON.stringify({
        baseDespatchUuid: 'not-a-uuid',
        invoiceSourceType: 'unsupported',
        issueDate: 'bad-date',
        dueDate: 'worse-date',
        manualLines: [],
        defaultUnitPrice: -1,
        gstPercent: -10
      })
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(Array.isArray(payload.errors)).toBe(true);
    expect(payload.errors.length).toBeGreaterThan(0);
  });

  test('returns 400 for invalid invoice status update payload', async () => {
    const seeded = seedDefaultData();
    seeded.invoices.push({
      _id: 'a5afefbf-9696-4272-82d4-3a6de85f0c5a',
      userId: 'test-user',
      displayId: 'INV-2026-001',
      despatchUuid: '6b17c76a-87cd-4bff-83dc-1257536b6f14',
      despatchDisplayId: 'DSP-2026-001',
      issueDate: '2026-04-06',
      dueDate: '2026-04-13',
      status: 'Issued',
      statusManuallySet: false,
      total: 100
    });
    mockGetDb.mockReturnValue(createDbMock(seeded));

    const response = await fetch(baseUrl + '/api/v2/user/invoices/a5afefbf-9696-4272-82d4-3a6de85f0c5a/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader
      },
      body: JSON.stringify({ status: 'Draft' })
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(Array.isArray(payload.errors)).toBe(true);
    expect(payload.errors[0]).toMatch(/status/i);
  });

  test('returns 400 for invalid despatch status update payload', async () => {
    const response = await fetch(baseUrl + '/api/v2/user/despatch/6b17c76a-87cd-4bff-83dc-1257536b6f14/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader
      },
      body: JSON.stringify({ status: 'Pending' })
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(Array.isArray(payload.errors)).toBe(true);
    expect(payload.errors[0]).toMatch(/status/i);
  });
});