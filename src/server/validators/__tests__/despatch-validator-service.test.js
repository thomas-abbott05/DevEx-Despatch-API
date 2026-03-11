const fs = require('node:fs');
const path = require('node:path');
const { validateOrderXml } = require('../despatch-validator-service');

describe('validateOrderXml', () => {
  const orderMockPath = path.join(__dirname, '../../despatch/mocks/order-mock.xml');
  const validOrderXml = fs.readFileSync(orderMockPath, 'utf8');

  test('valid Order XML returns success with extracted IDs', async () => {
    const result = await validateOrderXml(validOrderXml, {});

    expect(result).toMatchObject({
      success: true,
      id: '6E09886B-DC6E-439F-82D1-7CCAC7F4E3B1',
      orderId: 'AEG012345',
      salesOrderId: 'CON0095678',
      issueDate: '2005-06-20'
    });
  });

  test('missing Order UUID returns validation error', async () => {
    const orderWithoutUuid = validOrderXml.replace(
      /<cbc:UUID>[\s\S]*?<\/cbc:UUID>/,
      ''
    );

    const result = await validateOrderXml(orderWithoutUuid, {});

    expect(result).toEqual({
      success: false,
      errors: ['Missing Order/cbc:UUID element']
    });
  });

  test('invalid UUID format returns validation error', async () => {
    const orderWithInvalidUuid = validOrderXml.replace(
      /<cbc:UUID>[\s\S]*?<\/cbc:UUID>/,
      '<cbc:UUID>not-a-uuid</cbc:UUID>'
    );

    const result = await validateOrderXml(orderWithInvalidUuid, {});

    expect(result).toEqual({
      success: false,
      errors: ['Invalid UUID format in Order/cbc:UUID']
    });
  });

  test('empty XML returns invalid content error', async () => {
    const result = await validateOrderXml('   ', {});

    expect(result).toEqual({
      success: false,
      errors: ['Invalid XML content']
    });
  });
});
