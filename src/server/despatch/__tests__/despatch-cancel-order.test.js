const { cancelDespatchAdvice, getCancellation, CancellationNotFoundError, CancellationForbiddenError } = require('../despatch-cancel-order');
const { getDb } = require('../../database');
const { BasicXmlValidationError } = require('../../validators/order-xml-validator-service');
const { validateOrderCancellationXml } = require('../../validators/order-cancellation-xml-validator-service');

jest.mock('../../database', () => ({
  getDb: jest.fn()
}));

jest.mock('../../validators/order-cancellation-xml-validator-service', () => ({
  validateOrderCancellationXml: jest.fn()
}));

const VALID_ADVICE_ID = 'e553cc8e-8b37-4a9b-a0cf-87c34ea70a35';
const VALID_API_KEY = 'test-api-key';
const CANCELLATION_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const VALID_CANCELLATION_XML = '<OrderCancellation/>';

const makeActiveDespatchDoc = (overrides = {}) => ({
  _id: VALID_ADVICE_ID,
  apiKey: VALID_API_KEY,
  despatchXml: '<DespatchAdvice>...</DespatchAdvice>',
  metadata: { orderId: 'AEG012345' },
  createdAt: new Date(),
  ...overrides
});

const makeCancelledDespatchDoc = (overrides = {}) => ({
  _id: VALID_ADVICE_ID,
  apiKey: VALID_API_KEY,
  status: 'cancelled',
  cancellationXml: VALID_CANCELLATION_XML,
  cancellationReason: 'Change of mind',
  cancellationId: CANCELLATION_ID,
  cancelledAt: new Date(),
  createdAt: new Date(),
  ...overrides
});

describe('cancelDespatchAdvice', () => {
  const VALID_METADATA = {
    adviceId: VALID_ADVICE_ID,
    orderCancellationDocument: VALID_CANCELLATION_XML
  };

  const VALID_VALIDATED_CANCELLATION = {
    success: true,
    id: CANCELLATION_ID,
    cancellationNote: 'Change of mind'
  };

  const fakeCollection = {
    findOne: jest.fn(),
    updateOne: jest.fn()
  };

  beforeEach(() => {
    getDb.mockReturnValue({ collection: () => fakeCollection });
    fakeCollection.findOne.mockReset();
    fakeCollection.updateOne.mockReset();
    fakeCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });
    validateOrderCancellationXml.mockReset();
    validateOrderCancellationXml.mockResolvedValue(VALID_VALIDATED_CANCELLATION);
  });

  test('valid metadata + existing doc + matching apiKey returns correct response shape', async () => {
    fakeCollection.findOne.mockResolvedValue(makeActiveDespatchDoc());

    const result = await cancelDespatchAdvice(VALID_API_KEY, VALID_METADATA);

    expect(result).toMatchObject({
      'order-cancellation': VALID_CANCELLATION_XML,
      'order-cancellation-reason': 'Change of mind',
      'order-cancellation-id': CANCELLATION_ID,
      'advice-id': VALID_ADVICE_ID,
      'executed-at': expect.any(Date)
    });
  });

  test('correct fields passed to updateOne', async () => {
    fakeCollection.findOne.mockResolvedValue(makeActiveDespatchDoc());

    await cancelDespatchAdvice(VALID_API_KEY, VALID_METADATA);

    expect(fakeCollection.updateOne).toHaveBeenCalledWith(
      { _id: VALID_ADVICE_ID },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'cancelled',
          cancellationXml: VALID_CANCELLATION_XML,
          cancellationReason: 'Change of mind',
          cancellationId: CANCELLATION_ID,
          cancelledAt: expect.any(Date)
        }),
        $unset: { despatchXml: '' }
      })
    );
  });

  test('validateOrderCancellationXml is called with the cancellation document', async () => {
    fakeCollection.findOne.mockResolvedValue(makeActiveDespatchDoc());

    await cancelDespatchAdvice(VALID_API_KEY, VALID_METADATA);

    expect(validateOrderCancellationXml).toHaveBeenCalledWith(VALID_CANCELLATION_XML);
  });

  test('cancellation XML fails validation throws BasicXmlValidationError', async () => {
    fakeCollection.findOne.mockResolvedValue(makeActiveDespatchDoc());
    validateOrderCancellationXml.mockResolvedValue({
      success: false,
      errors: ['Missing OrderCancellation root element']
    });

    await expect(cancelDespatchAdvice(VALID_API_KEY, VALID_METADATA)).rejects.toThrow(BasicXmlValidationError);
  });

  test('despatch not found throws CancellationNotFoundError', async () => {
    fakeCollection.findOne.mockResolvedValue(null);

    await expect(cancelDespatchAdvice(VALID_API_KEY, VALID_METADATA)).rejects.toThrow(CancellationNotFoundError);
  });

  test('despatch found but apiKey does not match throws CancellationForbiddenError', async () => {
    fakeCollection.findOne.mockResolvedValue(makeActiveDespatchDoc({ apiKey: 'different-key' }));

    await expect(cancelDespatchAdvice(VALID_API_KEY, VALID_METADATA)).rejects.toThrow(CancellationForbiddenError);
  });
});

describe('getCancellation', () => {
  const fakeCollection = {
    findOne: jest.fn()
  };

  beforeEach(() => {
    getDb.mockReturnValue({ collection: () => fakeCollection });
    fakeCollection.findOne.mockReset();
  });

  test('valid adviceId + cancelled doc returns correct response shape', async () => {
    fakeCollection.findOne.mockResolvedValue(makeCancelledDespatchDoc());

    const result = await getCancellation(VALID_API_KEY, { adviceId: VALID_ADVICE_ID });

    expect(result).toMatchObject({
      'order-cancellation': VALID_CANCELLATION_XML,
      'order-cancellation-reason': 'Change of mind',
      'order-cancellation-id': CANCELLATION_ID,
      'advice-id': VALID_ADVICE_ID,
      'executed-at': expect.any(Date)
    });
  });

  test('valid cancellationId queries by cancellationId field', async () => {
    fakeCollection.findOne.mockResolvedValue(makeCancelledDespatchDoc());

    await getCancellation(VALID_API_KEY, { cancellationId: CANCELLATION_ID });

    expect(fakeCollection.findOne).toHaveBeenCalledWith({ cancellationId: CANCELLATION_ID });
  });

  test('valid adviceId queries by _id field', async () => {
    fakeCollection.findOne.mockResolvedValue(makeCancelledDespatchDoc());

    await getCancellation(VALID_API_KEY, { adviceId: VALID_ADVICE_ID });

    expect(fakeCollection.findOne).toHaveBeenCalledWith({ _id: VALID_ADVICE_ID });
  });

  test('despatch not found throws CancellationNotFoundError', async () => {
    fakeCollection.findOne.mockResolvedValue(null);

    await expect(getCancellation(VALID_API_KEY, { adviceId: VALID_ADVICE_ID })).rejects.toThrow(CancellationNotFoundError);
  });

  test('despatch found but apiKey does not match throws CancellationForbiddenError', async () => {
    fakeCollection.findOne.mockResolvedValue(makeCancelledDespatchDoc({ apiKey: 'different-key' }));

    await expect(getCancellation(VALID_API_KEY, { adviceId: VALID_ADVICE_ID })).rejects.toThrow(CancellationForbiddenError);
  });
});