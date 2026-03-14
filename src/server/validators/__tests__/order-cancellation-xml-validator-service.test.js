const fs = require('node:fs');
const path = require('node:path');
const { validateOrderCancellationXml } = require('../order-cancellation-xml-validator-service');

describe('validateOrderCancellationXml', () => {
  const mockPath = path.join(__dirname, '../../despatch/mocks/order-cancellation-mock.xml');
  const validXml = fs.readFileSync(mockPath, 'utf8');

  test('valid OrderCancellation XML returns success with extracted id and cancellation note', async () => {
    const result = await validateOrderCancellationXml(validXml);

    expect(result).toMatchObject({
      success: true,
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      cancellationNote: 'Change of mind'
    });
  });

  test('missing cbc:ID returns validation error', async () => {
    const xmlWithoutId = validXml.replace(
      /<cbc:ID>[\s\S]*?<\/cbc:ID>/,
      ''
    );

    const result = await validateOrderCancellationXml(xmlWithoutId);

    expect(result).toStrictEqual({
      success: false,
      errors: ['Missing OrderCancellation/cbc:ID element']
    });
  });

  test('invalid UUID format in cbc:ID returns validation error', async () => {
    const xmlWithInvalidId = validXml.replace(
      /<cbc:ID>[\s\S]*?<\/cbc:ID>/,
      '<cbc:ID>not-a-uuid</cbc:ID>'
    );

    const result = await validateOrderCancellationXml(xmlWithInvalidId);

    expect(result).toStrictEqual({
      success: false,
      errors: ['Invalid UUID format in OrderCancellation/cbc:ID']
    });
  });

  test('missing cancellation note defaults to "No reason provided"', async () => {
    const xmlWithoutNote = validXml.replace(
      /<cbc:CancellationNote>[\s\S]*?<\/cbc:CancellationNote>/,
      ''
    );

    const result = await validateOrderCancellationXml(xmlWithoutNote);

    expect(result).toMatchObject({
      success: true,
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      cancellationNote: 'No reason provided'
    });
  });

  test('wrong root element returns validation error', async () => {
    const wrongRootXml = validXml
      .replace('<OrderCancellation', '<SomeOtherDocument')
      .replace('</OrderCancellation>', '</SomeOtherDocument>');

    const result = await validateOrderCancellationXml(wrongRootXml);

    expect(result).toStrictEqual({
      success: false,
      errors: ['Missing OrderCancellation root element']
    });
  });

  test('empty XML returns invalid content error', async () => {
    const result = await validateOrderCancellationXml('   ');

    expect(result).toEqual({
      success: false,
      errors: ['Invalid XML content']
    });
  });
});