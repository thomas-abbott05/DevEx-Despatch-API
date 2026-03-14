const { buildCancelRequestMetadata, buildCancelRetrievalMetadata } = require('../despatch-cancel-order-request-helper');
const { RequestValidationError } = require('../despatch-request-helper');

const VALID_ADVICE_UUID = 'e553cc8e-8b37-4a9b-a0cf-87c34ea70a35';
const VALID_CANCELLATION_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const VALID_XML = '<OrderCancellation><cbc:ID>f47ac10b-58cc-4372-a567-0e02b2c3d479</cbc:ID></OrderCancellation>';

describe('buildCancelRequestMetadata', () => {
  const makeReq = (body) => ({ body });

  test('valid body returns adviceId and orderCancellationDocument', () => {
    const result = buildCancelRequestMetadata(makeReq({
      'advice-id': VALID_ADVICE_UUID,
      'order-cancellation-document': VALID_XML
    }));

    expect(result).toStrictEqual({
      adviceId: VALID_ADVICE_UUID,
      orderCancellationDocument: VALID_XML
    });
  });

  test('whitespace is trimmed from adviceId and document', () => {
    const result = buildCancelRequestMetadata(makeReq({
      'advice-id': `  ${VALID_ADVICE_UUID}  `,
      'order-cancellation-document': `  ${VALID_XML}  `
    }));

    expect(result.adviceId).toStrictEqual(VALID_ADVICE_UUID);
    expect(result.orderCancellationDocument).toStrictEqual(VALID_XML);
  });

  test('null body throws RequestValidationError', () => {
    expect(() => buildCancelRequestMetadata({ body: null })).toThrow(RequestValidationError);
  });

  test('non-object body throws RequestValidationError', () => {
    expect(() => buildCancelRequestMetadata({ body: 'string' })).toThrow(RequestValidationError);
  });

  test('missing advice-id throws RequestValidationError', () => {
    expect(() => buildCancelRequestMetadata(makeReq({'order-cancellation-document': VALID_XML}))).toThrow(RequestValidationError);
  });

  test('empty advice-id string throws RequestValidationError', () => {
    expect(() => buildCancelRequestMetadata(makeReq({
      'advice-id': '   ',
      'order-cancellation-document': VALID_XML
    }))).toThrow(RequestValidationError);
  });

  test('invalid UUID for advice-id throws RequestValidationError', () => {
    expect(() => buildCancelRequestMetadata(makeReq({
      'advice-id': 'not-a-uuid',
      'order-cancellation-document': VALID_XML
    }))).toThrow(RequestValidationError);
  });

  test('missing order-cancellation-document throws RequestValidationError', () => {
    expect(() => buildCancelRequestMetadata(makeReq({'advice-id': VALID_ADVICE_UUID}))).toThrow(RequestValidationError);
  });

  test('empty order-cancellation-document string throws RequestValidationError', () => {
    expect(() => buildCancelRequestMetadata(makeReq({
      'advice-id': VALID_ADVICE_UUID,
      'order-cancellation-document': '   '
    }))).toThrow(RequestValidationError);
  });
});

describe('buildCancelRetrievalMetadata', () => {
  const makeReq = (query) => ({ query });

  test('valid ?id query returns adviceId', () => {
    const result = buildCancelRetrievalMetadata(makeReq({ id: VALID_ADVICE_UUID }));

    expect(result).toStrictEqual({ adviceId: VALID_ADVICE_UUID });
  });

  test('valid ?cancellation-id query returns cancellationId', () => {
    const result = buildCancelRetrievalMetadata(makeReq({'cancellation-id': VALID_CANCELLATION_UUID}));

    expect(result).toStrictEqual({ cancellationId: VALID_CANCELLATION_UUID });
  });

  test('invalid UUID for ?id throws RequestValidationError', () => {
    expect(() => buildCancelRetrievalMetadata(makeReq({ id: 'not-a-uuid' }))).toThrow(RequestValidationError);
  });

  test('invalid UUID for ?cancellation-id throws RequestValidationError', () => {
    expect(() => buildCancelRetrievalMetadata(makeReq({ 'cancellation-id': 'not-a-uuid' }))).toThrow(RequestValidationError);
  });

  test('no query params throws RequestValidationError', () => {
    expect(() => buildCancelRetrievalMetadata(makeReq({}))).toThrow(RequestValidationError);
  });

  test('?id takes priority over ?cancellation-id when both provided', () => {
    const result = buildCancelRetrievalMetadata(makeReq({
      id: VALID_ADVICE_UUID,
      'cancellation-id': VALID_CANCELLATION_UUID
    }));

    expect(result).toEqual({ adviceId: VALID_ADVICE_UUID });
  });
});