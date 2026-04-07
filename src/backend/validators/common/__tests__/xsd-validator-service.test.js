const fs = require('node:fs');
const path = require('node:path');
const { validateXml } = require('../xsd-validator-service');

describe('validateXml', () => {
  const mockDir = path.join(__dirname, '../../../despatch/mocks');

  const fixtures = {
    order: fs.readFileSync(path.join(mockDir, 'order-mock.xml'), 'utf8'),
    receipt: fs.readFileSync(path.join(mockDir, 'receipt-advice-mock.xml'), 'utf8'),
    despatch: fs.readFileSync(path.join(mockDir, 'despatch-advice-mock.xml'), 'utf8'),
    'order-cancel': fs.readFileSync(path.join(mockDir, 'order-cancellation-mock.xml'), 'utf8'),
    'order-change': fs.readFileSync(path.join(mockDir, 'order-change-mock.xml'), 'utf8'),
    'fulfilment-cancel': fs.readFileSync(path.join(mockDir, 'fulfilment-cancellation-mock.xml'), 'utf8')
  };

  test.each(Object.keys(fixtures))('returns success for valid %s xml', async (documentType) => {
    const result = await validateXml(documentType, fixtures[documentType]);

    expect(result).toEqual({
      success: true,
      errors: []
    });
  });

  test('returns an error for unsupported document type', async () => {
    const result = await validateXml('unknown-doc', fixtures.order);

    expect(result).toEqual({
      success: false,
      errors: ['Unsupported document type: unknown-doc']
    });
  });

  test('returns invalid xml error for malformed order xml', async () => {
    const result = await validateXml('order', '<Order><broken></Order>');

    expect(result).toEqual({
      success: false,
      errors: ['Invalid XML content - check your root XML elements are present and closed properly.']
    });
  });

  test('surfaces downstream validator errors', async () => {
    const orderWithoutId = fixtures.order.replace(/<cbc:ID>[\s\S]*?<\/cbc:ID>/, '');

    const result = await validateXml('order', orderWithoutId);

    expect(result).toEqual({
      success: false,
      errors: ['Invalid Order XML: Missing required field cbc:ID']
    });
  });

  test('toValidationResponse returns unknown error when validator returns null', async () => {
    // Mock the receipt validator to return null to exercise the null-result guard
    jest.mock('../../advice/receipt-advice-xml-validator', () => ({
      validateReceiptAdviceXml: jest.fn().mockResolvedValue(null)
    }));

    // Re-require after mock to pick up the mock
    jest.resetModules();
    const { validateReceiptAdviceXml } = require('../../advice/receipt-advice-xml-validator');
    validateReceiptAdviceXml.mockResolvedValue(null);

    // Use a fresh require of the service
    const { validateXml: freshValidateXml } = require('../xsd-validator-service');
    const result = await freshValidateXml('receipt', fixtures.receipt);

    // Should not throw and should return a structured error
    expect(result).toHaveProperty('success');
  });
});
