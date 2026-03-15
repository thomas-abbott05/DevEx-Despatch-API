const { createFulfilmentCancellation,
  getFulfilmentCancellation,
  FulfilmentCancellationNotFoundError,
  FulfilmentCancellationForbiddenError
} = require('../despatch-cancel-fulfilment');
const { getDb } = require('../../database');

jest.mock('../../database', () => ({
  getDb: jest.fn()
}));

const VALID_ADVICE_ID = 'e553cc8e-8b37-4a9b-a0cf-87c34ea70a35';
const VALID_API_KEY = 'test-api-key';
const VALID_REASON = 'No stock';
const VALID_FULFILMENT_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

const makeActiveDespatchDoc = (overrides = {}) => ({
  _id: VALID_ADVICE_ID,
  apiKey: VALID_API_KEY,
  despatchXml:'<DespatchAdvice/>',
  createdAt: new Date(),
  ...overrides
});

const makeCancelledDespatchDoc = (overrides = {}) => ({
  _id: VALID_ADVICE_ID,
  apiKey: VALID_API_KEY,
  status: 'cancelled',
  fulfilmentCancellationXml: '<FulfilmentCancellation/>',
  fulfilmentCancellationId: VALID_FULFILMENT_ID,
  cancellationReason: VALID_REASON,
  cancelledAt: new Date(),
  createdAt: new Date(),
  ...overrides
});

describe('createFulfilmentCancellation', () => {
  const VALID_METADATA = {
    adviceId: VALID_ADVICE_ID,
    cancellationReason: VALID_REASON
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
  });

  test('valid metadata + existing doc + matching apiKey returns correct response shape', async () => {
    fakeCollection.findOne.mockResolvedValue(makeActiveDespatchDoc());

    const result = await createFulfilmentCancellation(VALID_API_KEY, VALID_METADATA);

    expect(result).toMatchObject({
      'fulfilment-cancellation': expect.any(String),
      'fulfilment-cancellation-reason': VALID_REASON,
      'fulfilment-cancellation-id': expect.any(String),
      'advice-id': VALID_ADVICE_ID,
      'executed-at': expect.any(Date)
    });
  });

  test('generated XML contains FulfilmentCancellation root and cancellation note', async () => {
    fakeCollection.findOne.mockResolvedValue(makeActiveDespatchDoc());

    const result = await createFulfilmentCancellation(VALID_API_KEY, VALID_METADATA);

    expect(result['fulfilment-cancellation']).toContain('FulfilmentCancellation');
    expect(result['fulfilment-cancellation']).toContain(VALID_REASON);
    expect(result['fulfilment-cancellation']).toContain(VALID_ADVICE_ID);
  });

  test('correct fields passed to updateOne', async () => {
    fakeCollection.findOne.mockResolvedValue(makeActiveDespatchDoc());

    await createFulfilmentCancellation(VALID_API_KEY, VALID_METADATA);

    expect(fakeCollection.updateOne).toHaveBeenCalledWith(
      { _id: VALID_ADVICE_ID },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'cancelled',
          fulfilmentCancellationXml: expect.any(String),
          fulfilmentCancellationId: expect.any(String),
          cancellationReason: VALID_REASON,
          cancelledAt: expect.any(Date)
        }),
        $unset: { despatchXml: '' }
      })
    );
  });

  test('despatch not found throws FulfilmentCancellationNotFoundError', async () => {
    fakeCollection.findOne.mockResolvedValue(null);

    await expect(
      createFulfilmentCancellation(VALID_API_KEY, VALID_METADATA)
    ).rejects.toThrow(FulfilmentCancellationNotFoundError);
  });

  test('apiKey does not match throws FulfilmentCancellationForbiddenError', async () => {
    fakeCollection.findOne.mockResolvedValue(makeActiveDespatchDoc({ apiKey: 'different-key' }));

    await expect(
      createFulfilmentCancellation(VALID_API_KEY, VALID_METADATA)
    ).rejects.toThrow(FulfilmentCancellationForbiddenError);
  });
});

describe('getFulfilmentCancellation', () => {
  const fakeCollection = {
    findOne: jest.fn()
  };

  beforeEach(() => {
    getDb.mockReturnValue({ collection: () => fakeCollection });
    fakeCollection.findOne.mockReset();
  });

  test('valid adviceId + cancelled doc returns correct response shape', async () => {
    fakeCollection.findOne.mockResolvedValue(makeCancelledDespatchDoc());

    const result = await getFulfilmentCancellation(VALID_API_KEY, { adviceId: VALID_ADVICE_ID });

    expect(result).toMatchObject({
      'fulfilment-cancellation': '<FulfilmentCancellation/>',
      'fulfilment-cancellation-reason': VALID_REASON,
      'fulfilment-cancellation-id': VALID_FULFILMENT_ID,
      'advice-id': VALID_ADVICE_ID,
      'executed-at': expect.any(Date)
    });
  });

  test('valid fulfilmentCancellationId queries by fulfilmentCancellationId field', async () => {
    fakeCollection.findOne.mockResolvedValue(makeCancelledDespatchDoc());

    await getFulfilmentCancellation(VALID_API_KEY, { fulfilmentCancellationId: VALID_FULFILMENT_ID });

    expect(fakeCollection.findOne).toHaveBeenCalledWith({ fulfilmentCancellationId: VALID_FULFILMENT_ID });
  });

  test('valid adviceId queries by _id field', async () => {
    fakeCollection.findOne.mockResolvedValue(makeCancelledDespatchDoc());

    await getFulfilmentCancellation(VALID_API_KEY, { adviceId: VALID_ADVICE_ID });

    expect(fakeCollection.findOne).toHaveBeenCalledWith({ _id: VALID_ADVICE_ID });
  });

  test('despatch not found throws FulfilmentCancellationNotFoundError', async () => {
    fakeCollection.findOne.mockResolvedValue(null);

    await expect(
      getFulfilmentCancellation(VALID_API_KEY, { adviceId: VALID_ADVICE_ID })
    ).rejects.toThrow(FulfilmentCancellationNotFoundError);
  });

  test('apiKey does not match throws FulfilmentCancellationForbiddenError', async () => {
    fakeCollection.findOne.mockResolvedValue(makeCancelledDespatchDoc({ apiKey: 'different-key' }));

    await expect(
      getFulfilmentCancellation(VALID_API_KEY, { adviceId: VALID_ADVICE_ID })
    ).rejects.toThrow(FulfilmentCancellationForbiddenError);
  });

  test('no fulfilmentCancellationXml throws FulfilmentCancellationNotFoundError', async () => {
    fakeCollection.findOne.mockResolvedValue(makeCancelledDespatchDoc({ fulfilmentCancellationXml: null }));

    await expect(
      getFulfilmentCancellation(VALID_API_KEY, { adviceId: VALID_ADVICE_ID })
    ).rejects.toThrow(FulfilmentCancellationNotFoundError);
  });
});