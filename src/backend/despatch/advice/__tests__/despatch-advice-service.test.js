const { createDespatchAdvice, listDespatchAdvices, getDespatchAdviceByAdviceId, getDespatchAdviceByOrderId } = require('../despatch-advice-service');
const { searchDespatchAdvice } = require('../despatch-retrieval-service');
const { validateOrder } = require('../../../validators/order/order-xml-validator-service');
const { isValidUuid } = require('../../../validators/common/basic-xml-validator-service');
const { getDb } = require('../../../database');
const { parseOrderXml } = require('../../order-parser-service');
const { buildDespatchGroups } = require('../despatch-planner-service');
const { buildDespatchAdviceDocument } = require('../despatch-advice-document-builder');
const { serializeDespatchAdvice } = require('../despatch-advice-xml-serializer');

jest.mock('../../../database', () => ({
  getDb: jest.fn()
}));

jest.mock('../../../validators/common/basic-xml-validator-service', () => ({
  isValidUuid: jest.fn()
}));

jest.mock('../../../validators/order/order-xml-validator-service', () => ({
  validateOrder: jest.fn()
}));

jest.mock('../../order-parser-service', () => ({
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

  test('requestMetadata defaults to {} when not provided', async () => {
    validateOrder.mockResolvedValue(validatedOrderResult);
    fakeCollection.insertOne.mockResolvedValue({ insertedId: 'advice-uuid-default' });

    const result = await createDespatchAdvice('test-api-key', '<xml>valid</xml>');
    expect(result).toEqual({ adviceIds: ['advice-uuid-default'] });
    expect(fakeCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
      metadata: {}
    }));
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

describe('getDespatchAdviceByAdviceId', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns the found document', async () => {
    const doc = { _id: 'advice-uuid-123', apiKey: 'k1', despatchXml: '<DespatchAdvice/>' };
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(doc)
      })
    });

    const result = await getDespatchAdviceByAdviceId('k1', 'advice-uuid-123');
    expect(result).toEqual(doc);
  });

  test('rethrows database errors', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockRejectedValue(new Error('db error'))
      })
    });

    await expect(getDespatchAdviceByAdviceId('k1', 'advice-uuid-123')).rejects.toThrow('db error');
  });
});

describe('getDespatchAdviceByOrderId', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns the found document', async () => {
    const doc = { _id: 'advice-uuid-123', apiKey: 'k1', originalOrderId: 'ORD-001' };
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(doc)
      })
    });

    const result = await getDespatchAdviceByOrderId('k1', 'ORD-001');
    expect(result).toEqual(doc);
  });

  test('rethrows database errors', async () => {
    getDb.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockRejectedValue(new Error('db error'))
      })
    });

    await expect(getDespatchAdviceByOrderId('k1', 'ORD-001')).rejects.toThrow('db error');
  });
});

describe('retrieveDespatchAdvice', () => {
  const VALID_UUID = '6e09886b-dc6e-439f-82d1-7ccac7f4e3b1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 400 when search-type parameter is missing', async () => {
    const req = { query: { query: 'some-query' } };
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
    await searchDespatchAdvice(req, res, 'test-api-key');
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
      errors: expect.arrayContaining([expect.stringMatching(/search-type/)])
    }));
  });

  test('returns 400 when search-type parameter is invalid', async () => {
    const req = { query: { query: 'some-query' } };
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
    await searchDespatchAdvice(req, res, 'test-api-key', 'invalid-type');
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
      errors: expect.arrayContaining([expect.stringMatching(/search-type/)])
    }));
  });

  test('returns 400 when query parameter is missing', async () => {
    const req = { query: {} };
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
    await searchDespatchAdvice(req, res, 'test-api-key', 'advice-id');
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
      errors: expect.arrayContaining([expect.stringMatching(/query/)])
    }));
  });

  describe('search-type: advice-id', () => {
    test('returns 400 when query is not a valid UUID', async () => {
      isValidUuid.mockReturnValue(false);
      const req = { query: { query: 'not-a-uuid' } };
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
      await searchDespatchAdvice(req, res, 'test-api-key', 'advice-id');
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
        errors: expect.arrayContaining([expect.stringMatching(/UUID/)])
      }));
    });

    test('returns 404 when advice-id is not found', async () => {
      isValidUuid.mockReturnValue(true);
      getDb.mockReturnValue({
        collection: jest.fn().mockReturnValue({ findOne: jest.fn().mockResolvedValue(null) })
      });
      const req = { query: { query: VALID_UUID } };
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
      await searchDespatchAdvice(req, res, 'test-api-key', 'advice-id');
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
        errors: expect.arrayContaining([expect.stringMatching(/not found/)])
      }));
    });

    test('returns 200 with despatch-advice and advice-id when found', async () => {
      isValidUuid.mockReturnValue(true);
      getDb.mockReturnValue({
        collection: jest.fn().mockReturnValue({
          findOne: jest.fn().mockResolvedValue({ despatchXml: '<DespatchAdvice/>' })
        })
      });
      const req = { query: { query: VALID_UUID } };
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
      await searchDespatchAdvice(req, res, 'test-api-key', 'advice-id');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
        'despatch-advice': '<DespatchAdvice/>',
        'advice-id': VALID_UUID,
        'executed-at': expect.any(Number)
      }));
    });
  });

  describe('search-type: order', () => {
    const SAMPLE_ORDER_XML = '<Order><cbc:ID>ORD-001</cbc:ID></Order>';

    test('returns 400 when order XML cannot be parsed', async () => {
      parseOrderXml.mockImplementation(() => { throw new Error('XML parse error'); });
      const req = { query: { query: SAMPLE_ORDER_XML } };
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
      await searchDespatchAdvice(req, res, 'test-api-key', 'order');
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
        errors: expect.arrayContaining(['XML parse error'])
      }));
    });

    test('returns 400 when order XML fails validation', async () => {
      parseOrderXml.mockReturnValue({ tree: 'parsed' });
      validateOrder.mockResolvedValue({ success: false, errors: ['Missing required field: cbc:ID'] });
      const req = { query: { query: SAMPLE_ORDER_XML } };
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
      await searchDespatchAdvice(req, res, 'test-api-key', 'order');
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
        errors: ['Missing required field: cbc:ID']
      }));
    });

    test('returns 400 when validated order XML contains no orderId', async () => {
      parseOrderXml.mockReturnValue({ tree: 'parsed' });
      validateOrder.mockResolvedValue({ success: true, orderId: null });
      const req = { query: { query: SAMPLE_ORDER_XML } };
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
      await searchDespatchAdvice(req, res, 'test-api-key', 'order');
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
        errors: expect.arrayContaining([expect.stringMatching(/cbc:ID/)])
      }));
    });

    test('returns 404 when no despatch advice is found for the order', async () => {
      parseOrderXml.mockReturnValue({ tree: 'parsed' });
      validateOrder.mockResolvedValue({ success: true, orderId: 'ORD-001' });
      getDb.mockReturnValue({
        collection: jest.fn().mockReturnValue({ findOne: jest.fn().mockResolvedValue(null) })
      });
      const req = { query: { query: SAMPLE_ORDER_XML } };
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
      await searchDespatchAdvice(req, res, 'test-api-key', 'order');
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
        errors: expect.arrayContaining([expect.stringMatching(/not found/)])
      }));
    });

    test('returns 200 with despatch-advice and advice-id when order is found', async () => {
      parseOrderXml.mockReturnValue({ tree: 'parsed' });
      validateOrder.mockResolvedValue({ success: true, orderId: 'ORD-001' });
      getDb.mockReturnValue({
        collection: jest.fn().mockReturnValue({
          findOne: jest.fn().mockResolvedValue({ despatchXml: '<DespatchAdvice/>', _id: VALID_UUID })
        })
      });
      const req = { query: { query: SAMPLE_ORDER_XML } };
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
      await searchDespatchAdvice(req, res, 'test-api-key', 'order');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
        'despatch-advice': '<DespatchAdvice/>',
        'advice-id': VALID_UUID,
        'executed-at': expect.any(Number)
      }));
    });
  });
});
