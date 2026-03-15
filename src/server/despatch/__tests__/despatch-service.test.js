const { createDespatchAdvice, listDespatchAdvices } = require('../despatch-service');
const { validateOrder } = require('../../validators/order-xml-validator-service');
const { getDb } = require('../../database');
const { parseOrderXml } = require('../order-parser-service');
const { buildDespatchGroups } = require('../despatch-planner-service');
const { buildDespatchAdviceDocument } = require('../despatch-advice-document-builder');
const { serializeDespatchAdvice } = require('../despatch-advice-xml-serializer');

jest.mock('../../database', () => ({
  getDb: jest.fn()
}));

jest.mock('../../validators/order-xml-validator-service', () => ({
  validateOrder: jest.fn()
}));

jest.mock('../order-parser-service', () => ({
  parseOrderXml: jest.fn()
}));

jest.mock('../despatch-planner-service', () => ({
  buildDespatchGroups: jest.fn()
}));

jest.mock('../despatch-advice-document-builder', () => ({
  buildDespatchAdviceDocument: jest.fn()
}));

jest.mock('../despatch-advice-xml-serializer', () => ({
  serializeDespatchAdvice: jest.fn()
}));

describe('createDespatchAdvice', () => {
  const validatedOrderResult = {
    success: true,
    id: '6e09886b-dc6e-439f-82d1-7ccac7f4e3b1',
    orderId: 'AEG012345',
    salesOrderId: 'CON0095678',
    issueDate: '2005-06-20'
  };

  const fakeParsedOrder = { order: 'parsed' };
  const fakeAdviceDoc = { DespatchAdvice: { 'cbc:UUID': 'advice-uuid-123' } };
  const fakeDespatchXml = '<DespatchAdvice><cbc:UUID>advice-uuid-123</cbc:UUID></DespatchAdvice>';

  const fakeCollection = {
    insertOne: jest.fn()
  };

  beforeEach(() => {
    getDb.mockReturnValue({
      collection: () => fakeCollection
    });
    fakeCollection.insertOne.mockReset();
    validateOrder.mockReset();
    parseOrderXml.mockReturnValue(fakeParsedOrder);
    buildDespatchGroups.mockReturnValue([{ group: 1 }]);
    buildDespatchAdviceDocument.mockReturnValue(fakeAdviceDoc);
    serializeDespatchAdvice.mockReturnValue(fakeDespatchXml);
  });

  test('Validation passes + insert succeeds -> returns adviceIds array', async () => {
    validateOrder.mockResolvedValue(validatedOrderResult);
    fakeCollection.insertOne.mockResolvedValue({ insertedId: 'advice-uuid-123' });

    const result = await createDespatchAdvice('test-api-key', '<xml>valid</xml>', { userAgent: 'TestAgent' });
    expect(result).toEqual({ adviceIds: ['advice-uuid-123'] });
  });

  test('Multiple despatch groups -> returns one adviceId per group', async () => {
    validateOrder.mockResolvedValue(validatedOrderResult);
    const fakeAdviceDoc2 = { DespatchAdvice: { 'cbc:UUID': 'advice-uuid-456' } };
    buildDespatchGroups.mockReturnValue([{ group: 1 }, { group: 2 }]);
    buildDespatchAdviceDocument
      .mockReturnValueOnce(fakeAdviceDoc)
      .mockReturnValueOnce(fakeAdviceDoc2);
    fakeCollection.insertOne
      .mockResolvedValueOnce({ insertedId: 'advice-uuid-123' })
      .mockResolvedValueOnce({ insertedId: 'advice-uuid-456' });

    const result = await createDespatchAdvice('test-api-key', '<xml>valid</xml>', {});
    expect(result).toEqual({ adviceIds: ['advice-uuid-123', 'advice-uuid-456'] });
    expect(fakeCollection.insertOne).toHaveBeenCalledTimes(2);
  });

  test('Correct document is passed to insertOne (apiKey, despatchXml, metadata)', async () => {
    validateOrder.mockResolvedValue(validatedOrderResult);
    fakeCollection.insertOne.mockResolvedValue({ insertedId: 'advice-uuid-123' });

    const requestMetadata = { userAgent: 'TestAgent' };
    await createDespatchAdvice('test-api-key', '<xml>valid</xml>', requestMetadata);

    expect(fakeCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
      _id: 'advice-uuid-123',
      apiKey: 'test-api-key',
      despatchXml: fakeDespatchXml,
      metadata: { userAgent: 'TestAgent' },
      createdAt: expect.any(Date)
    }));
  });

  test('buildDespatchAdviceDocument and serializeDespatchAdvice are called with parsed order and group', async () => {
    validateOrder.mockResolvedValue(validatedOrderResult);
    fakeCollection.insertOne.mockResolvedValue({ insertedId: 'advice-uuid-123' });

    await createDespatchAdvice('test-api-key', '<xml>valid</xml>', {});

    expect(buildDespatchAdviceDocument).toHaveBeenCalledWith(fakeParsedOrder, { group: 1 });
    expect(serializeDespatchAdvice).toHaveBeenCalledWith(fakeAdviceDoc);
  });

  test('validateOrder returns { success: false } → throws with validation message', async () => {
    validateOrder.mockResolvedValue({ success: false, errors: ['Invalid XML'] });

    await expect(createDespatchAdvice('test-api-key', '<xml>invalid</xml>', {})).rejects.toThrow('Despatch advice validation failed: Invalid XML');
  });

  test('insertOne throws → error propagates out of createDespatchAdvice', async () => {
    validateOrder.mockResolvedValue(validatedOrderResult);
    fakeCollection.insertOne.mockRejectedValue(new Error('Database error'));

    await expect(createDespatchAdvice('test-api-key', '<xml>valid</xml>', {})).rejects.toThrow('Database error');
  });

  test('Validation passes but order UUID is missing -> still generates advice but with no UUID in order reference', async () => {
    validateOrder.mockResolvedValue({ success: true, id: null });
    fakeCollection.insertOne.mockResolvedValue({ insertedId: 'advice-uuid-123' });

    await expect(createDespatchAdvice('test-api-key', '<xml>valid</xml>', {})).resolves.toEqual({ adviceIds: ['advice-uuid-123'] });
  });

  test('Generated advice UUID is missing -> throws generation error', async () => {
    validateOrder.mockResolvedValue(validatedOrderResult);
    buildDespatchAdviceDocument.mockReturnValue({ DespatchAdvice: {} }); // no UUID

    await expect(createDespatchAdvice('test-api-key', '<xml>valid</xml>', {})).rejects.toThrow('Despatch advice generation failed: Missing generated advice UUID');
  });
});

describe('listDespatchAdvices', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('maps despatch advice records into response shape', async () => {
    const toArray = jest.fn().mockResolvedValue([
      { _id: 'da-1', apiKey: 'k1', despatchXml: '<xml>1</xml>' },
      { _id: 'da-2', apiKey: 'k1', despatchXml: '<xml>2</xml>' }
    ]);

    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        find: jest.fn().mockReturnValue({ toArray })
      })
    });

    const result = await listDespatchAdvices('k1');

    expect(result).toEqual([
      {
        'advice-id': 'da-1',
        'despatch-advice': { _id: 'da-1', apiKey: 'k1', despatchXml: '<xml>1</xml>' }
      },
      {
        'advice-id': 'da-2',
        'despatch-advice': { _id: 'da-2', apiKey: 'k1', despatchXml: '<xml>2</xml>' }
      }
    ]);
  });

  test('rethrows database errors from list operation', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        find: jest.fn(() => {
          throw new Error('list failure');
        })
      })
    });

    await expect(listDespatchAdvices('k1')).rejects.toThrow('list failure');
  });
});