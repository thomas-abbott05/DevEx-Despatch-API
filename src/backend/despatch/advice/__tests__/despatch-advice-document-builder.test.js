jest.mock('node:crypto', () => ({
  randomUUID: jest.fn(() => 'advice-uuid-123')
}));

const { buildDespatchAdviceDocument } = require('../despatch-advice-document-builder');

describe('despatch-advice-document-builder', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-04-07T10:20:30.000Z').getTime() });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('throws when the order tree is invalid', () => {
    expect(() => buildDespatchAdviceDocument({}, { lines: [{}], deliveryAddress: {} })).toThrow(
      'Invalid order tree: Missing Order root'
    );
  });

  test('throws when the despatch group is invalid', () => {
    expect(() =>
      buildDespatchAdviceDocument(
        {
          Order: {
            'cbc:ID': 'ORD-1'
          }
        },
        null
      )
    ).toThrow('Invalid despatch group: Missing group data');
  });

  test('builds a despatch advice document with optional fields and line metadata', () => {
    const document = buildDespatchAdviceDocument(
      {
        Order: {
          'cbc:ID': 'ORD-1001',
          'cbc:UUID': 'order-uuid-1',
          'cbc:IssueDate': '2026-04-06',
          'cbc:SalesOrderID': 'SO-1001',
          'cac:SellerSupplierParty': { 'cbc:Name': 'Seller Co' },
          'cac:BuyerCustomerParty': { 'cbc:Name': 'Buyer Co' }
        }
      },
      {
        deliveryAddress: {
          StreetName: '1 Test Street',
          CityName: 'Sydney',
          PostalZone: '2000'
        },
        deliveryPeriod: {
          'cbc:StartDate': '2026-04-08'
        },
        lines: [
          {
            'cac:LineItem': {
              'cbc:ID': 'LINE-001',
              'cbc:Quantity': {
                '#text': '2',
                '@_unitCode': 'EA'
              },
              'cbc:SalesOrderID': 'SO-LINE-1',
              'cac:Item': {
                'cbc:Name': 'Widget'
              }
            }
          }
        ]
      }
    );

    expect(document).toEqual({
      DespatchAdvice: expect.objectContaining({
        'cbc:UBLVersionID': '2.1',
        'cbc:ID': 'advice-uuid-123',
        'cbc:UUID': 'advice-uuid-123',
        'cbc:IssueDate': '2026-04-07',
        'cac:OrderReference': expect.objectContaining({
          'cbc:ID': 'ORD-1001',
          'cbc:UUID': 'order-uuid-1',
          'cbc:SalesOrderID': 'SO-1001'
        }),
        'cac:Shipment': expect.objectContaining({
          'cac:Delivery': expect.objectContaining({
            'cac:DeliveryAddress': {
              StreetName: '1 Test Street',
              CityName: 'Sydney',
              PostalZone: '2000'
            },
            'cac:RequestedDeliveryPeriod': {
              'cbc:StartDate': '2026-04-08'
            }
          })
        }),
        'cac:DespatchLine': [
          expect.objectContaining({
            'cbc:ID': 'LINE-001',
            'cbc:DeliveredQuantity': {
              '#text': '2',
              '@_unitCode': 'EA'
            },
            'cbc:BackorderQuantity': {
              '#text': 0,
              '@_unitCode': 'EA'
            },
            'cac:OrderLineReference': expect.objectContaining({
              'cbc:LineID': 'LINE-001',
              'cbc:SalesOrderLineID': 'SO-LINE-1'
            }),
            'cac:Item': {
              'cbc:Name': 'Widget'
            }
          })
        ]
      })
    });
  });

  test('builds a despatch advice document with fallback line id and no requested delivery period', () => {
    const document = buildDespatchAdviceDocument(
      {
        Order: {
          'cbc:ID': 'ORD-1002',
          'cac:SellerSupplierParty': {},
          'cac:BuyerCustomerParty': {}
        }
      },
      {
        deliveryAddress: {
          StreetName: '2 Test Street',
          CityName: 'Melbourne',
          PostalZone: '3000'
        },
        lines: [
          {
            'cac:LineItem': {
              'cbc:Quantity': '5'
            }
          }
        ]
      }
    );

    expect(document.DespatchAdvice['cac:Shipment']).toEqual({
      'cbc:ID': '1',
      'cac:Delivery': {
        'cac:DeliveryAddress': {
          StreetName: '2 Test Street',
          CityName: 'Melbourne',
          PostalZone: '3000'
        }
      }
    });
    expect(document.DespatchAdvice['cac:DespatchLine'][0]['cbc:ID']).toBe('1');
    expect(document.DespatchAdvice['cac:DespatchLine'][0]['cbc:DeliveredQuantity']).toEqual({
      '#text': '5'
    });
    expect(document.DespatchAdvice['cac:DespatchLine'][0]['cac:OrderLineReference']['cbc:LineID']).toBe('1');
  });
});