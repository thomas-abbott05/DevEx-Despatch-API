const fs = require('node:fs');
const path = require('node:path');
const { validateDespatchAdviceXml } = require('../despatch-advice-xml-validator');

describe('validateDespatchAdviceXml', () => {
  const mockPath = path.join(__dirname, '../../despatch/mocks/despatch-advice-mock.xml');
  const validXml = fs.readFileSync(mockPath, 'utf8');

  test('valid DespatchAdvice XML returns success with extracted fields', async () => {
    const result = await validateDespatchAdviceXml(validXml);

    expect(result).toMatchObject({
      success: true,
      id: '565899',
      issueDate: '2005-06-20',
      originalOrderId: 'AEG012345'
    });
    expect(result.despatchLine).toBeDefined();
  });

  test('missing cbc:ID returns validation error', async () => {
    const xmlWithoutId = validXml.replace(
      /<cbc:ID>565899<\/cbc:ID>/,
      ''
    );

    const result = await validateDespatchAdviceXml(xmlWithoutId);

    expect(result).toEqual({
      success: false,
      errors: ['Missing DespatchAdvice/cbc:ID element']
    });
  });

  test('missing cbc:IssueDate returns validation error', async () => {
    const xmlWithoutIssueDate = validXml.replace(
      /<cbc:IssueDate>2005-06-20<\/cbc:IssueDate>/,
      ''
    );

    const result = await validateDespatchAdviceXml(xmlWithoutIssueDate);

    expect(result).toEqual({
      success: false,
      errors: ['Missing DespatchAdvice/cbc:IssueDate element']
    });
  });

  test('wrong root element returns validation error', async () => {
    const wrongRootXml = validXml
      .replace('<DespatchAdvice', '<SomeOtherDocument')
      .replace('</DespatchAdvice>', '</SomeOtherDocument>');

    const result = await validateDespatchAdviceXml(wrongRootXml);

    expect(result).toEqual({
      success: false,
      errors: ['Missing DespatchAdvice root element']
    });
  });

  test('malformed XML returns invalid content error', async () => {
    const result = await validateDespatchAdviceXml('<DespatchAdvice><broken></DespatchAdvice>');

    expect(result).toEqual({
      success: false,
      errors: ['Invalid XML content']
    });
  });
});
