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

describe('v2 user routes read endpoints', () => {
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
    expect(payload.orders.length).toBe(1);
    expect(payload.despatch.length).toBe(1);
    expect(payload.invoices.length).toBe(0);
  });

  test('returns order detail for known UUID', async () => {
    const orderXml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Order xmlns="urn:oasis:names:specification:ubl:schema:xsd:Order-2">',
      '  <OrderLine>',
      '    <lineItem>',
      '      <id>LINE-001</id>',
      '      <quantity>100</quantity>',
      '      <item>',
      '        <name>Valorant Points</name>',
      '        <description>test</description>',
      '      </item>',
      '      <price>',
      '        <priceAmount>50</priceAmount>',
      '      </price>',
      '      <delivery>',
      '        <deliveryAddress>',
      '          <streetName>123 Test St</streetName>',
      '          <cityName>Sydney</cityName>',
      '          <postalZone>2000</postalZone>',
      '          <country>AU</country>',
      '        </deliveryAddress>',
      '      </delivery>',
      '    </lineItem>',
      '  </OrderLine>',
      '</Order>'
    ].join('\n');

    const seeded = seedDefaultData();
    seeded.orders[0].generatedOrderXml = orderXml;
    seeded.orders[0].orderLines = [
      {
        lineId: 'LINE-001',
        requestedQuantity: 0,
        itemName: 'Line Item 1',
        description: '',
        destinationOptions: []
      }
    ];
    seeded.despatch[0].lines = [
      {
        lineId: 'DSP-LINE-001',
        orderLineId: 'LINE-001',
        quantity: 40,
        destinationOptions: [
          {
            key: 'test-destination',
            label: '123 Test St, Sydney, 2000, AU'
          }
        ]
      }
    ];

    mockGetDb.mockReturnValue(createDbMock(seeded));

    const detailResponse = await fetch(baseUrl + '/api/v2/user/orders/34ec2376-a8c4-4a59-a307-e64f7aaf1150', {
      headers: { cookie: cookieHeader }
    });
    const detailPayload = await detailResponse.json();

    expect(detailResponse.status).toBe(200);
    expect(detailPayload.success).toBe(true);
    expect(detailPayload.order.uuid).toBe('34ec2376-a8c4-4a59-a307-e64f7aaf1150');
    expect(typeof detailPayload.order.xml).toBe('string');
    expect(detailPayload.order.orderLines).toHaveLength(1);
    expect(detailPayload.order.orderLines[0].lineId).toBe('LINE-001');
    expect(detailPayload.order.orderLines[0].requestedQuantity).toBe(100);
    expect(detailPayload.order.orderLines[0].itemName).toBe('Valorant Points');
    expect(detailPayload.order.orderLines[0].unitPrice).toBe(50);
    expect(detailPayload.order.orderLines[0].despatchedQuantity).toBe(40);
    expect(detailPayload.order.orderLines[0].pendingQuantity).toBe(60);
    expect(detailPayload.order.orderLines[0].destinationOptions).toHaveLength(1);
    expect(detailPayload.order.pendingDespatchLines).toHaveLength(1);
    expect(detailPayload.order.pendingDespatchLines[0].lineId).toBe('LINE-001');
    expect(detailPayload.order.pendingDespatchLines[0].quantityOrdered).toBe(100);
    expect(detailPayload.order.pendingDespatchLines[0].quantityPending).toBe(60);
    expect(detailPayload.order.pendingDespatchLines[0].quantityDespatched).toBe(40);
    expect(Array.isArray(detailPayload.order.despatchAdvice)).toBe(true);
    expect(detailPayload.order.despatchAdvice).toHaveLength(1);
    expect(detailPayload.order.despatchAdvice[0].displayId).toBe('DSP-2026-001');
  });

  test('deletes a known order UUID', async () => {
    const seeded = seedDefaultData();
    mockGetDb.mockReturnValue(createDbMock(seeded));

    const deleteResponse = await fetch(baseUrl + '/api/v2/user/orders/34ec2376-a8c4-4a59-a307-e64f7aaf1150', {
      method: 'DELETE',
      headers: { cookie: cookieHeader }
    });
    const deletePayload = await deleteResponse.json();

    expect(deleteResponse.status).toBe(200);
    expect(deletePayload.success).toBe(true);

    const detailResponse = await fetch(baseUrl + '/api/v2/user/orders/34ec2376-a8c4-4a59-a307-e64f7aaf1150', {
      headers: { cookie: cookieHeader }
    });

    const despatchResponse = await fetch(baseUrl + '/api/v2/user/despatch/6b17c76a-87cd-4bff-83dc-1257536b6f14', {
      headers: { cookie: cookieHeader }
    });

    expect(detailResponse.status).toBe(404);
    expect(despatchResponse.status).toBe(404);
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

  test('deletes a known despatch UUID and linked invoices', async () => {
    const seeded = seedDefaultData();
    seeded.invoices.push({
      _id: 'd0cdd6dc-0b82-4ae5-b8a3-7fc77d9fd4a4',
      userId: 'test-user',
      displayId: 'INV-2026-001',
      despatchUuid: '6b17c76a-87cd-4bff-83dc-1257536b6f14',
      issueDate: '2026-04-06',
      status: 'Issued',
      total: 100
    });
    mockGetDb.mockReturnValue(createDbMock(seeded));

    const deleteResponse = await fetch(baseUrl + '/api/v2/user/despatch/6b17c76a-87cd-4bff-83dc-1257536b6f14', {
      method: 'DELETE',
      headers: { cookie: cookieHeader }
    });
    const deletePayload = await deleteResponse.json();

    expect(deleteResponse.status).toBe(200);
    expect(deletePayload.success).toBe(true);

    const despatchResponse = await fetch(baseUrl + '/api/v2/user/despatch/6b17c76a-87cd-4bff-83dc-1257536b6f14', {
      headers: { cookie: cookieHeader }
    });
    expect(despatchResponse.status).toBe(404);

    const invoicesResponse = await fetch(baseUrl + '/api/v2/user/invoices', {
      headers: { cookie: cookieHeader }
    });
    const invoicesPayload = await invoicesResponse.json();

    expect(invoicesResponse.status).toBe(200);
    expect(invoicesPayload.invoices).toHaveLength(0);
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