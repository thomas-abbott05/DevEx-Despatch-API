// despatch-service.js
const { getDb } = require('../database');
const { validateOrder } = require('../validators/order-xml-validator-service');
const { parseOrderXml } = require('./order-parser-service');
const { buildDespatchGroups } = require('./despatch-planner-service');
const { buildDespatchAdviceDocument } = require('./despatch-advice-document-builder');
const { serializeDespatchAdvice } = require('./despatch-advice-xml-serializer');
const { RequestValidationError } = require('./despatch-request-helper');


async function listDespatchAdvices(apiKey) {
  try {
    const db = getDb();
    const collection = db.collection('despatch-advice');
    const despatchAdvices = await collection.find({ apiKey: apiKey }).toArray();
    const mappedDespatchAdvices = despatchAdvices.map(da => ({
      "advice-id": da._id,
      "despatch-advice": da
    }));
    return mappedDespatchAdvices;
  } catch (error) {
    console.error('Error fetching despatch advices:', error);
    throw error;
  }
}

async function createDespatchAdvice(apiKey, incomingOrderXml, requestMetadata = {}) {
  try {
    const db = getDb();
    const collection = db.collection('despatch-advice');

    const parsedOrderTree = parseOrderXml(incomingOrderXml);
    const validatedOrder = await validateOrder(parsedOrderTree);
    if (!validatedOrder.success) {
      throw new RequestValidationError(`Despatch advice validation failed: ${validatedOrder.errors.join(', ')}`);
    }

    const despatchGroups = buildDespatchGroups(parsedOrderTree);

    const adviceIds = [];
    for (const despatchGroup of despatchGroups) {
      const despatchAdviceDocument = buildDespatchAdviceDocument(parsedOrderTree, despatchGroup);
      const despatchAdviceXml = serializeDespatchAdvice(despatchAdviceDocument);
      const despatchAdviceId = despatchAdviceDocument?.DespatchAdvice?.['cbc:UUID'];

      if (!despatchAdviceId) {
        throw new RequestValidationError('Despatch advice generation failed: Missing generated advice UUID');
      }

      const result = await collection.insertOne({
        _id: despatchAdviceId,
        apiKey,
        originalOrderId: validatedOrder.orderId,
        despatchXml: despatchAdviceXml,
        metadata: {
          ...requestMetadata
        },
        createdAt: new Date()
      });

      adviceIds.push(result.insertedId);
    }

    return { adviceIds };
  } catch (error) {
    console.error('Error creating despatch advice:', error);
    throw error;
  }
}

async function getDespatchAdviceById(apiKey, adviceId) {
  try {
    const db = getDb();
    const collection = db.collection('despatch-advice');
    const despatchAdvice = await collection.findOne({ _id: adviceId, apiKey: apiKey });
    return despatchAdvice;
  } catch (error) {
    console.error(`Error fetching despatch advice with ID ${adviceId}:`, error);
    throw error;
  }
}

module.exports = {
  createDespatchAdvice,
  listDespatchAdvices,
  getDespatchAdviceById
};