const fs = require('node:fs');
const path = require('node:path');
const { validateFulfilmentCancellationXml } = require('../fulfilment-cancellation-xml-validator');

describe('validateFulfilmentCancellationXml', () => {
  const mockPath = path.join(__dirname, '../../despatch/mocks/fulfilment-cancellation-mock.xml');
  const validXml = fs.readFileSync(mockPath, 'utf8');

  test('valid FulfilmentCancellation XML returns success with extracted document id, issue date, order id and cancellation note', async () => {
    const result = await validateFulfilmentCancellationXml(validXml);

    expect(result).toMatchObject({
      success: true,
      id: '00384',
      issueDate: '2005-06-22',
      originalOrderId: 'AEG012345',
      cancellationNote: 'The quality check has detected that the beeswax doesn\'t become liquid at the expected temperature.'
    });
  });

  test('missing cbc:ID returns validation error', async () => {
    const xmlWithoutId = validXml.replace(
      /<cbc:ID>00384<\/cbc:ID>/,
      ''
    );

    const result = await validateFulfilmentCancellationXml(xmlWithoutId);

    expect(result).toStrictEqual({
      success: false,
      errors: ['Missing FulfilmentCancellation/cbc:ID element']
    });
  });

  test('custom cbc:ID is accepted as the document id', async () => {
    const xmlWithCustomId = validXml.replace(
      /<cbc:ID>00384<\/cbc:ID>/,
      '<cbc:ID>CUSTOM-ID-123</cbc:ID>'
    );

    const result = await validateFulfilmentCancellationXml(xmlWithCustomId);

    expect(result).toMatchObject({
      success: true,
      id: 'CUSTOM-ID-123',
      issueDate: '2005-06-22',
      originalOrderId: 'AEG012345',
      cancellationNote: expect.any(String)
    });
  });

  test('missing cbc:IssueDate returns validation error', async () => {
    const xmlWithoutIssueDate = validXml.replace(
      /<cbc:IssueDate>2005-06-22<\/cbc:IssueDate>/,
      ''
    );

    const result = await validateFulfilmentCancellationXml(xmlWithoutIssueDate);

    expect(result).toStrictEqual({
      success: false,
      errors: ['Missing FulfilmentCancellation/cbc:IssueDate element']
    });
  });

  test('missing cancellation note defaults to "No reason provided"', async () => {
    const xmlWithoutNote = validXml.replace(
      /<cbc:CancellationNote>[\s\S]*?<\/cbc:CancellationNote>/,
      ''
    );

    const result = await validateFulfilmentCancellationXml(xmlWithoutNote);

    expect(result).toMatchObject({
      success: true,
      id: '00384',
      issueDate: '2005-06-22',
      originalOrderId: 'AEG012345',
      cancellationNote: 'No reason provided'
    });
  });

  test('missing order reference returns success with undefined originalOrderId', async () => {
    const xmlWithoutOrderRef = validXml.replace(
      /<cac:OrderReference>[\s\S]*?<\/cac:OrderReference>/,
      ''
    );

    const result = await validateFulfilmentCancellationXml(xmlWithoutOrderRef);

    expect(result).toMatchObject({
      success: true,
      id: '00384',
      issueDate: '2005-06-22',
      originalOrderId: undefined,
      cancellationNote: expect.any(String)
    });
  });

  test('wrong root element returns validation error', async () => {
    const wrongRootXml = validXml
      .replace('<FulfilmentCancellation', '<SomeOtherDocument')
      .replace('</FulfilmentCancellation>', '</SomeOtherDocument>');

    const result = await validateFulfilmentCancellationXml(wrongRootXml);

    expect(result).toStrictEqual({
      success: false,
      errors: ['Missing FulfilmentCancellation root element']
    });
  });

  test('empty XML returns invalid content error', async () => {
    const result = await validateFulfilmentCancellationXml('   ');

    expect(result).toEqual({
      success: false,
      errors: ['Invalid XML content']
    });
  });
});