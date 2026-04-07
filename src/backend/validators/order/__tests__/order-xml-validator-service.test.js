const fs = require('node:fs');
const path = require('node:path');
const { validateOrder } = require('../order-xml-validator-service');
const { parseOrderXml } = require('../../../despatch/order-parser-service');

describe('validateOrder', () => {
  const orderMockPath = path.join(__dirname, '../../../despatch/mocks/order-mock.xml');
  const validOrderXml = fs.readFileSync(orderMockPath, 'utf8');

  test('valid parsed Order returns success with extracted IDs', async () => {
    const parsedOrderTree = parseOrderXml(validOrderXml);
    const result = await validateOrder(parsedOrderTree);

    expect(result).toMatchObject({
      success: true,
      id: '6E09886B-DC6E-439F-82D1-7CCAC7F4E3B1',
      orderId: 'AEG012345',
      salesOrderId: 'CON0095678',
      issueDate: '2005-06-20'
    });
  });

  test('invalid UUID format returns validation error', async () => {
    const orderWithInvalidUuid = validOrderXml.replace(
      /<cbc:UUID>[\s\S]*?<\/cbc:UUID>/,
      '<cbc:UUID>not-a-uuid</cbc:UUID>'
    );
    const parsedOrderTree = parseOrderXml(orderWithInvalidUuid);

    const result = await validateOrder(parsedOrderTree);

    expect(result).toEqual({
      success: false,
      errors: ['Invalid UUID format in Order/cbc:UUID - not-a-uuid']
    });
  });

  test('missing UUID field still results in a success', async () => {
    const parsedOrderTree = parseOrderXml(validOrderXml);
    delete parsedOrderTree.Order['cbc:UUID'];

    const result = await validateOrder(parsedOrderTree);

    expect(result).toMatchObject({
      success: true,
      id: undefined,
      orderId: 'AEG012345',
      salesOrderId: 'CON0095678',
      issueDate: '2005-06-20'
    });
  });

  test('null parsedOrderTree returns missing root error', async () => {
    const result = await validateOrder(null);

    expect(result).toEqual({
      success: false,
      errors: ['Invalid Order XML: Missing Order root element']
    });
  });

  test('parsedOrderTree without Order key returns missing root error', async () => {
    const result = await validateOrder({});

    expect(result).toEqual({
      success: false,
      errors: ['Invalid Order XML: Missing Order root element']
    });
  });

  test('missing required field cbc:ID returns error', async () => {
    const parsedOrderTree = parseOrderXml(validOrderXml);
    delete parsedOrderTree.Order['cbc:ID'];

    const result = await validateOrder(parsedOrderTree);

    expect(result).toEqual({
      success: false,
      errors: ['Invalid Order XML: Missing required field cbc:ID']
    });
  });

  test('buyer customer party missing cac:Party returns error', async () => {
    const parsedOrderTree = parseOrderXml(validOrderXml);
    parsedOrderTree.Order['cac:BuyerCustomerParty'] = {};

    const result = await validateOrder(parsedOrderTree);

    expect(result).toEqual({
      success: false,
      errors: ['Invalid Order XML: Missing cac:Party element in cac:BuyerCustomerParty']
    });
  });

  test('seller supplier party missing cac:Party returns error', async () => {
    const parsedOrderTree = parseOrderXml(validOrderXml);
    parsedOrderTree.Order['cac:SellerSupplierParty'] = {};

    const result = await validateOrder(parsedOrderTree);

    expect(result).toEqual({
      success: false,
      errors: ['Invalid Order XML: Missing cac:Party element in cac:SellerSupplierParty']
    });
  });
});