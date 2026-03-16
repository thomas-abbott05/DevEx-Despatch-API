const fs = require('node:fs');
const path = require('node:path');
const { validateOrderChangeXml } = require('../order-change-xml-validator');

describe('validateOrderChangeXml', () => {
  const mockPath = path.join(__dirname, '../../despatch/mocks/order-change-mock.xml');
  const validXml = fs.readFileSync(mockPath, 'utf8');

  test('valid OrderChange XML returns success with extracted document data', async () => {
    const result = await validateOrderChangeXml(validXml);

    expect(result).toMatchObject({
      success: true,
      id: '7',
      issueDate: '2010-01-21',
      originalOrderId: '34',
      orderLine: expect.any(String)
    });
  });

  test('missing cbc:ID returns validation error', async () => {
    const xmlWithoutId = validXml.replace(
      /<cbc:ID>7<\/cbc:ID>/,
      ''
    );

    const result = await validateOrderChangeXml(xmlWithoutId);

    expect(result).toStrictEqual({
      success: false,
      errors: ['Missing OrderChange/cbc:ID element']
    });
  });

  test('custom cbc:ID is accepted as the document id', async () => {
    const xmlWithCustomId = validXml.replace(
      /<cbc:ID>7<\/cbc:ID>/,
      '<cbc:ID>CUSTOM-ID-123</cbc:ID>'
    );

    const result = await validateOrderChangeXml(xmlWithCustomId);

    expect(result).toMatchObject({
      success: true,
      id: 'CUSTOM-ID-123',
      issueDate: '2010-01-21',
      originalOrderId: '34',
      orderLine: expect.any(String)
    });
  });

  test('missing cbc:IssueDate returns validation error', async () => {
    const xmlWithoutIssueDate = validXml.replace(
      /<cbc:IssueDate>2010-01-21<\/cbc:IssueDate>/,
      ''
    );

    const result = await validateOrderChangeXml(xmlWithoutIssueDate);

    expect(result).toStrictEqual({
      success: false,
      errors: ['Missing OrderChange/cbc:IssueDate element']
    });
  });

  test('missing order reference returns success with undefined originalOrderId', async () => {
    const xmlWithoutOrderRef = validXml.replace(
      /<cac:OrderReference>[\s\S]*?<\/cac:OrderReference>/,
      ''
    );

    const result = await validateOrderChangeXml(xmlWithoutOrderRef);

    expect(result).toMatchObject({
      success: true,
      id: '7',
      issueDate: '2010-01-21',
      originalOrderId: undefined,
      orderLine: expect.any(String)
    });
  });

  test('order reference without cbc:ID returns success with undefined originalOrderId', async () => {
    const xmlWithoutOrderId = validXml.replace(
      /<cbc:ID>34<\/cbc:ID>/,
      ''
    );

    const result = await validateOrderChangeXml(xmlWithoutOrderId);

    expect(result).toMatchObject({
      success: true,
      id: '7',
      issueDate: '2010-01-21',
      originalOrderId: undefined,
      orderLine: expect.any(String)
    });
  });

  test('missing order line returns success with undefined orderLine', async () => {
    const xmlWithoutOrderLine = validXml.replace(
      /<cac:OrderLine>[\s\S]*?<\/cac:OrderLine>/,
      ''
    );

    const result = await validateOrderChangeXml(xmlWithoutOrderLine);

    expect(result).toMatchObject({
      success: true,
      id: '7',
      issueDate: '2010-01-21',
      originalOrderId: '34',
      orderLine: undefined
    });
  });

  test('wrong root element returns validation error', async () => {
    const wrongRootXml = validXml
      .replace('<OrderChange', '<SomeOtherDocument')
      .replace('</OrderChange>', '</SomeOtherDocument>');

    const result = await validateOrderChangeXml(wrongRootXml);

    expect(result).toStrictEqual({
      success: false,
      errors: ['Missing OrderChange root element']
    });
  });

  test('malformed XML returns invalid content error', async () => {
    const malformedXml = validXml.replace(
      '<cbc:ID>7</cbc:ID>',
      '<cbc:ID>7' // Missing closing tag
    );

    const result = await validateOrderChangeXml(malformedXml);

    expect(result).toEqual({
      success: false,
      errors: ['Invalid XML content']
    });
  });

  test('empty XML returns invalid content error', async () => {
    const result = await validateOrderChangeXml('   ');

    expect(result).toEqual({
      success: false,
      errors: ['Invalid XML content']
    });
  });
});