const { createDespatchAdvice } = require('../despatch-service');
const { validateOrderXml } = require('../../validators/order-xml-validator-service');
const { getDb } = require('../../database');

jest.mock('../../database', () => ({
  getDb: jest.fn()
}));

jest.mock('../../validators/order-xml-validator-service', () => ({
  validateOrderXml: jest.fn()
}));

describe('createDespatchAdvice', () => {
  const validatedOrderResult = {
    success: true,
    id: '6e09886b-dc6e-439f-82d1-7ccac7f4e3b1',
    orderId: 'AEG012345',
    salesOrderId: 'CON0095678',
    issueDate: '2005-06-20'
  };

  const fakeCollection = {
    insertOne: jest.fn()
  };

  beforeEach(() => {
    getDb.mockReturnValue({
      collection: () => fakeCollection
    });
    fakeCollection.insertOne.mockReset();
    validateOrderXml.mockReset();
  });

  test('Validation passes + insert succeeds -> returns adviceId and despatchXml', async () => {
    validateOrderXml.mockResolvedValue(validatedOrderResult);
    fakeCollection.insertOne.mockResolvedValue({ insertedId: 'fake-id' });

    const result = await createDespatchAdvice('test-api-key', '<xml>valid</xml>', { userAgent: 'TestAgent' });
    expect(result).toEqual(expect.objectContaining({
      adviceId: 'fake-id',
      despatchXml: expect.any(String)
    }));
  });

  test('Correct document is passed to insertOne (apiKey, despatchXml, metadata)', async () => {
    validateOrderXml.mockResolvedValue(validatedOrderResult);
    fakeCollection.insertOne.mockResolvedValue({ insertedId: 'fake-id' });

    const requestMetadata = { userAgent: 'TestAgent' };
    await createDespatchAdvice('test-api-key', '<xml>valid</xml>', requestMetadata);

    expect(fakeCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
      _id: '6e09886b-dc6e-439f-82d1-7ccac7f4e3b1',
      apiKey: 'test-api-key',
      despatchXml: expect.any(String),
      metadata: expect.objectContaining({
        userAgent: 'TestAgent',
        receivedAt: expect.any(Date)
      }),
      createdAt: expect.any(Date)
    }));

    const insertedDoc = fakeCollection.insertOne.mock.calls[0][0];
    expect(insertedDoc.despatchXml).toContain('<cbc:UUID>6e09886b-dc6e-439f-82d1-7ccac7f4e3b1</cbc:UUID>');
    expect(insertedDoc.despatchXml).toContain('<cac:OrderReference>');
    expect(insertedDoc.despatchXml).toContain('<cbc:ID>AEG012345</cbc:ID>');
  });

  test('validateOrderXml returns { success: false } → throws with validation message', async () => {
    validateOrderXml.mockResolvedValue({ success: false, errors: ['Invalid XML'] });

    await expect(createDespatchAdvice('test-api-key', '<xml>invalid</xml>', {})).rejects.toThrow('Despatch advice validation failed: Invalid XML');
  });

  test('insertOne throws → error propagates out of createDespatchAdvice', async () => {
    validateOrderXml.mockResolvedValue(validatedOrderResult);
    fakeCollection.insertOne.mockRejectedValue(new Error('Database error'));

    await expect(createDespatchAdvice('test-api-key', '<xml>valid</xml>', {})).rejects.toThrow('Database error');
  });

  test('Validation passes but UUID is missing -> throws validation error', async () => {
    validateOrderXml.mockResolvedValue({ success: true, id: null });

    await expect(createDespatchAdvice('test-api-key', '<xml>valid</xml>', {})).rejects.toThrow('Despatch advice validation failed: Missing Order UUID');
  });
});