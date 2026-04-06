const {
  validateOrderCreateBody,
  validateDespatchCreateBody,
  validateDespatchStatusUpdateBody,
  validateInvoiceCreateBody,
  validateInvoiceStatusUpdateBody,
  buildChalksnifferOrderPayload,
  buildSelectedOrderXml,
  mapOrderDetail,
  deriveInvoiceLinesFromDespatch,
  calculateInvoiceTotals,
  resolveInvoiceStatus,
  postLastMinutePushInvoiceForXmlResponse,
  overwriteInvoiceXmlDocumentId,
  postChalksnifferOrderForXmlResponse
} = require('../user/user-routes-utilities');
const { parseOrderXml } = require('../../../despatch/order-parser-service');
const { validateOrder } = require('../../../validators/order/order-xml-validator-service');

describe('user route utilities', () => {
  test('validateOrderCreateBody accepts a valid payload', () => {
    const payload = {
      sellerPartyId: 'seller-1',
      supplierAbn: '12345678987',
      customerAbn: '98765432109',
      data: {
        ID: 'ORD-1001',
        IssueDate: '2026-04-06',
        BuyerCustomerParty: {
          Party: {
            PartyName: [{ Name: 'Acme Buyer' }],
            PostalAddress: {
              StreetName: '123 Buyer St',
              CityName: 'Sydney',
              PostalZone: '2000',
              Country: {
                IdentificationCode: 'AU'
              }
            }
          }
        },
        SellerSupplierParty: {
          Party: {
            PartyName: [{ Name: 'Supplier One' }],
            PostalAddress: {
              StreetName: '456 Seller Ave',
              CityName: 'Melbourne',
              PostalZone: '3000',
              Country: {
                IdentificationCode: 'AU'
              }
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
                  StreetName: '10 Main St',
                  CityName: 'Sydney',
                  PostalZone: '2000',
                  Country: {
                    IdentificationCode: 'AU'
                  }
                }
              },
              Item: {
                Description: ['Widget'],
                Name: 'Test Product'
              }
            }
          }
        ]
      }
    };

    const validation = validateOrderCreateBody(payload);

    expect(validation.errors).toEqual([]);
    expect(validation.sellerPartyId).toBe('seller-1');
    expect(validation.data.ID).toBe('ORD-1001');
  });

  test('validateOrderCreateBody rejects missing party postal addresses', () => {
    const validation = validateOrderCreateBody({
      data: {
        ID: 'ORD-1002',
        IssueDate: '2026-04-06',
        BuyerCustomerParty: {
          Party: {
            PartyName: [{ Name: 'Acme Buyer' }]
          }
        },
        SellerSupplierParty: {
          Party: {
            PartyName: [{ Name: 'Supplier One' }]
          }
        },
        OrderLine: [
          {
            LineItem: {
              ID: 'LINE-001',
              Quantity: 1,
              Delivery: {
                DeliveryAddress: {
                  StreetName: '10 Main St',
                  CityName: 'Sydney',
                  PostalZone: '2000',
                  Country: {
                    IdentificationCode: 'AU'
                  }
                }
              },
              Item: {
                Name: 'Widget',
                Description: ['Test item']
              }
            }
          }
        ]
      }
    });

    expect(validation.errors.some((entry) => /BuyerCustomerParty\.Party\.PostalAddress/i.test(entry))).toBe(true);
    expect(validation.errors.some((entry) => /SellerSupplierParty\.Party\.PostalAddress/i.test(entry))).toBe(true);
  });

  test('validateDespatchCreateBody rejects invalid input', () => {
    const validation = validateDespatchCreateBody({
      orderUuid: 'invalid-uuid',
      lineSelections: [{ lineId: '', fulfilmentQuantity: 0 }]
    });

    expect(validation.errors.length).toBeGreaterThan(0);
    expect(validation.errors.some((entry) => /orderUuid/i.test(entry))).toBe(true);
  });

  test('validateInvoiceCreateBody applies defaults', () => {
    const validation = validateInvoiceCreateBody({
      despatchUuid: '34ec2376-a8c4-4a59-a307-e64f7aaf1150'
    });

    expect(validation.errors).toEqual([]);
    expect(validation.baseDespatchUuid).toBe('34ec2376-a8c4-4a59-a307-e64f7aaf1150');
    expect(validation.invoiceSourceType).toBe('despatch');
    expect(validation.invoiceSourceDespatchUuid).toBe('34ec2376-a8c4-4a59-a307-e64f7aaf1150');
    expect(validation.currency).toBe('AUD');
    expect(validation.gstPercent).toBe(10);
    expect(validation.defaultUnitPrice).toBe(1);
  });

  test('validateInvoiceCreateBody validates manual invoice lines', () => {
    const validation = validateInvoiceCreateBody({
      baseDespatchUuid: '34ec2376-a8c4-4a59-a307-e64f7aaf1150',
      invoiceSourceType: 'order',
      manualLinesIncludeGst: true,
      manualLines: [
        {
          lineId: 'LINE-001',
          description: 'Game Card',
          quantity: 2,
          unitPrice: 35
        }
      ]
    });

    expect(validation.errors).toEqual([]);
    expect(validation.invoiceSourceType).toBe('order');
    expect(validation.manualLinesIncludeGst).toBe(true);
    expect(validation.manualLines).toHaveLength(1);
  });

  test('validateInvoiceCreateBody accepts baseOrderUuid for whole-order invoicing', () => {
    const validation = validateInvoiceCreateBody({
      baseOrderUuid: '34ec2376-a8c4-4a59-a307-e64f7aaf1150',
      invoiceSourceType: 'order'
    });

    expect(validation.errors).toEqual([]);
    expect(validation.baseOrderUuid).toBe('34ec2376-a8c4-4a59-a307-e64f7aaf1150');
    expect(validation.invoiceSourceType).toBe('order');
  });

  test('validateInvoiceStatusUpdateBody accepts valid local statuses', () => {
    const validation = validateInvoiceStatusUpdateBody({ status: 'paid' });

    expect(validation.errors).toEqual([]);
    expect(validation.status).toBe('Paid');
  });

  test('validateInvoiceStatusUpdateBody rejects unsupported statuses', () => {
    const validation = validateInvoiceStatusUpdateBody({ status: 'draft' });

    expect(validation.errors.length).toBeGreaterThan(0);
  });

  test('validateDespatchStatusUpdateBody accepts shipped and received', () => {
    const shippedValidation = validateDespatchStatusUpdateBody({ status: 'shipped' });
    const receivedValidation = validateDespatchStatusUpdateBody({ status: 'Received' });

    expect(shippedValidation.errors).toEqual([]);
    expect(shippedValidation.status).toBe('Shipped');
    expect(receivedValidation.errors).toEqual([]);
    expect(receivedValidation.status).toBe('Received');
  });

  test('validateDespatchStatusUpdateBody rejects unsupported statuses', () => {
    const validation = validateDespatchStatusUpdateBody({ status: 'pending' });

    expect(validation.errors.length).toBeGreaterThan(0);
  });

  test('resolveInvoiceStatus derives overdue when due date has passed and no manual override exists', () => {
    const resolvedStatus = resolveInvoiceStatus(
      {
        status: 'Issued',
        dueDate: '2000-01-01',
        statusManuallySet: false
      },
      new Date('2026-04-06T00:00:00.000Z')
    );

    expect(resolvedStatus).toBe('Overdue');
  });

  test('resolveInvoiceStatus preserves manual status override for overdue invoices', () => {
    const resolvedStatus = resolveInvoiceStatus(
      {
        status: 'Issued',
        dueDate: '2000-01-01',
        statusManuallySet: true
      },
      new Date('2026-04-06T00:00:00.000Z')
    );

    expect(resolvedStatus).toBe('Issued');
  });

  test('buildSelectedOrderXml guards against duplicate line selections', () => {
    const parsedOrderTree = {
      Order: {
        'cac:OrderLine': [
          {
            'cac:LineItem': {
              'cbc:ID': 'LINE-001',
              'cbc:Quantity': '2'
            }
          }
        ]
      }
    };

    expect(() =>
      buildSelectedOrderXml(parsedOrderTree, [
        { lineId: 'LINE-001', fulfilmentQuantity: 1 },
        { lineId: 'LINE-001', fulfilmentQuantity: 1 }
      ])
    ).toThrow(/Duplicate lineId/i);
  });

  test('buildSelectedOrderXml accepts LINE-### selection for numeric XML line IDs', () => {
    const parsedOrderTree = {
      Order: {
        'cac:OrderLine': [
          {
            'cac:LineItem': {
              'cbc:ID': '1',
              'cbc:Quantity': '2'
            }
          }
        ]
      }
    };

    expect(() =>
      buildSelectedOrderXml(parsedOrderTree, [{ lineId: 'LINE-001', fulfilmentQuantity: 1 }])
    ).not.toThrow();
  });

  test('buildSelectedOrderXml accepts numeric selection for LINE-### XML line IDs', () => {
    const parsedOrderTree = {
      Order: {
        'cac:OrderLine': [
          {
            'cac:LineItem': {
              'cbc:ID': 'LINE-001',
              'cbc:Quantity': '2'
            }
          }
        ]
      }
    };

    expect(() =>
      buildSelectedOrderXml(parsedOrderTree, [{ lineId: '1', fulfilmentQuantity: 1 }])
    ).not.toThrow();
  });

  test('buildSelectedOrderXml falls back to selection order when line IDs do not match', () => {
    const parsedOrderTree = {
      Order: {
        'cac:OrderLine': [
          {
            'cac:LineItem': {
              'cbc:ID': '1',
              'cbc:Quantity': '2'
            }
          }
        ]
      }
    };

    expect(() =>
      buildSelectedOrderXml(parsedOrderTree, [{ lineId: 'some-arbitrary-id', fulfilmentQuantity: 1 }])
    ).not.toThrow();
  });

  test('buildSelectedOrderXml accepts plain OrderLine and LineItem element names', () => {
    const parsedOrderTree = {
      Order: {
        OrderLine: [
          {
            LineItem: {
              ID: '1',
              Quantity: '2'
            }
          }
        ]
      }
    };

    expect(() =>
      buildSelectedOrderXml(parsedOrderTree, [{ lineId: 'LINE-001', fulfilmentQuantity: 1 }])
    ).not.toThrow();
  });

  test('buildSelectedOrderXml reads quantity from RequestedQuantity', () => {
    const parsedOrderTree = {
      Order: {
        'cac:OrderLine': [
          {
            'cac:LineItem': {
              'cbc:ID': 'LINE-001',
              'cbc:RequestedQuantity': '5'
            }
          }
        ]
      }
    };

    expect(() =>
      buildSelectedOrderXml(parsedOrderTree, [{ lineId: 'LINE-001', fulfilmentQuantity: 5 }])
    ).not.toThrow();
  });

  test('buildSelectedOrderXml falls back to stored order line quantity when XML quantity is zero', () => {
    const parsedOrderTree = {
      Order: {
        'cac:OrderLine': [
          {
            'cac:LineItem': {
              'cbc:ID': 'LINE-001',
              'cbc:Quantity': '0'
            }
          }
        ]
      }
    };

    expect(() =>
      buildSelectedOrderXml(
        parsedOrderTree,
        [{ lineId: 'LINE-001', fulfilmentQuantity: 5 }],
        [{ lineId: 'LINE-001', requestedQuantity: 5 }]
      )
    ).not.toThrow();
  });

  test('buildSelectedOrderXml normalises lower-case order nodes for despatch validation', async () => {
    const parsedOrderTree = {
      Order: {
        ID: 'ORD-001',
        IssueDate: '2026-04-06',
        BuyerCustomerParty: {
          party: {
            partyName: 'Thomas Abbott'
          }
        },
        SellerSupplierParty: {
          party: {
            partyName: 'Riot Games'
          }
        },
        OrderLine: [
          {
            lineItem: {
              id: 'LINE-001',
              quantity: '100',
              delivery: {
                deliveryAddress: {
                  streetName: '123 Test St',
                  cityName: 'Sydney',
                  postalZone: '2000',
                  country: 'AU'
                }
              }
            }
          }
        ]
      }
    };

    const selectedXml = buildSelectedOrderXml(parsedOrderTree, [{ lineId: 'LINE-001', fulfilmentQuantity: 50 }]);
    const selectedTree = parseOrderXml(selectedXml);

    const validation = await validateOrder(selectedTree);
    expect(validation.success).toBe(true);

    expect(selectedTree.Order['cbc:ID']).toBe('ORD-001');
    expect(selectedTree.Order['cbc:IssueDate']).toBe('2026-04-06');
    expect(Array.isArray(selectedTree.Order['cac:OrderLine'])).toBe(true);
    expect(selectedTree.Order['cac:OrderLine'][0]['cac:LineItem']['cbc:ID']).toBe('LINE-001');
    expect(Number(selectedTree.Order['cac:OrderLine'][0]['cac:LineItem']['cbc:Quantity'])).toBe(50);
    expect(selectedTree.Order['cac:Delivery']).toBeDefined();
  });

  test('buildChalksnifferOrderPayload maps legacy payload into Chalksniffer request shape', () => {
    const mapped = buildChalksnifferOrderPayload({
      ID: 'ORD-1001',
      IssueDate: '2026-04-06',
      DocumentCurrencyCode: 'AUD',
      BuyerCustomerParty: {
        Party: {
          PartyName: [{ Name: 'Buyer Co' }],
          PostalAddress: {
            StreetName: '123 Buyer St',
            CityName: 'Sydney',
            PostalZone: '2000',
            Country: {
              IdentificationCode: 'AU'
            }
          }
        }
      },
      SellerSupplierParty: {
        Party: {
          PartyName: [{ Name: 'Seller Co' }],
          PostalAddress: {
            StreetName: '456 Seller Ave',
            CityName: 'Melbourne',
            PostalZone: '3000',
            Country: {
              IdentificationCode: 'AU'
            }
          }
        }
      },
      OrderLine: [
        {
          LineItem: {
            ID: '1',
            Quantity: 2,
            Item: {
              Name: 'Widget',
              Description: ['Test Item']
            },
            Price: {
              PriceAmount: 50
            }
          }
        }
      ]
    });

    expect(mapped.id).toBe('ORD-1001');
    expect(mapped.issueDate).toBe('2026-04-06');
    expect(mapped.documentCurrencyCode).toBe('AUD');
    expect(mapped.buyerCustomerParty.party.partyName).toBe('Buyer Co');
    expect(mapped.sellerSupplierParty.party.partyName).toBe('Seller Co');
    expect(mapped.orderLines).toHaveLength(1);
    expect(mapped.orderLines[0].lineItem.id).toBe('1');
    expect(mapped.orderLines[0].lineItem.price.priceAmount).toBe(50);
  });

  test('mapOrderDetail rehydrates unresolved stored orderLines from lower-case XML nodes', () => {
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

    const mapped = mapOrderDetail({
      _id: '34ec2376-a8c4-4a59-a307-e64f7aaf1150',
      displayId: 'ORD-001',
      buyer: 'Thomas Abbott',
      supplier: 'Riot Games',
      lineItems: 1,
      status: 'Pending',
      issueDate: '2026-04-06',
      updatedAt: new Date('2026-04-06T00:00:00.000Z'),
      generatedOrderXml: orderXml,
      orderLines: [
        {
          lineId: 'LINE-001',
          requestedQuantity: 0,
          itemName: 'Line Item 1',
          description: '',
          destinationOptions: []
        }
      ]
    });

    expect(mapped.orderLines).toHaveLength(1);
    expect(mapped.orderLines[0].lineId).toBe('LINE-001');
    expect(mapped.orderLines[0].requestedQuantity).toBe(100);
    expect(mapped.orderLines[0].unitPrice).toBe(50);
    expect(mapped.orderLines[0].itemName).toBe('Valorant Points');
    expect(mapped.orderLines[0].description).toBe('test');
    expect(mapped.orderLines[0].destinationOptions).toHaveLength(1);
    expect(mapped.orderLines[0].destinationOptions[0].label).toContain('123 Test St');
  });

  test('deriveInvoiceLinesFromDespatch and calculateInvoiceTotals build expected totals', () => {
    const invoiceLines = deriveInvoiceLinesFromDespatch(
      {
        lines: [
          {
            lineId: '1',
            quantity: 3,
            description: 'Service item'
          }
        ]
      },
      4.5
    );

    const totals = calculateInvoiceTotals(invoiceLines, 10);

    expect(invoiceLines).toHaveLength(1);
    expect(invoiceLines[0].lineTotal).toBe(13.5);
    expect(totals.linesTotal).toBe(13.5);
    expect(totals.gstAmount).toBe(1.35);
    expect(totals.totalAmount).toBe(14.85);
  });

  test('postChalksnifferOrderForXmlResponse follows xmlUrl and returns XML payload', async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          id: '34',
          xmlUrl: '/orders/34/xml'
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<Order><cbc:ID>34</cbc:ID></Order>'
      });

    global.fetch = fetchMock;

    try {
      const xml = await postChalksnifferOrderForXmlResponse(
        'https://chalksniffer.com/orders',
        { id: 'ORD-001' },
        'Order generation request',
        'chalk-token-123'
      );

      expect(xml).toContain('<Order>');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        'https://www.chalksniffer.com/orders',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'chalk-token-123'
          })
        })
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        'https://www.chalksniffer.com/orders/34/xml',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'chalk-token-123'
          })
        })
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('postLastMinutePushInvoiceForXmlResponse creates invoice then fetches XML with X-API-Key', async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        text: async () =>
          JSON.stringify({
            message: 'Invoice created',
            invoice: {
              invoice_id: 'INV-20260316-ABC12345',
              status: 'draft',
              order_reference: 'ORD-1001',
              customer_id: 'CUST-2001',
              issue_date: '2026-03-16',
              due_date: '2026-03-23',
              payable_amount: 99.99
            }
          })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<Invoice><cbc:ID>INV-20260316-ABC12345</cbc:ID></Invoice>'
      });

    global.fetch = fetchMock;

    try {
      const result = await postLastMinutePushInvoiceForXmlResponse(
        'https://lastminutepush.one',
        {
          order_reference: 'ORD-1001',
          customer_id: 'CUST-2001',
          issue_date: '2026-03-16',
          due_date: '2026-03-23',
          currency: 'AUD',
          supplier: {
            name: 'Supplier',
            identifier: 'SUP-1'
          },
          customer: {
            name: 'Customer',
            identifier: 'CUST-2001'
          },
          items: [
            {
              name: 'Consulting Service',
              description: 'Business consulting engagement',
              quantity: 1,
              unit_price: 99.99,
              unit_code: 'EA'
            }
          ]
        },
        'Invoice generation request',
        'lmp-token-123'
      );

      expect(result.invoice.invoice_id).toBe('INV-20260316-ABC12345');
      expect(result.invoiceXml).toContain('<Invoice>');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        'https://lastminutepush.one/v1/invoices',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-API-Key': 'lmp-token-123'
          })
        })
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        'https://lastminutepush.one/v1/invoices/INV-20260316-ABC12345',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Accept: 'application/xml',
            'X-API-Key': 'lmp-token-123'
          })
        })
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('overwriteInvoiceXmlDocumentId rewrites root invoice ID without touching line IDs', () => {
    const sourceXml = [
      '<Invoice>',
      '  <cbc:ID>INV-20260316-ABC12345</cbc:ID>',
      '  <cbc:IssueDate>2026-03-16</cbc:IssueDate>',
      '  <cac:InvoiceLine>',
      '    <cbc:ID>LINE-001</cbc:ID>',
      '  </cac:InvoiceLine>',
      '</Invoice>'
    ].join('\n');

    const rewrittenXml = overwriteInvoiceXmlDocumentId(
      sourceXml,
      '70e5af6d-00fd-4469-842d-e4f6af89989a'
    );

    expect(rewrittenXml).toContain('<cbc:ID>70e5af6d-00fd-4469-842d-e4f6af89989a</cbc:ID>');
    expect(rewrittenXml).toContain('<cbc:ID>LINE-001</cbc:ID>');
    expect(rewrittenXml).not.toContain('<cbc:ID>INV-20260316-ABC12345</cbc:ID>');
  });
});