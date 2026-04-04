const fs = require('node:fs');
const path = require('node:path');
const { validateReceiptAdviceXml } = require('../receipt-advice-xml-validator');

describe('validateReceiptAdviceXml', () => {
  const mockPath = path.join(__dirname, '../../despatch/mocks/receipt-advice-mock.xml');
  const validXml = fs.readFileSync(mockPath, 'utf8');

  test('valid ReceiptAdvice XML returns success with extracted fields', async () => {
    const result = await validateReceiptAdviceXml(validXml);

    expect(result).toMatchObject({
      success: true,
      id: '658398',
      issueDate: '2005-06-21',
      despatchDocReference: '565899'
    });
    expect(result.receiptLine).toBeDefined();
  });

  test('missing cbc:ID returns validation error', async () => {
    const xmlWithoutId = validXml.replace(
      /<cbc:ID>658398<\/cbc:ID>/,
      ''
    );

    const result = await validateReceiptAdviceXml(xmlWithoutId);

    expect(result).toEqual({
      success: false,
      errors: ['Missing ReceiptAdvice/cbc:ID element']
    });
  });

  test('missing cbc:IssueDate returns validation error', async () => {
    const xmlWithoutIssueDate = validXml.replace(
      /<cbc:IssueDate>2005-06-21<\/cbc:IssueDate>/,
      ''
    );

    const result = await validateReceiptAdviceXml(xmlWithoutIssueDate);

    expect(result).toEqual({
      success: false,
      errors: ['Missing ReceiptAdvice/cbc:IssueDate element']
    });
  });

  test('wrong root element returns validation error', async () => {
    const wrongRootXml = validXml
      .replace('<ReceiptAdvice', '<SomeOtherDocument')
      .replace('</ReceiptAdvice>', '</SomeOtherDocument>');

    const result = await validateReceiptAdviceXml(wrongRootXml);

    expect(result).toEqual({
      success: false,
      errors: ['Missing ReceiptAdvice root element']
    });
  });

  test('malformed XML returns invalid content error', async () => {
    const result = await validateReceiptAdviceXml('<ReceiptAdvice><broken></ReceiptAdvice>');

    expect(result).toEqual({
      success: false,
      errors: ['Invalid XML content']
    });
  });
});
