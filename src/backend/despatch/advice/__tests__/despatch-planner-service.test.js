const { RequestValidationError } = require('../../despatch-request-helper');
const { buildDespatchGroups } = require('../despatch-planner-service');

describe('despatch-planner-service', () => {
  test('throws when the order root is missing', () => {
    expect(() => buildDespatchGroups({})).toThrow(RequestValidationError);
    expect(() => buildDespatchGroups({})).toThrow('Invalid order tree: Missing Order root');
  });

  test('throws when order lines are missing', () => {
    expect(() =>
      buildDespatchGroups({
        Order: {
          'cac:Delivery': {
            'cac:DeliveryAddress': {
              StreetName: '1 Test Street'
            }
          }
        }
      })
    ).toThrow('Invalid order tree: Missing Order.cac:OrderLine array');
  });

  test('groups lines by address and normalises quantity and line identifiers', () => {
    const groups = buildDespatchGroups({
      Order: {
        'cac:Delivery': [
          {
            'cac:DeliveryAddress': {
              StreetName: '1 Test Street',
              CityName: 'Sydney',
              PostalZone: '2000'
            },
            'cac:RequestedDeliveryPeriod': {
              'cbc:StartDate': '2026-04-08'
            }
          }
        ],
        'cac:OrderLine': [
          {
            'cac:LineItem': {
              'cbc:ID': '',
              'cbc:Quantity': {
                '#text': '2'
              },
              'cac:Delivery': {
                'cac:DeliveryAddress': {
                  CityName: 'Sydney',
                  PostalZone: '2000',
                  StreetName: '1 Test Street'
                }
              }
            }
          },
          {
            'cac:LineItem': {
              'cbc:ID': 'LINE-002',
              'cbc:Quantity': '3'
            }
          },
          {
            'cac:LineItem': {
              'cbc:ID': 'LINE-003',
              'cbc:Quantity': '1',
              'cac:Delivery': {
                'cac:DeliveryAddress': {
                  StreetName: '99 Other Street',
                  CityName: 'Melbourne',
                  PostalZone: '3000'
                }
              }
            }
          }
        ]
      }
    });

    expect(groups).toHaveLength(2);
    expect(groups[0].deliveryPeriod).toEqual({ 'cbc:StartDate': '2026-04-08' });
    expect(groups[0].lines).toHaveLength(2);
    expect(groups[1].lines).toHaveLength(1);
    expect(groups[0].lines[0]['cac:LineItem']['cbc:ID']).toBe('');
  });

  test('rejects lines with invalid quantities', () => {
    expect(() =>
      buildDespatchGroups({
        Order: {
          'cac:Delivery': {
            'cac:DeliveryAddress': {
              StreetName: '1 Test Street',
              CityName: 'Sydney',
              PostalZone: '2000'
            }
          },
          'cac:OrderLine': [
            {
              'cac:LineItem': {
                'cbc:ID': 'LINE-001',
                'cbc:Quantity': '0'
              }
            }
          ]
        }
      })
    ).toThrow('Invalid order line quantity for line LINE-001: must be greater than 0');
  });
});