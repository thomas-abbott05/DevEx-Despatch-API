const {
  validateBuyerCustomerParty,
  validateSellerSupplierParty
} = require('../common-schema-fields-validators');

describe('validateBuyerCustomerParty', () => {
  test('returns error when cac:Party is missing', () => {
    const result = validateBuyerCustomerParty({});

    expect(result).toEqual({
      success: false,
      errors: ['Invalid Order XML: Missing cac:Party element in cac:BuyerCustomerParty']
    });
  });

  test('returns error when cac:PartyName is missing from Party', () => {
    const result = validateBuyerCustomerParty({ 'cac:Party': {} });

    expect(result).toEqual({
      success: false,
      errors: ['Invalid Order XML: Missing cac:PartyName/cbc:Name element in cac:BuyerCustomerParty']
    });
  });

  test('returns error when cbc:Name is missing from PartyName', () => {
    const result = validateBuyerCustomerParty({
      'cac:Party': { 'cac:PartyName': {} }
    });

    expect(result).toEqual({
      success: false,
      errors: ['Invalid Order XML: Missing cac:PartyName/cbc:Name element in cac:BuyerCustomerParty']
    });
  });

  test('returns success when Party and PartyName and Name are all present', () => {
    const result = validateBuyerCustomerParty({
      'cac:Party': {
        'cac:PartyName': { 'cbc:Name': 'Acme Corp' }
      }
    });

    expect(result).toEqual({ success: true });
  });
});

describe('validateSellerSupplierParty', () => {
  test('returns error when cac:Party is missing', () => {
    const result = validateSellerSupplierParty({});

    expect(result).toEqual({
      success: false,
      errors: ['Invalid Order XML: Missing cac:Party element in cac:SellerSupplierParty']
    });
  });

  test('returns error when cac:PartyName is missing from Party', () => {
    const result = validateSellerSupplierParty({ 'cac:Party': {} });

    expect(result).toEqual({
      success: false,
      errors: ['Invalid Order XML: Missing cac:PartyName/cbc:Name element in cac:SellerSupplierParty']
    });
  });

  test('returns error when cbc:Name is missing from PartyName', () => {
    const result = validateSellerSupplierParty({
      'cac:Party': { 'cac:PartyName': {} }
    });

    expect(result).toEqual({
      success: false,
      errors: ['Invalid Order XML: Missing cac:PartyName/cbc:Name element in cac:SellerSupplierParty']
    });
  });

  test('returns success when Party and PartyName and Name are all present', () => {
    const result = validateSellerSupplierParty({
      'cac:Party': {
        'cac:PartyName': { 'cbc:Name': 'SupplierCo' }
      }
    });

    expect(result).toEqual({ success: true });
  });
});
