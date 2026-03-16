const fs = require('node:fs');
const path = require('node:path');
const { validateReceiptAdviceXml } = require('../receipt-advice-xml-validator');

describe('validateReceiptAdviceXml', () => {
  const mockPath = path.join(__dirname, '../../despatch/mocks/receipt-advice-mock.xml');
  const validXml = fs.readFileSync(mockPath, 'utf8');

  test('valid ReceiptAdvice XML returns success with extracted document data', async () => {
    const result = await validateReceiptAdviceXml(validXml);

    expect(result).toMatchObject({
      success: true,
      id: '658398',
      issueDate: '2005-06-21',
      despatchDocReference: '565899',
      receiptLine: expect.any(String)
    });
  });

  test('missing cbc:ID returns validation error', async () => {
    const xmlWithoutId = validXml.replace(
      /<cbc:ID>658398<\/cbc:ID>/,
      ''
    );

    const result = await validateReceiptAdviceXml(xmlWithoutId);

    expect(result).toStrictEqual({
      success: false,
      errors: ['Missing ReceiptAdvice/cbc:ID element']
    });
  });

  test('custom cbc:ID is accepted as the document id', async () => {
    const xmlWithCustomId = validXml.replace(
      /<cbc:ID>658398<\/cbc:ID>/,
      '<cbc:ID>CUSTOM-ID-123</cbc:ID>'
    );

    const result = await validateReceiptAdviceXml(xmlWithCustomId);

    expect(result).toMatchObject({
      success: true,
      id: 'CUSTOM-ID-123',
      issueDate: '2005-06-21',
      despatchDocReference: '565899',
      receiptLine: expect.any(String)
    });
  });

  test('missing cbc:IssueDate returns validation error', async () => {
    const xmlWithoutIssueDate = validXml.replace(
      /<cbc:IssueDate>2005-06-21<\/cbc:IssueDate>/,
      ''
    );

    const result = await validateReceiptAdviceXml(xmlWithoutIssueDate);

    expect(result).toStrictEqual({
      success: false,
      errors: ['Missing ReceiptAdvice/cbc:IssueDate element']
    });
  });

  test('missing despatch document reference returns success with undefined despatchDocReference', async () => {
    const xmlWithoutDespatchRef = validXml.replace(
      /<cac:DespatchDocumentReference>[\s\S]*?<\/cac:DespatchDocumentReference>/,
      ''
    );

    const result = await validateReceiptAdviceXml(xmlWithoutDespatchRef);

    expect(result).toMatchObject({
      success: true,
      id: '658398',
      issueDate: '2005-06-21',
      despatchDocReference: undefined,
      receiptLine: expect.any(String)
    });
  });

  test('despatch document reference without cbc:ID returns success with undefined despatchDocReference', async () => {
    const xmlWithoutDespatchId = validXml.replace(
      /<cbc:ID>565899<\/cbc:ID>/,
      ''
    );

    const result = await validateReceiptAdviceXml(xmlWithoutDespatchId);

    expect(result).toMatchObject({
      success: true,
      id: '658398',
      issueDate: '2005-06-21',
      despatchDocReference: undefined,
      receiptLine: expect.any(String)
    });
  });

  test('missing receipt line returns success with undefined receiptLine', async () => {
    const xmlWithoutReceiptLine = validXml.replace(
      /<cac:ReceiptLine>[\s\S]*?<\/cac:ReceiptLine>/,
      ''
    );

    const result = await validateReceiptAdviceXml(xmlWithoutReceiptLine);

    expect(result).toMatchObject({
      success: true,
      id: '658398',
      issueDate: '2005-06-21',
      despatchDocReference: '565899',
      receiptLine: undefined
    });
  });

  test('wrong root element returns validation error', async () => {
    const wrongRootXml = validXml
      .replace('<ReceiptAdvice', '<SomeOtherDocument')
      .replace('</ReceiptAdvice>', '</SomeOtherDocument>');

    const result = await validateReceiptAdviceXml(wrongRootXml);

    expect(result).toStrictEqual({
      success: false,
      errors: ['Missing ReceiptAdvice root element']
    });
  });

  test('malformed XML returns invalid content error', async () => {
    const malformedXml = validXml.replace(
      '<cbc:ID>658398</cbc:ID>',
      '<cbc:ID>658398' // Missing closing tag
    );

    const result = await validateReceiptAdviceXml(malformedXml);

    expect(result).toEqual({
      success: false,
      errors: ['Invalid XML content']
    });
  });

  test('empty XML returns invalid content error', async () => {
    const result = await validateReceiptAdviceXml('   ');

    expect(result).toEqual({
      success: false,
      errors: ['Invalid XML content']
    });
  });
});