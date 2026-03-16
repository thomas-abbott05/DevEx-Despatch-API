const fs = require('node:fs');
const path = require('node:path');
const { validateDespatchAdviceXml } = require('../despatch-advice-xml-validator');

describe('validateDespatchAdviceXml', () => {
  const mockPath = path.join(__dirname, '../../despatch/mocks/despatch-advice-mock.xml');
  const validXml = fs.readFileSync(mockPath, 'utf8');

  test('valid DespatchAdvice XML returns success with extracted document data', async () => {
    const result = await validateDespatchAdviceXml(validXml);

    expect(result).toMatchObject({
      success: true,
      id: '565899',
      issueDate: '2005-06-20',
      originalOrderId: 'AEG012345',
      despatchLine: expect.any(String)
    });
  });

  test('missing cbc:ID returns validation error', async () => {
    const xmlWithoutId = validXml.replace(
      /<cbc:ID>565899<\/cbc:ID>/,
      ''
    );

    const result = await validateDespatchAdviceXml(xmlWithoutId);

    expect(result).toStrictEqual({
      success: false,
      errors: ['Missing DespatchAdvice/cbc:ID element']
    });
  });

  test('custom cbc:ID is accepted as the document id', async () => {
    const xmlWithCustomId = validXml.replace(
      /<cbc:ID>565899<\/cbc:ID>/,
      '<cbc:ID>CUSTOM-ID-123</cbc:ID>'
    );

    const result = await validateDespatchAdviceXml(xmlWithCustomId);

    expect(result).toMatchObject({
      success: true,
      id: 'CUSTOM-ID-123',
      issueDate: '2005-06-20',
      originalOrderId: 'AEG012345',
      despatchLine: expect.any(String)
    });
  });

  test('missing cbc:IssueDate returns validation error', async () => {
    const xmlWithoutIssueDate = validXml.replace(
      /<cbc:IssueDate>2005-06-20<\/cbc:IssueDate>/,
      ''
    );

    const result = await validateDespatchAdviceXml(xmlWithoutIssueDate);

    expect(result).toStrictEqual({
      success: false,
      errors: ['Missing DespatchAdvice/cbc:IssueDate element']
    });
  });

  test('missing order reference returns success with undefined originalOrderId', async () => {
    const xmlWithoutOrderRef = validXml.replace(
      /<cac:OrderReference>[\s\S]*?<\/cac:OrderReference>/,
      ''
    );

    const result = await validateDespatchAdviceXml(xmlWithoutOrderRef);

    expect(result).toMatchObject({
      success: true,
      id: '565899',
      issueDate: '2005-06-20',
      originalOrderId: undefined,
      despatchLine: expect.any(String)
    });
  });

  test('missing despatch line returns success with undefined despatchLine', async () => {
    const xmlWithoutDespatchLine = validXml.replace(
      /<cac:DespatchLine>[\s\S]*?<\/cac:DespatchLine>/,
      ''
    );

    const result = await validateDespatchAdviceXml(xmlWithoutDespatchLine);

    expect(result).toMatchObject({
      success: true,
      id: '565899',
      issueDate: '2005-06-20',
      originalOrderId: 'AEG012345',
      despatchLine: undefined
    });
  });

  test('wrong root element returns validation error', async () => {
    const wrongRootXml = validXml
      .replace('<DespatchAdvice', '<SomeOtherDocument')
      .replace('</DespatchAdvice>', '</SomeOtherDocument>');

    const result = await validateDespatchAdviceXml(wrongRootXml);

    expect(result).toStrictEqual({
      success: false,
      errors: ['Missing DespatchAdvice root element']
    });
  });

  test('malformed XML returns invalid content error', async () => {
    const malformedXml = validXml.replace(
      '<cbc:ID>565899</cbc:ID>',
      '<cbc:ID>565899' // Missing closing tag
    );

    const result = await validateDespatchAdviceXml(malformedXml);

    expect(result).toEqual({
      success: false,
      errors: ['Invalid XML content']
    });
  });

  test('empty XML returns invalid content error', async () => {
    const result = await validateDespatchAdviceXml('   ');

    expect(result).toEqual({
      success: false,
      errors: ['Invalid XML content']
    });
  });
});