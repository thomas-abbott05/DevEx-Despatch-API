const fs = require('node:fs');
const path = require('node:path');
const { validateFulfilmentCancellationXml } = require('../fulfilment-cancellation-xml-validator');

describe('validateFulfilmentCancellationXml', () => {
  const mockPath = path.join(__dirname, '../../../despatch/mocks/fulfilment-cancellation-mock.xml');
  const validXml = fs.readFileSync(mockPath, 'utf8');

  test('valid FulfilmentCancellation XML returns success with extracted fields', async () => {
    const result = await validateFulfilmentCancellationXml(validXml);

    expect(result).toMatchObject({
      success: true,
      id: '00384',
      issueDate: '2005-06-22',
      originalOrderId: 'AEG012345'
    });
    expect(result.cancellationNote).toContain('quality check');
  });

  test('missing cbc:ID returns validation error', async () => {
    const xmlWithoutId = validXml.replace(
      /<cbc:ID>00384<\/cbc:ID>/,
      ''
    );

    const result = await validateFulfilmentCancellationXml(xmlWithoutId);

    expect(result).toEqual({
      success: false,
      errors: ['Missing FulfilmentCancellation/cbc:ID element']
    });
  });

  test('missing issue date returns validation error', async () => {
    const xmlWithoutIssueDate = validXml.replace(
      /<cbc:IssueDate>2005-06-22<\/cbc:IssueDate>/,
      ''
    );

    const result = await validateFulfilmentCancellationXml(xmlWithoutIssueDate);

    expect(result).toEqual({
      success: false,
      errors: ['Missing DespatchAdvice/cbc:IssueDate element']
    });
  });

  test('missing cancellation note defaults to No reason provided', async () => {
    const xmlWithoutCancellationNote = validXml.replace(
      /<cbc:CancellationNote>[\s\S]*?<\/cbc:CancellationNote>/,
      ''
    );

    const result = await validateFulfilmentCancellationXml(xmlWithoutCancellationNote);

    expect(result).toMatchObject({
      success: true,
      id: '00384',
      cancellationNote: 'No reason provided'
    });
  });

  test('wrong root element returns validation error', async () => {
    const wrongRootXml = validXml
      .replace('<FulfilmentCancellation', '<SomeOtherDocument')
      .replace('</FulfilmentCancellation>', '</SomeOtherDocument>');

    const result = await validateFulfilmentCancellationXml(wrongRootXml);

    expect(result).toEqual({
      success: false,
      errors: ['Missing FulfilmentCancellation root element']
    });
  });

  test('malformed XML returns invalid content error', async () => {
    const result = await validateFulfilmentCancellationXml('<FulfilmentCancellation><broken></FulfilmentCancellation>');

    expect(result).toEqual({
      success: false,
      errors: ['Invalid XML content']
    });
  });
});
