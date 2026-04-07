const { serializeDespatchAdvice } = require('../despatch-advice-xml-serializer');

describe('despatch-advice-xml-serializer', () => {
  test('throws when the document is missing', () => {
    expect(() => serializeDespatchAdvice(null)).toThrow(
      'Invalid despatch advice document: expected object'
    );
  });

  test('throws when the DespatchAdvice root is missing', () => {
    expect(() => serializeDespatchAdvice({})).toThrow(
      'Invalid despatch advice document: missing DespatchAdvice root'
    );
  });

  test('serializes a despatch advice document into XML', () => {
    const xml = serializeDespatchAdvice({
      DespatchAdvice: {
        'cbc:ID': 'advice-uuid-123',
        'cbc:IssueDate': '2026-04-07'
      }
    });

    expect(xml).toContain('<DespatchAdvice>');
    expect(xml).toContain('<cbc:ID>advice-uuid-123</cbc:ID>');
    expect(xml).toContain('<cbc:IssueDate>2026-04-07</cbc:IssueDate>');
  });
});