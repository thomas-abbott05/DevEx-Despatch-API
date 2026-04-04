const fs = require('node:fs');
const path = require('node:path');
const { validateOrderChangeXml } = require('../order-change-xml-validator');

describe('validateOrderChangeXml', () => {
  const mockPath = path.join(__dirname, '../../../despatch/mocks/order-change-mock.xml');
  const validXml = fs.readFileSync(mockPath, 'utf8');

  test('valid OrderChange XML returns success with extracted fields', async () => {
    const result = await validateOrderChangeXml(validXml);

    expect(result).toMatchObject({
      success: true,
      id: '7',
      issueDate: '2010-01-21',
      originalOrderId: '34'
    });
    expect(result.orderLine).toBeDefined();
  });

  test('missing cbc:ID returns validation error', async () => {
    const xmlWithoutId = validXml.replace(
      /<cbc:ID>7<\/cbc:ID>/,
      ''
    );

    const result = await validateOrderChangeXml(xmlWithoutId);

    expect(result).toEqual({
      success: false,
      errors: ['Missing OrderChange/cbc:ID element']
    });
  });

  test('missing cbc:IssueDate returns validation error', async () => {
    const xmlWithoutIssueDate = validXml.replace(
      /<cbc:IssueDate>2010-01-21<\/cbc:IssueDate>/,
      ''
    );

    const result = await validateOrderChangeXml(xmlWithoutIssueDate);

    expect(result).toEqual({
      success: false,
      errors: ['Missing OrderChange/cbc:IssueDate element']
    });
  });

  test('wrong root element returns validation error', async () => {
    const wrongRootXml = validXml
      .replace('<OrderChange', '<SomeOtherDocument')
      .replace('</OrderChange>', '</SomeOtherDocument>');

    const result = await validateOrderChangeXml(wrongRootXml);

    expect(result).toEqual({
      success: false,
      errors: ['Missing OrderChange root element']
    });
  });

  test('malformed XML returns invalid content error', async () => {
    const result = await validateOrderChangeXml('<OrderChange><broken></OrderChange>');

    expect(result).toEqual({
      success: false,
      errors: ['Invalid XML content']
    });
  });
});
