jest.mock('../../../middleware/session-auth', () => jest.fn((req, res, next) => next()));

const userRoutes = require('../user/user-routes');

describe('v2 user route helpers', () => {
  test('normalises uploaded XML documents and builds upload prefixes', () => {
    expect(
      userRoutes.normaliseUploadedXmlDocuments({
        documents: [
          {
            fileName: 'order.xml',
            xml: '<Order />'
          }
        ]
      })
    ).toEqual([{ fileName: 'order.xml', xml: '<Order />' }]);

    expect(
      userRoutes.normaliseUploadedXmlDocuments({
        xml: '<Order />',
        fileName: 'fallback.xml'
      })
    ).toEqual([{ fileName: 'fallback.xml', xml: '<Order />' }]);

    expect(userRoutes.buildUploadErrorPrefix('broken.xml')).toBe('[broken.xml] ');
    expect(userRoutes.buildUploadErrorPrefix('')).toBe('');
  });

  test('reads quantities, rounds currency, and generates provider identifiers', () => {
    expect(userRoutes.readQuantity('2.5')).toBe(2.5);
    expect(userRoutes.readQuantity('invalid')).toBe(0);
    expect(userRoutes.roundCurrency(10.005)).toBe(10.01);
    expect(userRoutes.buildProviderIdentifier('Acme & Co', 'provider')).toBe('AcmeCo');
    expect(userRoutes.buildProviderIdentifier('', 'provider')).toMatch(/^provider-\d+$/);
    expect(userRoutes.buildLineIdCandidates('')).toEqual([]);
  });

  test('maps invoice and payment summaries', () => {
    expect(userRoutes.mapLastMinutePushInvoiceStatus('paid')).toBe('Paid');
    expect(userRoutes.mapLastMinutePushInvoiceStatus('overdue')).toBe('Overdue');
    expect(userRoutes.mapLastMinutePushInvoiceStatus('draft')).toBe('Issued');

    expect(userRoutes.deriveOrderPaymentSummary([])).toEqual({
      status: 'Not Paid',
      paidInFull: false,
      hasInvoices: false,
      invoiceCount: 0,
      paidInvoiceCount: 0,
      outstandingInvoiceCount: 0
    });

    expect(userRoutes.deriveOrderPaymentSummary([{ status: 'Paid' }, { status: 'Paid' }])).toEqual({
      status: 'Paid',
      paidInFull: true,
      hasInvoices: true,
      invoiceCount: 2,
      paidInvoiceCount: 2,
      outstandingInvoiceCount: 0
    });

    expect(userRoutes.deriveOrderPaymentSummary([{ status: 'Paid' }, { status: 'Issued' }])).toEqual({
      status: 'Partially Paid',
      paidInFull: false,
      hasInvoices: true,
      invoiceCount: 2,
      paidInvoiceCount: 1,
      outstandingInvoiceCount: 1
    });
  });

  test('builds line id candidates and reads order line prices', () => {
    expect(userRoutes.buildLineIdCandidates('LINE-007')).toEqual(['LINE-007', '007', '7']);
    expect(userRoutes.buildLineIdCandidates('12')).toEqual(['12', 'LINE-012']);
    expect(userRoutes.readOrderLineUnitPrice({ unitPrice: 15 }, 1)).toBe(15);
    expect(userRoutes.readOrderLineUnitPrice({ lineItem: { price: { priceAmount: 20.5 } } }, 1)).toBe(20.5);
    expect(userRoutes.readOrderLineUnitPrice({}, 3.75)).toBe(3.75);
  });

  test('summarises destinations and order lines with despatch data', () => {
    expect(
      userRoutes.buildDestinationSummary({
        destinationOptions: [
          { label: 'Sydney' },
          { key: 'Sydney' },
          { label: 'Melbourne' }
        ]
      })
    ).toBe('Sydney, Melbourne');

    expect(userRoutes.buildDestinationSummary({ destination: 'Brisbane' })).toBe('Brisbane');
    expect(userRoutes.buildDestinationSummary({}, 'Fallback')).toBe('Fallback');

    const orderLines = [
      { lineId: 'LINE-001', requestedQuantity: 5, destination: 'Sydney' },
      { lineId: 'LINE-002', requestedQuantity: 2 },
      { lineId: '', requestedQuantity: 1 }
    ];
    const despatchDocs = [
      {
        _id: 'DSP-1',
        lines: [
          { orderLineId: '1', quantity: 3, destination: 'Sydney' },
          { orderLineId: 'LINE-002', quantity: 2, destination: 'Melbourne' },
          { orderLineId: 'LINE-003', quantity: 0 }
        ]
      }
    ];

    const enriched = userRoutes.enrichOrderLinesWithDespatch(orderLines, despatchDocs);
    expect(enriched.enrichedOrderLines).toHaveLength(3);
    expect(enriched.enrichedOrderLines[0].despatchedQuantity).toBe(3);
    expect(enriched.enrichedOrderLines[0].pendingQuantity).toBe(2);
    expect(enriched.pendingDespatchLines).toHaveLength(2);
    expect(enriched.pendingDespatchLines[0].lineId).toBe('LINE-001');
    expect(enriched.enrichedOrderLines[2].lineId).toBe('LINE-003');
  });

  test('matches line candidates and applies despatch and invoice quantities', () => {
    expect(userRoutes.hasLineCandidateMatch(new Set(['LINE-001']), new Set(['1', 'LINE-001']))).toBe(true);
    expect(userRoutes.hasLineCandidateMatch(new Set(['LINE-001']), new Set(['2']))).toBe(false);
    expect(userRoutes.hasLineCandidateMatch(null, new Set(['2']))).toBe(false);

    const orderLineEntries = userRoutes.buildOrderLineStatusEntries({
      orderLines: [{ lineId: 'LINE-001', requestedQuantity: 5 }]
    });

    const despatchLookup = userRoutes.mapDespatchLinesToOrderLines(orderLineEntries, [
      {
        _id: 'DSP-1',
        lines: [{ orderLineId: '1', quantity: 3 }]
      }
    ]);

    expect(orderLineEntries[0].despatchedQuantity).toBe(3);
    expect(despatchLookup.get('DSP-1')[0].matchedOrderLineId).toBe('LINE-001');

    userRoutes.applyPaidInvoiceQuantities(orderLineEntries, despatchLookup, [
      {
        status: 'Paid',
        sourceType: 'despatch',
        despatchUuid: 'DSP-1',
        invoicePayload: {
          InvoiceData: {
            lines: [{ lineId: 'LINE-001', quantity: 2 }]
          }
        }
      }
    ]);

    expect(orderLineEntries[0].paidQuantity).toBe(2);

    userRoutes.applyPaidInvoiceQuantities(orderLineEntries, despatchLookup, [
      {
        status: 'Paid',
        sourceType: 'order'
      },
      {
        status: 'Paid',
        sourceType: 'despatch',
        despatchUuid: 'DSP-1',
        invoicePayload: { InvoiceData: { lines: [] } }
      }
    ]);

    expect(orderLineEntries[0].paidQuantity).toBe(8);
  });

  test('resolves lifecycle status and builds status lookups', () => {
    expect(
      userRoutes.resolveOrderLifecycleStatus({ orderLines: [] }, [], [])
    ).toBe('Pending');

    expect(
      userRoutes.resolveOrderLifecycleStatus({ orderLines: [] }, [{ _id: 'DSP-1', lines: [] }], [])
    ).toBe('In Progress');

    expect(
      userRoutes.resolveOrderLifecycleStatus(
        { orderLines: [{ lineId: 'LINE-001', requestedQuantity: 5 }] },
        [{ _id: 'DSP-1', lines: [{ orderLineId: 'LINE-001', quantity: 5 }] }],
        []
      )
    ).toBe('Despatched');

    expect(
      userRoutes.resolveOrderLifecycleStatus(
        { orderLines: [{ lineId: 'LINE-001', requestedQuantity: 5 }] },
        [],
        [{ status: 'Paid', sourceType: 'despatch', despatchUuid: 'DSP-1', invoicePayload: { InvoiceData: { lines: [] } } }]
      )
    ).toBe('Pending');

    expect(
      userRoutes.resolveOrderLifecycleStatus(
        { orderLines: [{ lineId: 'LINE-001', requestedQuantity: 5 }] },
        [{ _id: 'DSP-1', lines: [{ orderLineId: 'LINE-001', quantity: 5 }] }],
        [{ status: 'Paid', sourceType: 'order' }]
      )
    ).toBe('Completed');

    const statuses = userRoutes.buildOrderStatusLookup(
      [{ _id: 'ORD-1', orderLines: [{ lineId: 'LINE-001', requestedQuantity: 5 }] }],
      [{ _id: 'DSP-1', orderUuid: 'ORD-1', lines: [{ orderLineId: 'LINE-001', quantity: 5 }] }],
      [{ _id: 'INV-1', orderUuid: 'ORD-1', status: 'Paid', sourceType: 'order' }]
    );

    expect(statuses.get('ORD-1')).toBe('Completed');

    expect(userRoutes.buildOrderStatusLookup([{ _id: '', orderLines: [] }], [], [])).toBeInstanceOf(Map);
  });

  test('derives invoice lines from order data', () => {
    const invoiceLines = userRoutes.deriveInvoiceLinesFromOrder(
      {
        orderLines: [
          {
            lineId: 'LINE-001',
            requestedQuantity: 2,
            description: 'Direct item',
            unitPrice: 5
          },
          {
            lineId: 'LINE-002',
            requestedQuantity: 1,
            itemName: 'Fallback item',
            lineItem: { price: { priceAmount: 12 } }
          }
        ]
      },
      9
    );

    expect(invoiceLines).toEqual([
      {
        lineId: 'LINE-001',
        description: 'Direct item',
        quantity: 2,
        unitPrice: 5,
        lineTotal: 10
      },
      {
        lineId: 'LINE-002',
        description: 'Fallback item',
        quantity: 1,
        unitPrice: 12,
        lineTotal: 12
      }
    ]);
  });
});