const { buildFulfilmentCancelRequestMetadata, buildFulfilmentCancelRetrievalMetadata } = require('../despatch-cancel-fulfilment-helper');
const { RequestValidationError } = require('../../despatch-request-helper');

const VALID_ADVICE_UUID = 'e553cc8e-8b37-4a9b-a0cf-87c34ea70a35';
const VALID_FULFILMENT_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const VALID_REASON = 'No stock';

describe('buildFulfilmentCancelRequestMetadata', () => {
  const makeReq = (body) => ({ body });

  test('valid fulfilment cancellation returns adviceId and cancellationReason', () => {
    const result = buildFulfilmentCancelRequestMetadata(makeReq({
      'advice-id': VALID_ADVICE_UUID,
      'fulfilment-cancellation-reason': VALID_REASON
    }));

    expect(result).toStrictEqual({
      adviceId: VALID_ADVICE_UUID,
      cancellationReason: VALID_REASON
    });
  });

  test('whitespace is trimmed from adviceId and reason', () => {
    const result = buildFulfilmentCancelRequestMetadata(makeReq({
      'advice-id': `  ${VALID_ADVICE_UUID}  `,
      'fulfilment-cancellation-reason': `  ${VALID_REASON}  `
    }));

    expect(result.adviceId).toStrictEqual(VALID_ADVICE_UUID);
    expect(result.cancellationReason).toStrictEqual(VALID_REASON);
  });

  test('null body throws RequestValidationError', () => {
    expect(() => buildFulfilmentCancelRequestMetadata({ body: null })).toThrow(RequestValidationError);
  });

  test('non-object body throws RequestValidationError', () => {
    expect(() => buildFulfilmentCancelRequestMetadata({ body: 'string' })).toThrow(RequestValidationError);
  });

  test('missing advice-id throws RequestValidationError', () => {
    expect(() => buildFulfilmentCancelRequestMetadata(makeReq({
      'fulfilment-cancellation-reason': VALID_REASON
    }))).toThrow(RequestValidationError);
  });

  test('empty advice-id string throws RequestValidationError', () => {
    expect(() => buildFulfilmentCancelRequestMetadata(makeReq({
      'advice-id': '   ',
      'fulfilment-cancellation-reason': VALID_REASON
    }))).toThrow(RequestValidationError);
  });

  test('invalid UUID for advice-id throws RequestValidationError', () => {
    expect(() => buildFulfilmentCancelRequestMetadata(makeReq({
      'advice-id': 'not-a-uuid',
      'fulfilment-cancellation-reason': VALID_REASON
    }))).toThrow(RequestValidationError);
  });

  test('missing fulfilment-cancellation-reason throws RequestValidationError', () => {
    expect(() => buildFulfilmentCancelRequestMetadata(makeReq({
      'advice-id': VALID_ADVICE_UUID
    }))).toThrow(RequestValidationError);
  });

  test('empty fulfilment-cancellation-reason string throws RequestValidationError', () => {
    expect(() => buildFulfilmentCancelRequestMetadata(makeReq({
      'advice-id': VALID_ADVICE_UUID,
      'fulfilment-cancellation-reason': '   '
    }))).toThrow(RequestValidationError);
  });
});

describe('buildFulfilmentCancelRetrievalMetadata', () => {
  const makeReq = (query) => ({ query });

  test('valid advice-id query returns adviceId', () => {
    const result = buildFulfilmentCancelRetrievalMetadata(makeReq({ "advice-id": VALID_ADVICE_UUID }));

    expect(result).toStrictEqual({ adviceId: VALID_ADVICE_UUID });
  });

  test('valid fulfilment-cancellation-id query returns fulfilmentCancellationId', () => {
    const result = buildFulfilmentCancelRetrievalMetadata(makeReq({
      'fulfilment-cancellation-id': VALID_FULFILMENT_UUID
    }));

    expect(result).toStrictEqual({ fulfilmentCancellationId: VALID_FULFILMENT_UUID });
  });

  test('invalid UUID for advice-id throws RequestValidationError', () => {
    expect(() => buildFulfilmentCancelRetrievalMetadata(makeReq({ "advice-id": 'not-a-uuid' }))).toThrow(RequestValidationError);
  });

  test('invalid UUID for fulfilment-cancellation-id throws RequestValidationError', () => {
    expect(() => buildFulfilmentCancelRetrievalMetadata(makeReq({
      'fulfilment-cancellation-id': 'not-a-uuid'
    }))).toThrow(RequestValidationError);
  });

  test('no query params throws RequestValidationError', () => {
    expect(() => buildFulfilmentCancelRetrievalMetadata(makeReq({})))
      .toThrow(RequestValidationError);
  });

  test('advice-id takes priority over fulfilment-cancellation-id when both provided', () => {
    const result = buildFulfilmentCancelRetrievalMetadata(makeReq({
      'advice-id': VALID_ADVICE_UUID,
      'fulfilment-cancellation-id': VALID_FULFILMENT_UUID
    }));

    expect(result).toStrictEqual({ adviceId: VALID_ADVICE_UUID });
  });
});