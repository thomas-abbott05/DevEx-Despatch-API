const { buildCancelRequestMetadata } = require('../despatch-cancel-order-request-helper');
const { RequestValidationError } = require('../despatch-request-helper');

describe('buildCancelRequestMetadata', () => {
  const VALID_UUID = 'e553cc8e-8b37-4a9b-a0cf-87c34ea70a35';
  const VALID_XML = '<OrderCancellation><cbc:ID>f47ac10b-58cc-4372-a567-0e02b2c3d479</cbc:ID></OrderCancellation>';

  const makeReq = (body) => ({ body });

  test('valid body returns adviceId and orderCancellationDocument', () => {
    const result = buildCancelRequestMetadata(makeReq({
      'advice-id': VALID_UUID,
      'order-cancellation-document': VALID_XML
    }));

    expect(result).toMatchObject({
      adviceId: VALID_UUID,
      orderCancellationDocument: VALID_XML
    });
  });

  test('whitespace is trimmed from adviceId and document', () => {
    const result = buildCancelRequestMetadata(makeReq({
      'advice-id': `  ${VALID_UUID}  `,
      'order-cancellation-document': `  ${VALID_XML}  `
    }));

    expect(result.adviceId).toStrictEqual(VALID_UUID);
    expect(result.orderCancellationDocument).toStrictEqual(VALID_XML);
  });

  test('null body throws error', () => {
    expect(() => buildCancelRequestMetadata({ body: null })).toThrow(RequestValidationError);
  });

  test('non object body throws error', () => {
    expect(() => buildCancelRequestMetadata({ body: 'string' })).toThrow(RequestValidationError);
  });

  test('missing advice-id throws error', () => {
    expect(() => buildCancelRequestMetadata(makeReq({
      'order-cancellation-document': VALID_XML
    }))).toThrow(RequestValidationError);
  });

  test('empty advice-id string throws error', () => {
    expect(() => buildCancelRequestMetadata(makeReq({
      'advice-id': '   ',
      'order-cancellation-document': VALID_XML
    }))).toThrow(RequestValidationError);
  });

  test('invalid UUID for advice-id throws error', () => {
    expect(() => buildCancelRequestMetadata(makeReq({
      'advice-id': 'not-a-uuid',
      'order-cancellation-document': VALID_XML
    }))).toThrow(RequestValidationError);
  });

  test('missing order-cancellation-document throws error', () => {
    expect(() => buildCancelRequestMetadata(makeReq({
      'advice-id': VALID_UUID
    }))).toThrow(RequestValidationError);
  });

  test('empty order-cancellation-document string throws error', () => {
    expect(() => buildCancelRequestMetadata(makeReq({
      'advice-id': VALID_UUID,
      'order-cancellation-document': '   '
    }))).toThrow(RequestValidationError);
  });
});