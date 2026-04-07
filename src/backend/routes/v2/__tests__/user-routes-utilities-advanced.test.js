const {
  parseInvoiceReferenceSummaryFromXml,
  validateInvoiceXmlDocument,
  overwriteOrderXmlDocumentId,
  overwriteDespatchXmlDocumentId,
  overwriteInvoiceXmlDocumentId,
  deriveInvoiceLinesFromDespatch,
  calculateInvoiceTotals,
  postChalksnifferOrderForXmlResponse,
  postLastMinutePushInvoiceForXmlResponse
} = require('../user/user-routes-utilities');

describe('user route utilities - advanced coverage', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  test('parseInvoiceReferenceSummaryFromXml extracts unique order and despatch references', () => {
    const result = parseInvoiceReferenceSummaryFromXml([
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">',
      '  <OrderReference>',
      '    <ID>ORD-1001</ID>',
      '  </OrderReference>',
      '  <DespatchDocumentReference>',
      '    <ID>DSP-001</ID>',
      '  </DespatchDocumentReference>',
      '  <cac:DespatchDocumentReference>',
      '    <cbc:ID>DSP-001</cbc:ID>',
      '  </cac:DespatchDocumentReference>',
      '  <cac:DespatchDocumentReference>',
      '    <cbc:ID>DSP-002</cbc:ID>',
      '  </cac:DespatchDocumentReference>',
      '</Invoice>'
    ].join('\n'));

    expect(result).toEqual({
      orderDisplayId: 'ORD-1001',
      despatchDisplayIds: ['DSP-001', 'DSP-002']
    });
  });

  test('validateInvoiceXmlDocument accepts a valid invoice and rejects empty input', () => {
    const validResult = validateInvoiceXmlDocument([
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">',
      '  <cbc:ID>INV-1001</cbc:ID>',
      '  <cbc:IssueDate>2026-04-07</cbc:IssueDate>',
      '  <cac:AccountingCustomerParty>',
      '    <cac:Party>',
      '      <cac:PartyName>',
      '        <cbc:Name>Buyer Co</cbc:Name>',
      '      </cac:PartyName>',
      '    </cac:Party>',
      '  </cac:AccountingCustomerParty>',
      '  <cac:InvoiceLine>',
      '    <cbc:ID>1</cbc:ID>',
      '    <cbc:InvoicedQuantity>1</cbc:InvoicedQuantity>',
      '  </cac:InvoiceLine>',
      '</Invoice>'
    ].join('\n'));

    expect(validResult.success).toBe(true);
    expect(validResult.summary.displayId).toBe('INV-1001');
    expect(validResult.summary.buyer).toBe('Buyer Co');

    const emptyResult = validateInvoiceXmlDocument('');
    expect(emptyResult).toEqual({
      success: false,
      errors: ['Invoice XML content cannot be empty.']
    });
  });

  test('validateInvoiceXmlDocument rejects invoices that miss required elements', () => {
    const invalidResult = validateInvoiceXmlDocument([
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">',
      '  <cbc:ID>INV-1002</cbc:ID>',
      '</Invoice>'
    ].join('\n'));

    expect(invalidResult.success).toBe(false);
    expect(invalidResult.errors).toEqual(
      expect.arrayContaining([
        'Invalid Invoice XML: Missing Invoice/cac:AccountingCustomerParty party name.',
        'Invalid Invoice XML: Missing Invoice/cac:InvoiceLine entries.'
      ])
    );
  });

  test('overwrite XML document ids updates order, despatch, and invoice roots', () => {
    const orderXml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Order xmlns="urn:oasis:names:specification:ubl:schema:xsd:Order-2">',
      '  <cbc:ID>OLD-ORDER</cbc:ID>',
      '  <cbc:UUID>OLD-ORDER</cbc:UUID>',
      '</Order>'
    ].join('\n');
    const despatchXml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<DespatchAdvice xmlns="urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2">',
      '  <cbc:ID>OLD-DSP</cbc:ID>',
      '  <cbc:UUID>OLD-DSP</cbc:UUID>',
      '</DespatchAdvice>'
    ].join('\n');
    const invoiceXml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">',
      '  <cbc:ID>OLD-INV</cbc:ID>',
      '  <cbc:UUID>OLD-INV</cbc:UUID>',
      '</Invoice>'
    ].join('\n');

    expect(overwriteOrderXmlDocumentId(orderXml, 'NEW-ORDER')).toContain('<cbc:ID>NEW-ORDER</cbc:ID>');
    expect(overwriteOrderXmlDocumentId(orderXml, 'NEW-ORDER')).toContain('<cbc:UUID>NEW-ORDER</cbc:UUID>');
    expect(overwriteDespatchXmlDocumentId(despatchXml, 'NEW-DSP')).toContain('<cbc:ID>NEW-DSP</cbc:ID>');
    expect(overwriteInvoiceXmlDocumentId(invoiceXml, 'NEW-INV')).toContain('<cbc:UUID>NEW-INV</cbc:UUID>');
  });

  test('deriveInvoiceLinesFromDespatch maps direct lines and XML fallback lines', () => {
    const directLines = deriveInvoiceLinesFromDespatch(
      {
        lines: [
          {
            lineId: 'DSP-LINE-1',
            description: 'Direct line',
            quantity: 2
          },
          {
            lineId: 'DSP-LINE-2',
            itemName: 'Fallback name',
            quantity: 3
          }
        ]
      },
      12.5
    );

    expect(directLines).toEqual([
      {
        lineId: 'DSP-LINE-1',
        description: 'Direct line',
        quantity: 2,
        unitPrice: 12.5,
        lineTotal: 25
      },
      {
        lineId: 'DSP-LINE-2',
        description: 'Fallback name',
        quantity: 3,
        unitPrice: 12.5,
        lineTotal: 37.5
      }
    ]);

    const fallbackLines = deriveInvoiceLinesFromDespatch(
      {
        lines: [],
        despatchXml: [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<DespatchAdvice xmlns="urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2">',
          '  <cbc:ID>DSP-1001</cbc:ID>',
          '  <cbc:IssueDate>2026-04-07</cbc:IssueDate>',
          '  <cac:Shipment>',
          '    <cac:Delivery>',
          '      <cac:DeliveryAddress>',
          '        <cbc:ID>ADDR-1</cbc:ID>',
          '      </cac:DeliveryAddress>',
          '    </cac:Delivery>',
          '  </cac:Shipment>',
          '  <cac:DespatchLine>',
          '    <cbc:ID>DSP-LINE-3</cbc:ID>',
          '    <cbc:DeliveredQuantity>4</cbc:DeliveredQuantity>',
          '    <cac:Item>',
          '      <cbc:Name>XML line</cbc:Name>',
          '    </cac:Item>',
          '  </cac:DespatchLine>',
          '</DespatchAdvice>'
        ].join('\n')
      },
      8
    );

    expect(fallbackLines).toEqual([
      {
        lineId: 'DSP-LINE-3',
        description: 'XML line',
        quantity: 4,
        unitPrice: 8,
        lineTotal: 32
      }
    ]);
  });

  test('calculateInvoiceTotals rounds totals consistently', () => {
    expect(
      calculateInvoiceTotals(
        [
          { lineTotal: 10.1 },
          { lineTotal: 20.2 }
        ],
        10
      )
    ).toEqual({
      linesTotal: 30.3,
      gstAmount: 3.03,
      totalAmount: 33.33
    });
  });

  test('postChalksnifferOrderForXmlResponse returns direct XML and follows xmlUrl responses', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '<OrderResponse><cbc:ID>ORD-1</cbc:ID></OrderResponse>'
      });

    await expect(
      postChalksnifferOrderForXmlResponse('https://www.chalksniffer.com/orders', { foo: 'bar' }, 'Create order', 'Bearer token-123')
    ).resolves.toBe('<OrderResponse><cbc:ID>ORD-1</cbc:ID></OrderResponse>');

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ xmlUrl: '/orders/ORD-2/xml' })
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '<OrderResponse><cbc:ID>ORD-2</cbc:ID></OrderResponse>'
      });

    await expect(
      postChalksnifferOrderForXmlResponse('https://chalksniffer.com/orders', { foo: 'bar' }, 'Create order', 'Authorization: Bearer token-123')
    ).resolves.toBe('<OrderResponse><cbc:ID>ORD-2</cbc:ID></OrderResponse>');
  });

  test('postChalksnifferOrderForXmlResponse rejects missing token and malformed responses', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '<OrderResponse><cbc:ID>ORD-0</cbc:ID></OrderResponse>'
    });

    await expect(
      postChalksnifferOrderForXmlResponse('https://www.chalksniffer.com/orders', { foo: 'bar' }, 'Create order', '')
    ).resolves.toBe('<OrderResponse><cbc:ID>ORD-0</cbc:ID></OrderResponse>');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://www.chalksniffer.com/orders',
      expect.objectContaining({
        headers: expect.not.objectContaining({ Authorization: expect.any(String) })
      })
    );

    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({})
    });

    await expect(
      postChalksnifferOrderForXmlResponse('https://www.chalksniffer.com/orders', { foo: 'bar' }, 'Create order', 'token-123')
    ).rejects.toThrow('Create order failed: response did not include xmlUrl.');
  });

  test('postLastMinutePushInvoiceForXmlResponse returns invoice XML and validates the token', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          invoice: {
            invoice_id: 'INV-1'
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '<Invoice><cbc:ID>INV-1</cbc:ID></Invoice>'
      });

    await expect(
      postLastMinutePushInvoiceForXmlResponse('https://lastminutepush.one', { foo: 'bar' }, 'Create invoice', 'Bearer token-123')
    ).resolves.toEqual({
      invoice: { invoice_id: 'INV-1' },
      invoiceXml: '<Invoice><cbc:ID>INV-1</cbc:ID></Invoice>'
    });

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://lastminutepush.one/v1/invoices',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-API-Key': 'token-123'
        })
      })
    );

    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'https://lastminutepush.one/v1/invoices/INV-1',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-API-Key': 'token-123'
        })
      })
    );
  });

  test('postLastMinutePushInvoiceForXmlResponse rejects missing token and missing invoice data', async () => {
    await expect(
      postLastMinutePushInvoiceForXmlResponse('https://lastminutepush.one', { foo: 'bar' }, 'Create invoice', '')
    ).rejects.toThrow('Create invoice failed: missing LASTMINUTEPUSH_API_TOKEN.');

    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({})
    });

    await expect(
      postLastMinutePushInvoiceForXmlResponse('https://lastminutepush.one', { foo: 'bar' }, 'Create invoice', 'token-123')
    ).rejects.toThrow('Create invoice failed: create response did not include invoice data.');
  });
});