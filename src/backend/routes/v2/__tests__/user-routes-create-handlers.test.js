const mockGetDb = jest.fn();
const mockCreateDespatchAdvice = jest.fn();
const mockGetDespatchAdviceByAdviceId = jest.fn();

jest.mock('../../../database', () => ({
  getDb: () => mockGetDb()
}));

jest.mock('../../../despatch/advice/despatch-advice-service', () => ({
  createDespatchAdvice: (...args) => mockCreateDespatchAdvice(...args),
  getDespatchAdviceByAdviceId: (...args) => mockGetDespatchAdviceByAdviceId(...args)
}));

jest.mock('../../../middleware/session-auth', () => jest.fn((req, res, next) => next()));

jest.mock('../user/user-routes-utilities', () => {
  const actual = jest.requireActual('../user/user-routes-utilities');

  return {
    ...actual,
    postChalksnifferOrderForXmlResponse: jest.fn(),
    buildOrderSnapshotFromXml: jest.fn(),
    buildPayloadLineSnapshots: jest.fn(),
    buildSelectedOrderXml: jest.fn(),
    parseDespatchSummaryFromXml: jest.fn(),
    validateInvoiceXmlDocument: jest.fn(),
    overwriteOrderXmlDocumentId: jest.fn(),
    overwriteDespatchXmlDocumentId: jest.fn(),
    overwriteInvoiceXmlDocumentId: jest.fn(),
    deriveInvoiceLinesFromOrder: jest.fn(),
    calculateInvoiceTotals: jest.fn(),
    postLastMinutePushInvoiceForXmlResponse: jest.fn(),
    parseInvoiceSummaryFromXml: jest.fn(),
    parseInvoiceReferenceSummaryFromXml: jest.fn()
  };
});

jest.mock('../../../despatch/order-parser-service', () => ({
  parseOrderXml: jest.fn()
}));

const { parseOrderXml } = require('../../../despatch/order-parser-service');
const utilities = require('../user/user-routes-utilities');
const userRoutes = require('../user/user-routes');

function getRouteHandler(router, method, path) {
  const layer = router.stack.find((entry) => entry.route && entry.route.path === path && entry.route.methods[method]);
  if (!layer) {
    throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
  }

  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    send: jest.fn()
  };
}

describe('v2 user route create handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CHALKSNIFFER_API_TOKEN = 'Authorization: test-chalk-token';
    process.env.LASTMINUTEPUSH_API_TOKEN = 'Authorization: test-lmp-token';
    mockGetDb.mockReturnValue({
      collection: jest.fn((name) => {
        if (name === 'user-orders') {
          return {
            insertOne: jest.fn().mockResolvedValue({ insertedId: 'order-db-id' }),
            findOne: jest.fn().mockResolvedValue(null)
          };
        }

        if (name === 'user-despatch-advice') {
          return {
            findOne: jest.fn().mockResolvedValue(null),
            replaceOne: jest.fn().mockResolvedValue({ acknowledged: true }),
            insertOne: jest.fn().mockResolvedValue({ insertedId: 'despatch-db-id' }),
            find: jest.fn(() => ({ toArray: jest.fn().mockResolvedValue([]) }))
          };
        }

        if (name === 'user-invoices') {
          return {
            insertOne: jest.fn().mockResolvedValue({ insertedId: 'invoice-db-id' }),
            findOne: jest.fn().mockResolvedValue(null),
            find: jest.fn(() => ({ toArray: jest.fn().mockResolvedValue([]) })),
            updateOne: jest.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 })
          };
        }

        throw new Error('Unexpected collection access: ' + name);
      })
    });

    utilities.postChalksnifferOrderForXmlResponse.mockResolvedValue('<Order />');
    utilities.buildOrderSnapshotFromXml.mockReturnValue({
      displayId: 'ORD-EXT-1',
      issueDate: '2026-04-07',
      buyer: 'Buyer Co',
      supplier: 'Supplier Co',
      orderLines: [{ lineId: 'LINE-001', requestedQuantity: 2 }]
    });
    utilities.buildPayloadLineSnapshots.mockReturnValue([{ lineId: 'LINE-001', requestedQuantity: 2 }]);
    parseOrderXml.mockReturnValue({ Order: {} });

    mockCreateDespatchAdvice.mockResolvedValue({ adviceIds: ['despatch-uuid-1'] });
    mockGetDespatchAdviceByAdviceId.mockResolvedValue({
      _id: 'despatch-uuid-1',
      originalOrderId: 'ORD-2026-001',
      despatchXml: '<DespatchAdvice />'
    });
    utilities.buildSelectedOrderXml.mockReturnValue('<Order />');
    utilities.parseDespatchSummaryFromXml.mockReturnValue({
      displayId: 'DSP-EXT-1',
      issueDate: '2026-04-07',
      orderDisplayId: 'ORD-2026-001',
      buyer: 'Buyer Co',
      supplier: 'Supplier Co',
      lines: [{ lineId: 'LINE-001', quantity: 2 }]
    });

    utilities.postLastMinutePushInvoiceForXmlResponse.mockResolvedValue({
      invoice: {
        invoice_id: 'inv-123',
        status: 'paid',
        issue_date: '2026-04-07',
        due_date: '2026-04-14',
        payable_amount: 22
      },
      invoiceXml: '<Invoice />'
    });
    utilities.overwriteInvoiceXmlDocumentId.mockReturnValue('<Invoice />');
    utilities.parseInvoiceSummaryFromXml.mockReturnValue({
      displayId: 'INV-EXT-1',
      issueDate: '2026-04-07',
      buyer: 'Buyer Co',
      total: 22
    });
    utilities.parseInvoiceReferenceSummaryFromXml.mockReturnValue({
      orderDisplayId: 'ORD-2026-001',
      despatchDisplayIds: []
    });
    utilities.deriveInvoiceLinesFromOrder.mockReturnValue([
      {
        lineId: 'LINE-001',
        description: 'Starter pack',
        quantity: 2,
        unitPrice: 11,
        lineTotal: 22
      }
    ]);
    utilities.calculateInvoiceTotals.mockReturnValue({
      linesTotal: 22,
      gstAmount: 2.2,
      totalAmount: 24.2
    });
    utilities.validateInvoiceXmlDocument.mockReturnValue({ success: true, summary: { displayId: 'INV-EXT-1' } });
    utilities.overwriteOrderXmlDocumentId.mockReturnValue('<Order />');
    utilities.overwriteDespatchXmlDocumentId.mockReturnValue('<DespatchAdvice />');
  });

  test('creates an order document', async () => {
    const handler = getRouteHandler(userRoutes, 'post', '/order/create');
    const req = {
      body: {
        sellerPartyId: 'seller-1',
        supplierAbn: '12345678987',
        customerAbn: '98765432109',
        data: {
          ID: 'ORD-1001',
          IssueDate: '2026-04-07',
          BuyerCustomerParty: {
            Party: {
              PartyName: [{ Name: 'Buyer Co' }],
              PostalAddress: {
                StreetName: '1 Buyer St',
                CityName: 'Sydney',
                PostalZone: '2000',
                Country: { IdentificationCode: 'AU' }
              }
            }
          },
          SellerSupplierParty: {
            Party: {
              PartyName: [{ Name: 'Supplier Co' }],
              PostalAddress: {
                StreetName: '2 Seller St',
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
                Quantity: 2,
                Delivery: {
                  DeliveryAddress: {
                    StreetName: '1 Test Street',
                    CityName: 'Sydney',
                    PostalZone: '2000',
                    Country: { IdentificationCode: 'AU' }
                  }
                }
              }
            }
          ]
        }
      },
      session: { userId: 'test-user' },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'jest' }
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('creates a despatch document', async () => {
    const handler = getRouteHandler(userRoutes, 'post', '/despatch/create');
    const req = {
      body: {
        orderUuid: '34ec2376-a8c4-4a59-a307-e64f7aaf1150',
        lineSelections: [{ lineId: 'LINE-001', fulfilmentQuantity: 2 }]
      },
      session: { userId: 'test-user' },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'jest' }
    };
    const res = createResponse();

    mockGetDb.mockReturnValue({
      collection: jest.fn((name) => {
        if (name === 'user-orders') {
          return {
            findOne: jest.fn().mockResolvedValue({
              _id: '34ec2376-a8c4-4a59-a307-e64f7aaf1150',
              displayId: 'ORD-2026-001',
              buyer: 'Buyer Co',
              supplier: 'Supplier Co',
              generatedOrderXml: '<Order />',
              orderLines: [{ lineId: 'LINE-001', requestedQuantity: 2 }]
            })
          };
        }

        if (name === 'user-despatch-advice') {
          return {
            replaceOne: jest.fn().mockResolvedValue({ acknowledged: true })
          };
        }

        if (name === 'user-invoices') {
          return { find: jest.fn(() => ({ toArray: jest.fn().mockResolvedValue([]) })) };
        }

        throw new Error('Unexpected collection access: ' + name);
      })
    });

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(mockCreateDespatchAdvice).toHaveBeenCalled();
  });

  test('creates an invoice document', async () => {
    const handler = getRouteHandler(userRoutes, 'post', '/invoice/create');
    const req = {
      body: {
        baseDespatchUuid: '6b17c76a-87cd-4bff-83dc-1257536b6f14',
        invoiceSourceType: 'despatch',
        manualLines: [
          { lineId: 'LINE-001', description: 'Starter pack', quantity: 2, unitPrice: 11 }
        ]
      },
      session: { userId: 'test-user' },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'jest' }
    };
    const res = createResponse();

    mockGetDb.mockReturnValue({
      collection: jest.fn((name) => {
        if (name === 'user-orders') {
          return {
            findOne: jest.fn().mockResolvedValue({
              _id: '34ec2376-a8c4-4a59-a307-e64f7aaf1150',
              displayId: 'ORD-2026-001',
              buyer: 'Buyer Co',
              supplier: 'Supplier Co',
              supplierAbn: '12345678987',
              customerAbn: '98765432109',
              orderLines: [{ lineId: 'LINE-001', requestedQuantity: 2 }]
            })
          };
        }

        if (name === 'user-despatch-advice') {
          return {
            findOne: jest.fn().mockResolvedValue({
              _id: '6b17c76a-87cd-4bff-83dc-1257536b6f14',
              orderUuid: '34ec2376-a8c4-4a59-a307-e64f7aaf1150',
              displayId: 'DSP-2026-001',
              despatchXml: '<DespatchAdvice />',
              buyer: 'Buyer Co',
              supplier: 'Supplier Co',
              lines: [{ lineId: 'LINE-001', quantity: 2 }]
            })
          };
        }

        if (name === 'user-invoices') {
          return {
            insertOne: jest.fn().mockResolvedValue({ insertedId: 'invoice-db-id' }),
            find: jest.fn(() => ({ toArray: jest.fn().mockResolvedValue([]) }))
          };
        }

        throw new Error('Unexpected collection access: ' + name);
      })
    });

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(utilities.postLastMinutePushInvoiceForXmlResponse).toHaveBeenCalled();
  });
});