const {
  validateBuyerCustomerParty,
  validateSellerSupplierParty
} = require('../common-schema-fields-validators');

describe('common schema field validators', () => {
  test('validates buyer customer party success and failure paths', () => {
    expect(validateBuyerCustomerParty({})).toEqual({
      success: false,
      errors: ['Invalid Order XML: Missing cac:Party element in cac:BuyerCustomerParty']
    });

    expect(
      validateBuyerCustomerParty({
        'cac:Party': {
          'cac:PartyName': {
            'cbc:Name': 'Buyer Co'
          }
        }
      })
    ).toEqual({ success: true });

    expect(
      validateBuyerCustomerParty({
        'cac:Party': {
          'cac:PartyName': {}
        }
      })
    ).toEqual({
      success: false,
      errors: ['Invalid Order XML: Missing cac:PartyName/cbc:Name element in cac:BuyerCustomerParty']
    });
  });

  test('validates seller supplier party success and failure paths', () => {
    expect(validateSellerSupplierParty({})).toEqual({
      success: false,
      errors: ['Invalid Order XML: Missing cac:Party element in cac:SellerSupplierParty']
    });

    expect(
      validateSellerSupplierParty({
        'cac:Party': {
          'cac:PartyName': {
            'cbc:Name': 'Supplier Co'
          }
        }
      })
    ).toEqual({ success: true });

    expect(
      validateSellerSupplierParty({
        'cac:Party': {
          'cac:PartyName': {}
        }
      })
    ).toEqual({
      success: false,
      errors: ['Invalid Order XML: Missing cac:PartyName/cbc:Name element in cac:SellerSupplierParty']
    });
  });
});