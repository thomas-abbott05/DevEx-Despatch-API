const mockGetDb = jest.fn();

jest.mock('../../../database', () => ({
  getDb: () => mockGetDb()
}));

jest.mock('../../../despatch/advice/despatch-advice-service', () => ({
  createDespatchAdvice: jest.fn(),
  getDespatchAdviceByAdviceId: jest.fn()
}));

jest.mock('../../../validators/common/basic-xml-validator-service', () => ({
  isValidUuid: jest.fn((value) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value))
  )
}));

jest.mock('../../../validators/order/order-xml-validator-service', () => ({
  validateOrder: jest.fn().mockResolvedValue({ success: true, errors: [] })
}));

jest.mock('../../../validators/advice/despatch-advice-xml-validator', () => ({
  validateDespatchAdviceXml: jest.fn().mockResolvedValue({ success: true, errors: [] })
}));

jest.mock('../user/user-routes-utilities', () => {
  const actual = jest.requireActual('../user/user-routes-utilities');
  return {
    ...actual,
    postChalksnifferOrderForXmlResponse: jest.fn(),
    postLastMinutePushInvoiceForXmlResponse: jest.fn(),
    validateInvoiceXmlDocument: jest.fn().mockReturnValue({
      success: true,
      errors: [],
      summary: { displayId: 'INV-TEST-001' }
    })
  };
});

const { createDespatchAdvice, getDespatchAdviceByAdviceId } = require('../../../despatch/advice/despatch-advice-service');
const { validateOrder } = require('../../../validators/order/order-xml-validator-service');
const { validateDespatchAdviceXml } = require('../../../validators/advice/despatch-advice-xml-validator');
const {
  postChalksnifferOrderForXmlResponse,
  postLastMinutePushInvoiceForXmlResponse,
  validateInvoiceXmlDocument
} = require('../user/user-routes-utilities');
const { createDbMock, seedDefaultData, startServer } = require('../user/user-routes-test-helpers');

const VALID_ORDER_XML = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<Order xmlns="urn:oasis:names:specification:ubl:schema:xsd:Order-2">',
  '  <ID>ORD-TEST-001</ID>',
  '  <IssueDate>2026-04-06</IssueDate>',
  '  <BuyerCustomerParty><Party><PartyName><Name>Buyer Corp</Name></PartyName>',
  '    <PostalAddress><StreetName>1 Test St</StreetName><CityName>Sydney</CityName>',
  '    <PostalZone>2000</PostalZone><Country><IdentificationCode>AU</IdentificationCode></Country>',
  '    </PostalAddress></Party></BuyerCustomerParty>',
  '  <SellerSupplierParty><Party><PartyName><Name>Seller Inc</Name></PartyName>',
  '    <PostalAddress><StreetName>2 Sell St</StreetName><CityName>Melbourne</CityName>',
  '    <PostalZone>3000</PostalZone><Country><IdentificationCode>AU</IdentificationCode></Country>',
  '    </PostalAddress></Party></SellerSupplierParty>',
  '  <OrderLine><LineItem><ID>LINE-001</ID><Quantity>10</Quantity>',
  '    <Item><Name>Widget</Name></Item><Price><PriceAmount>50</PriceAmount></Price>',
  '  </LineItem></OrderLine>',
  '</Order>'
].join('\n');

const VALID_DESPATCH_XML = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<DespatchAdvice xmlns="urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2">',
  '  <ID>DSP-TEST-001</ID>',
  '  <IssueDate>2026-04-06</IssueDate>',
  '  <DespatchLine><ID>LINE-001</ID><DeliveredQuantity>5</DeliveredQuantity>',
  '    <OrderLineReference><LineID>LINE-001</LineID></OrderLineReference>',
  '  </DespatchLine>',
  '</DespatchAdvice>'
].join('\n');

const VALID_INVOICE_XML = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">',
  '  <ID>INV-TEST-001</ID>',
  '  <IssueDate>2026-04-06</IssueDate>',
  '  <LegalMonetaryTotal><PayableAmount>100</PayableAmount></LegalMonetaryTotal>',
  '</Invoice>'
].join('\n');

const VALID_ORDER_CREATE_BODY = {
  data: {
    ID: 'ORD-CREATE-001',
    IssueDate: '2026-04-06',
    BuyerCustomerParty: {
      Party: {
        PartyName: [{ Name: 'Buyer Corp' }],
        PostalAddress: {
          StreetName: '1 Test St',
          CityName: 'Sydney',
          PostalZone: '2000',
          Country: { IdentificationCode: 'AU' }
        }
      }
    },
    SellerSupplierParty: {
      Party: {
        PartyName: [{ Name: 'Seller Inc' }],
        PostalAddress: {
          StreetName: '2 Sell St',
          CityName: 'Melbourne',
          PostalZone: '3000',
          Country: { IdentificationCode: 'AU' }
        }
      }
    },
    OrderLine: [
      {
        LineItem: {
          ID: 'LINE-001',
          Quantity: 10,
          Item: { Name: 'Widget' },
          Price: { PriceAmount: 50 },
          Delivery: {
            DeliveryAddress: {
              StreetName: '1 Test St',
              CityName: 'Sydney',
              PostalZone: '2000',
              Country: { IdentificationCode: 'AU' }
            }
          }
        }
      }
    ]
  },
  sellerPartyId: 'seller-001'
};

describe('v2 user routes mutation endpoints', () => {
  let server;
  let baseUrl;
  let cookieHeader;

  beforeAll(async () => {
    process.env.CHALKSNIFFER_API_TOKEN = 'test-chalksniffer-token';
    process.env.LASTMINUTEPUSH_API_TOKEN = 'test-lastminutepush-token';

    const started = await startServer();
    server = started.server;
    baseUrl = started.baseUrl;

    const loginResponse = await fetch(baseUrl + '/test-login', { method: 'POST' });
    cookieHeader = loginResponse.headers.get('set-cookie');
  });

  afterAll(async () => {
    delete process.env.CHALKSNIFFER_API_TOKEN;
    delete process.env.LASTMINUTEPUSH_API_TOKEN;
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    mockGetDb.mockReturnValue(createDbMock(seedDefaultData()));
    jest.clearAllMocks();

    validateOrder.mockResolvedValue({ success: true, errors: [] });
    validateDespatchAdviceXml.mockResolvedValue({ success: true, errors: [] });
    validateInvoiceXmlDocument.mockReturnValue({ success: true, errors: [], summary: { displayId: 'INV-TEST-001' } });
  });

  // ─── POST /order/upload ──────────────────────────────────────────────────────

  describe('POST /order/upload', () => {
    test('returns 400 when body has no documents', async () => {
      const response = await fetch(baseUrl + '/api/v2/user/order/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({})
      });
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.success).toBe(false);
    });

    test('returns 400 when document has no xml content', async () => {
      const response = await fetch(baseUrl + '/api/v2/user/order/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({
          documents: [{ fileName: 'empty.xml', xml: '' }]
        })
      });
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.success).toBe(false);
      expect(Array.isArray(payload.errors)).toBe(true);
      expect(payload.errors.length).toBeGreaterThan(0);
    });

    test('returns 201 with created order for valid XML upload', async () => {
      const response = await fetch(baseUrl + '/api/v2/user/order/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({
          documents: [{ fileName: 'order.xml', xml: VALID_ORDER_XML }]
        })
      });
      const payload = await response.json();

      expect(response.status).toBe(201);
      expect(payload.success).toBe(true);
      expect(Array.isArray(payload.orders)).toBe(true);
      expect(payload.orders.length).toBe(1);
      expect(payload.uploadedCount).toBe(1);
      expect(payload.failedCount).toBe(0);
    });

    test('returns 207 for mixed valid/invalid XML', async () => {
      validateOrder
        .mockResolvedValueOnce({ success: true, errors: [] })
        .mockResolvedValueOnce({ success: false, errors: ['Invalid order schema'] });

      const response = await fetch(baseUrl + '/api/v2/user/order/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({
          documents: [
            { fileName: 'good.xml', xml: VALID_ORDER_XML },
            { fileName: 'bad.xml', xml: VALID_ORDER_XML }
          ]
        })
      });
      const payload = await response.json();

      expect(response.status).toBe(207);
      expect(payload.success).toBe(true);
      expect(payload.uploadedCount).toBe(1);
      expect(payload.failedCount).toBe(1);
    });

    test('returns 500 when getDb throws', async () => {
      mockGetDb.mockImplementation(() => {
        throw new Error('DB connection failed');
      });

      const response = await fetch(baseUrl + '/api/v2/user/order/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({
          documents: [{ fileName: 'order.xml', xml: VALID_ORDER_XML }]
        })
      });
      const payload = await response.json();

      expect(response.status).toBe(500);
      expect(payload.success).toBe(false);
    });
  });

  // ─── DELETE /orders/:uuid ────────────────────────────────────────────────────

  describe('DELETE /orders/:uuid', () => {
    test('returns 200 and deletes order with related despatch', async () => {
      const response = await fetch(
        baseUrl + '/api/v2/user/orders/34ec2376-a8c4-4a59-a307-e64f7aaf1150',
        {
          method: 'DELETE',
          headers: { cookie: cookieHeader }
        }
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
    });

    test('returns 404 for unknown order UUID', async () => {
      const response = await fetch(
        baseUrl + '/api/v2/user/orders/00000000-0000-0000-0000-000000000000',
        {
          method: 'DELETE',
          headers: { cookie: cookieHeader }
        }
      );
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(payload.success).toBe(false);
    });

    test('returns 500 on DB error', async () => {
      mockGetDb.mockImplementation(() => {
        throw new Error('DB failure');
      });

      const response = await fetch(
        baseUrl + '/api/v2/user/orders/34ec2376-a8c4-4a59-a307-e64f7aaf1150',
        {
          method: 'DELETE',
          headers: { cookie: cookieHeader }
        }
      );
      const payload = await response.json();

      expect(response.status).toBe(500);
      expect(payload.success).toBe(false);
    });
  });

  // ─── GET /despatch ───────────────────────────────────────────────────────────

  describe('GET /despatch', () => {
    test('returns 200 list of despatch', async () => {
      const response = await fetch(baseUrl + '/api/v2/user/despatch', {
        headers: { cookie: cookieHeader }
      });
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(Array.isArray(payload.despatch)).toBe(true);
      expect(payload.despatch.length).toBe(1);
    });
  });

  // ─── GET /despatch/:uuid ─────────────────────────────────────────────────────

  describe('GET /despatch/:uuid', () => {
    test('returns 200 for known despatch UUID', async () => {
      const response = await fetch(
        baseUrl + '/api/v2/user/despatch/6b17c76a-87cd-4bff-83dc-1257536b6f14',
        { headers: { cookie: cookieHeader } }
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.despatch).toBeDefined();
      expect(payload.despatch.uuid).toBe('6b17c76a-87cd-4bff-83dc-1257536b6f14');
    });

    test('returns 404 for unknown despatch UUID', async () => {
      const response = await fetch(
        baseUrl + '/api/v2/user/despatch/00000000-0000-0000-0000-000000000000',
        { headers: { cookie: cookieHeader } }
      );
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(payload.success).toBe(false);
    });
  });

  // ─── DELETE /despatch/:uuid ──────────────────────────────────────────────────

  describe('DELETE /despatch/:uuid', () => {
    test('returns 200 on successful despatch delete', async () => {
      const response = await fetch(
        baseUrl + '/api/v2/user/despatch/6b17c76a-87cd-4bff-83dc-1257536b6f14',
        {
          method: 'DELETE',
          headers: { cookie: cookieHeader }
        }
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
    });

    test('returns 404 if despatch not found', async () => {
      const response = await fetch(
        baseUrl + '/api/v2/user/despatch/00000000-0000-0000-0000-000000000000',
        {
          method: 'DELETE',
          headers: { cookie: cookieHeader }
        }
      );
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(payload.success).toBe(false);
    });
  });

  // ─── POST /despatch/:uuid/status ─────────────────────────────────────────────

  describe('POST /despatch/:uuid/status', () => {
    test('returns 200 with updated status', async () => {
      const response = await fetch(
        baseUrl + '/api/v2/user/despatch/6b17c76a-87cd-4bff-83dc-1257536b6f14/status',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
          body: JSON.stringify({ status: 'Received' })
        }
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.despatch.status).toBe('Received');
    });

    test('returns 400 for invalid status value', async () => {
      const response = await fetch(
        baseUrl + '/api/v2/user/despatch/6b17c76a-87cd-4bff-83dc-1257536b6f14/status',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
          body: JSON.stringify({ status: 'Invalid' })
        }
      );
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.success).toBe(false);
      expect(Array.isArray(payload.errors)).toBe(true);
    });

    test('returns 404 if despatch not found', async () => {
      const response = await fetch(
        baseUrl + '/api/v2/user/despatch/00000000-0000-0000-0000-000000000000/status',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
          body: JSON.stringify({ status: 'Received' })
        }
      );
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(payload.success).toBe(false);
    });
  });

  // ─── POST /despatch/create ───────────────────────────────────────────────────

  describe('POST /despatch/create', () => {
    const validDespatchCreateBody = {
      orderUuid: '34ec2376-a8c4-4a59-a307-e64f7aaf1150',
      lineSelections: [
        {
          lineId: 'LINE-001',
          fulfilmentQuantity: 5,
          destinationAddress: {
            streetName: '1 Test St',
            cityName: 'Sydney',
            postalZone: '2000',
            countryCode: 'AU'
          }
        }
      ]
    };

    test('returns 400 for validation errors', async () => {
      const response = await fetch(baseUrl + '/api/v2/user/despatch/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({
          orderUuid: 'not-a-uuid',
          lineSelections: []
        })
      });
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.success).toBe(false);
    });

    test('returns 404 when order not found', async () => {
      const response = await fetch(baseUrl + '/api/v2/user/despatch/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({
          orderUuid: '00000000-0000-0000-0000-000000000000',
          lineSelections: [{ lineId: 'LINE-001', fulfilmentQuantity: 5 }]
        })
      });
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(payload.success).toBe(false);
    });

    test('returns 400 when order has no XML', async () => {
      const seeded = seedDefaultData();
      seeded.orders[0].generatedOrderXml = '';
      seeded.orders[0].xml = '';
      mockGetDb.mockReturnValue(createDbMock(seeded));

      const response = await fetch(baseUrl + '/api/v2/user/despatch/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify(validDespatchCreateBody)
      });
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.success).toBe(false);
      expect(payload.errors[0]).toMatch(/xml/i);
    });

    test('returns 201 on successful despatch create', async () => {
      const seeded = seedDefaultData();
      seeded.orders[0].generatedOrderXml = VALID_ORDER_XML;
      mockGetDb.mockReturnValue(createDbMock(seeded));

      createDespatchAdvice.mockResolvedValue({
        adviceIds: ['aabbccdd-0000-0000-0000-000000000001']
      });
      getDespatchAdviceByAdviceId.mockResolvedValue({
        _id: 'aabbccdd-0000-0000-0000-000000000001',
        despatchXml: VALID_DESPATCH_XML,
        originalOrderId: 'ORD-2026-001'
      });

      const response = await fetch(baseUrl + '/api/v2/user/despatch/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify(validDespatchCreateBody)
      });
      const payload = await response.json();

      expect(response.status).toBe(201);
      expect(payload.success).toBe(true);
      expect(Array.isArray(payload.despatch)).toBe(true);
      expect(payload.despatch.length).toBe(1);
    });

    test('returns 500 when createDespatchAdvice throws', async () => {
      const seeded = seedDefaultData();
      seeded.orders[0].generatedOrderXml = VALID_ORDER_XML;
      mockGetDb.mockReturnValue(createDbMock(seeded));

      createDespatchAdvice.mockRejectedValue(new Error('Despatch service unavailable'));

      const response = await fetch(baseUrl + '/api/v2/user/despatch/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify(validDespatchCreateBody)
      });
      const payload = await response.json();

      expect(response.status).toBe(500);
      expect(payload.success).toBe(false);
    });
  });

  // ─── GET /invoices ───────────────────────────────────────────────────────────

  describe('GET /invoices', () => {
    test('returns 200 list of invoices', async () => {
      const seeded = seedDefaultData();
      seeded.invoices.push({
        _id: 'f1234567-0000-0000-0000-000000000001',
        userId: 'test-user',
        displayId: 'INV-2026-001',
        despatchUuid: '6b17c76a-87cd-4bff-83dc-1257536b6f14',
        buyer: 'Acme Corp',
        issueDate: '2026-04-06',
        dueDate: '2026-04-13',
        status: 'Issued',
        statusManuallySet: false,
        total: 500,
        updatedAt: new Date('2026-04-06T10:00:00.000Z')
      });
      mockGetDb.mockReturnValue(createDbMock(seeded));

      const response = await fetch(baseUrl + '/api/v2/user/invoices', {
        headers: { cookie: cookieHeader }
      });
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(Array.isArray(payload.invoices)).toBe(true);
      expect(payload.invoices.length).toBe(1);
    });
  });

  // ─── GET /invoices/:uuid ─────────────────────────────────────────────────────

  describe('GET /invoices/:uuid', () => {
    test('returns 200 for known invoice UUID', async () => {
      const seeded = seedDefaultData();
      seeded.invoices.push({
        _id: 'f1234567-0000-0000-0000-000000000001',
        userId: 'test-user',
        displayId: 'INV-2026-001',
        despatchUuid: '6b17c76a-87cd-4bff-83dc-1257536b6f14',
        buyer: 'Acme Corp',
        issueDate: '2026-04-06',
        dueDate: '2026-04-13',
        status: 'Issued',
        statusManuallySet: false,
        total: 500,
        updatedAt: new Date('2026-04-06T10:00:00.000Z')
      });
      mockGetDb.mockReturnValue(createDbMock(seeded));

      const response = await fetch(
        baseUrl + '/api/v2/user/invoices/f1234567-0000-0000-0000-000000000001',
        { headers: { cookie: cookieHeader } }
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.invoice).toBeDefined();
      expect(payload.invoice.uuid).toBe('f1234567-0000-0000-0000-000000000001');
    });

    test('returns 404 for unknown invoice UUID', async () => {
      const response = await fetch(
        baseUrl + '/api/v2/user/invoices/00000000-0000-0000-0000-000000000000',
        { headers: { cookie: cookieHeader } }
      );
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(payload.success).toBe(false);
    });
  });

  // ─── DELETE /invoices/:uuid ──────────────────────────────────────────────────

  describe('DELETE /invoices/:uuid', () => {
    test('returns 200 on successful invoice delete', async () => {
      const seeded = seedDefaultData();
      seeded.invoices.push({
        _id: 'f1234567-0000-0000-0000-000000000001',
        userId: 'test-user',
        displayId: 'INV-2026-001',
        despatchUuid: '6b17c76a-87cd-4bff-83dc-1257536b6f14',
        issueDate: '2026-04-06',
        status: 'Issued',
        total: 500,
        updatedAt: new Date()
      });
      mockGetDb.mockReturnValue(createDbMock(seeded));

      const response = await fetch(
        baseUrl + '/api/v2/user/invoices/f1234567-0000-0000-0000-000000000001',
        {
          method: 'DELETE',
          headers: { cookie: cookieHeader }
        }
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
    });

    test('returns 404 if invoice not found', async () => {
      const response = await fetch(
        baseUrl + '/api/v2/user/invoices/00000000-0000-0000-0000-000000000000',
        {
          method: 'DELETE',
          headers: { cookie: cookieHeader }
        }
      );
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(payload.success).toBe(false);
    });
  });

  // ─── POST /invoices/:uuid/status ─────────────────────────────────────────────

  describe('POST /invoices/:uuid/status', () => {
    beforeEach(() => {
      const seeded = seedDefaultData();
      seeded.invoices.push({
        _id: 'f1234567-0000-0000-0000-000000000001',
        userId: 'test-user',
        displayId: 'INV-2026-001',
        despatchUuid: '6b17c76a-87cd-4bff-83dc-1257536b6f14',
        issueDate: '2026-04-06',
        dueDate: '2026-04-13',
        status: 'Issued',
        statusManuallySet: false,
        total: 500,
        updatedAt: new Date()
      });
      mockGetDb.mockReturnValue(createDbMock(seeded));
    });

    test('returns 200 with updated status', async () => {
      const response = await fetch(
        baseUrl + '/api/v2/user/invoices/f1234567-0000-0000-0000-000000000001/status',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
          body: JSON.stringify({ status: 'Paid' })
        }
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.invoice.status).toBe('Paid');
    });

    test('returns 400 for invalid status value', async () => {
      const response = await fetch(
        baseUrl + '/api/v2/user/invoices/f1234567-0000-0000-0000-000000000001/status',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
          body: JSON.stringify({ status: 'Draft' })
        }
      );
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.success).toBe(false);
    });

    test('returns 404 if invoice not found', async () => {
      const response = await fetch(
        baseUrl + '/api/v2/user/invoices/00000000-0000-0000-0000-000000000000/status',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
          body: JSON.stringify({ status: 'Paid' })
        }
      );
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(payload.success).toBe(false);
    });
  });

  // ─── POST /invoice/create ────────────────────────────────────────────────────

  describe('POST /invoice/create', () => {
    const validInvoiceCreateBody = {
      invoiceSourceType: 'despatch',
      baseDespatchUuid: '6b17c76a-87cd-4bff-83dc-1257536b6f14',
      invoiceSourceDespatchUuid: '6b17c76a-87cd-4bff-83dc-1257536b6f14',
      issueDate: '2026-04-06',
      dueDate: '2026-04-13',
      currency: 'AUD',
      gstPercent: 10,
      defaultUnitPrice: 50
    };

    beforeEach(() => {
      postLastMinutePushInvoiceForXmlResponse.mockResolvedValue({
        invoice: {
          invoice_id: 'ext-001',
          status: 'issued',
          issue_date: '2026-04-06',
          due_date: '2026-04-13',
          payable_amount: 100
        },
        invoiceXml:
          '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"><ID>INV-001</ID></Invoice>'
      });
    });

    test('returns 500 when LASTMINUTEPUSH_API_TOKEN is missing', async () => {
      delete process.env.LASTMINUTEPUSH_API_TOKEN;

      const response = await fetch(baseUrl + '/api/v2/user/invoice/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify(validInvoiceCreateBody)
      });
      const payload = await response.json();

      process.env.LASTMINUTEPUSH_API_TOKEN = 'test-lastminutepush-token';

      expect(response.status).toBe(500);
      expect(payload.success).toBe(false);
      expect(payload.errors[0]).toMatch(/LASTMINUTEPUSH_API_TOKEN/i);
    });

    test('returns 400 for validation errors', async () => {
      const response = await fetch(baseUrl + '/api/v2/user/invoice/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({
          invoiceSourceType: 'despatch',
          baseDespatchUuid: 'not-a-uuid'
        })
      });
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.success).toBe(false);
    });

    test('returns 404 when despatch not found', async () => {
      const response = await fetch(baseUrl + '/api/v2/user/invoice/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({
          invoiceSourceType: 'despatch',
          baseDespatchUuid: '00000000-0000-0000-0000-000000000001',
          invoiceSourceDespatchUuid: '00000000-0000-0000-0000-000000000001',
          issueDate: '2026-04-06',
          dueDate: '2026-04-13',
          currency: 'AUD',
          gstPercent: 10,
          defaultUnitPrice: 50
        })
      });
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(payload.success).toBe(false);
    });

    test('returns 201 on success with mocked invoice response', async () => {
      const seeded = seedDefaultData();
      seeded.despatch[0].lines = [
        {
          lineId: 'LINE-001',
          orderLineId: 'LINE-001',
          quantity: 5,
          destinationOptions: []
        }
      ];
      mockGetDb.mockReturnValue(createDbMock(seeded));

      const response = await fetch(baseUrl + '/api/v2/user/invoice/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify(validInvoiceCreateBody)
      });
      const payload = await response.json();

      expect(response.status).toBe(201);
      expect(payload.success).toBe(true);
      expect(payload.invoice).toBeDefined();
    });
  });

  // ─── POST /order/create ──────────────────────────────────────────────────────

  describe('POST /order/create', () => {
    beforeEach(() => {
      postChalksnifferOrderForXmlResponse.mockResolvedValue(VALID_ORDER_XML);
    });

    test('returns 500 when CHALKSNIFFER_API_TOKEN is missing', async () => {
      delete process.env.CHALKSNIFFER_API_TOKEN;

      const response = await fetch(baseUrl + '/api/v2/user/order/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify(VALID_ORDER_CREATE_BODY)
      });
      const payload = await response.json();

      process.env.CHALKSNIFFER_API_TOKEN = 'test-chalksniffer-token';

      expect(response.status).toBe(500);
      expect(payload.success).toBe(false);
      expect(payload.errors[0]).toMatch(/CHALKSNIFFER_API_TOKEN/i);
    });

    test('returns 400 for validation errors', async () => {
      const response = await fetch(baseUrl + '/api/v2/user/order/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({
          data: { ID: '', IssueDate: 'bad', BuyerCustomerParty: {}, SellerSupplierParty: {}, OrderLine: [] },
          sellerPartyId: 123
        })
      });
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.success).toBe(false);
    });

    test('returns 401 when Chalksniffer returns 401', async () => {
      postChalksnifferOrderForXmlResponse.mockRejectedValue(
        new Error('Request failed with status 401 Unauthorized')
      );

      const response = await fetch(baseUrl + '/api/v2/user/order/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify(VALID_ORDER_CREATE_BODY)
      });
      const payload = await response.json();

      expect(response.status).toBe(401);
      expect(payload.success).toBe(false);
    });

    test('returns 201 on success', async () => {
      const response = await fetch(baseUrl + '/api/v2/user/order/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify(VALID_ORDER_CREATE_BODY)
      });
      const payload = await response.json();

      expect(response.status).toBe(201);
      expect(payload.success).toBe(true);
      expect(payload.order).toBeDefined();
    });
  });

  // ─── POST /despatch/upload ───────────────────────────────────────────────────

  describe('POST /despatch/upload', () => {
    test('returns 400 when body has no documents', async () => {
      const response = await fetch(baseUrl + '/api/v2/user/despatch/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({})
      });
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.success).toBe(false);
    });

    test('returns 201 for valid despatch XML upload', async () => {
      const seeded = seedDefaultData();
      const dbMock = createDbMock(seeded);
      const originalCollection = dbMock.collection.bind(dbMock);
      dbMock.collection = jest.fn((name) => {
        const col = originalCollection(name);
        if (name === 'user-despatch-advice' && !col.insertOne) {
          col.insertOne = jest.fn().mockResolvedValue({ insertedId: 'new-id' });
        }
        return col;
      });
      mockGetDb.mockReturnValue(dbMock);

      const response = await fetch(baseUrl + '/api/v2/user/despatch/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({
          documents: [{ fileName: 'despatch.xml', xml: VALID_DESPATCH_XML }]
        })
      });
      const payload = await response.json();

      expect(response.status).toBe(201);
      expect(payload.success).toBe(true);
      expect(Array.isArray(payload.despatch)).toBe(true);
      expect(payload.despatch.length).toBe(1);
      expect(payload.uploadedCount).toBe(1);
    });

    test('returns 400 when validator fails', async () => {
      validateDespatchAdviceXml.mockResolvedValue({
        success: false,
        errors: ['Invalid DespatchAdvice document']
      });

      const response = await fetch(baseUrl + '/api/v2/user/despatch/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({
          documents: [{ fileName: 'bad.xml', xml: VALID_DESPATCH_XML }]
        })
      });
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.success).toBe(false);
    });
  });

  // ─── POST /invoice/upload ────────────────────────────────────────────────────

  describe('POST /invoice/upload', () => {
    test('returns 400 when body has no documents', async () => {
      const response = await fetch(baseUrl + '/api/v2/user/invoice/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({})
      });
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.success).toBe(false);
    });

    test('returns 201 for valid invoice XML upload', async () => {
      const response = await fetch(baseUrl + '/api/v2/user/invoice/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({
          documents: [{ fileName: 'invoice.xml', xml: VALID_INVOICE_XML }]
        })
      });
      const payload = await response.json();

      expect(response.status).toBe(201);
      expect(payload.success).toBe(true);
      expect(Array.isArray(payload.invoices)).toBe(true);
      expect(payload.invoices.length).toBe(1);
      expect(payload.uploadedCount).toBe(1);
    });

    test('returns 400 when invoice validation fails', async () => {
      validateInvoiceXmlDocument.mockReturnValue({
        success: false,
        errors: ['Missing invoice ID'],
        summary: null
      });

      const response = await fetch(baseUrl + '/api/v2/user/invoice/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({
          documents: [{ fileName: 'invalid.xml', xml: VALID_INVOICE_XML }]
        })
      });
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.success).toBe(false);
    });
  });
});
