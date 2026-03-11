const { createDespatchAdvice } = require('../despatch-service');
const { validateDespatchAdvice } = require('../../validators/despatch-validator-service');
const { getDb } = require('../../database');

jest.mock('../../database', () => ({
  getDb: jest.fn()
}));

jest.mock('../../validators/despatch-validator-service', () => ({
  validateDespatchAdvice: jest.fn()
}));

describe('createDespatchAdvice', () => {
  const fakeCollection = {
    insertOne: jest.fn()
  };

  beforeEach(() => {
    getDb.mockReturnValue({
      collection: () => fakeCollection
    });
    fakeCollection.insertOne.mockReset();
    validateDespatchAdvice.mockReset();
  });

  test('Validation passes + insert succeeds → returns insertedId', async () => {
    validateDespatchAdvice.mockResolvedValue({ success: true, errors: [] });
    fakeCollection.insertOne.mockResolvedValue({ insertedId: 'fake-id' });

    const result = await createDespatchAdvice('test-api-key', '<xml>valid</xml>', { userAgent: 'TestAgent' });
    expect(result).toBe('fake-id');
  });

  test('Correct document is passed to insertOne (apiKey, rawXml, metadata)', async () => {
    validateDespatchAdvice.mockResolvedValue({ success: true, errors: [] });
    fakeCollection.insertOne.mockResolvedValue({ insertedId: 'fake-id' });

    const requestMetadata = { userAgent: 'TestAgent' };
    await createDespatchAdvice('test-api-key', '<xml>valid</xml>', requestMetadata);

    expect(fakeCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'test-api-key',
      rawXml: '<xml>valid</xml>',
      metadata: expect.objectContaining({
        userAgent: 'TestAgent',
        receivedAt: expect.any(Date)
      }),
      createdAt: expect.any(Date)
    }));
  });

  test('validateDespatchAdvice returns { success: false } → throws with validation message', async () => {
    validateDespatchAdvice.mockResolvedValue({ success: false, errors: ['Invalid XML'] });

    await expect(createDespatchAdvice('test-api-key', '<xml>invalid</xml>', {})).rejects.toThrow('Despatch advice validation failed: Invalid XML');
  });

  test('insertOne throws → error propagates out of createDespatchAdvice', async () => {
    validateDespatchAdvice.mockResolvedValue({ success: true, errors: [] });
    fakeCollection.insertOne.mockRejectedValue(new Error('Database error'));

    await expect(createDespatchAdvice('test-api-key', '<xml>valid</xml>', {})).rejects.toThrow('Database error');
  });
});