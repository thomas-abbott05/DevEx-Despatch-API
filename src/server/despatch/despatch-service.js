// despatch-service.js
const { getDb } = require('../database');
const { validateOrderXml } = require('../validators/despatch-validator-service');
const { buildMockDespatchAdviceXml } = require('./despatch-service-helper');

async function listDespatchAdvices(apiKey) {
  try {
    const db = getDb();
    const collection = db.collection('despatch-advices');
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

async function createDespatchAdvice(apiKey, orderXml, requestMetadata = {}) {
  try {
    const db = getDb();
    const collection = db.collection('despatch-advice');
    const now = new Date();

    // Validate the raw XML using the despatch validator service
    const validationResult = await validateOrderXml(orderXml, requestMetadata);
    if (!validationResult.success) {
      throw new Error(`Despatch advice validation failed: ${validationResult.errors.join(', ')}`);
    }
    if (!validationResult.id) {
      throw new Error('Despatch advice validation failed: Missing Order UUID');
    }

    // Temporary mock transformation: build despatch advice from template and validated order fields.
    const despatchXml = buildMockDespatchAdviceXml(validationResult);

    // Reuse the validated Order UUID for deterministic despatch advice identifiers.
    const despatchAdviceId = validationResult.id;

    const result = await collection.insertOne({
      _id: despatchAdviceId,
      apiKey,
      despatchXml,
      metadata: {
        ...requestMetadata,
        receivedAt: now
      },
      createdAt: now
    });

    return {
      adviceId: result.insertedId,
      despatchXml
    };
  } catch (error) {
    console.error('Error creating despatch advice:', error);
    throw error;
  }
}

async function retrieveDespatchAdvice(apiKey, requestMetadata = {}) {
  try {
    const db = getDb();
    const collection = db.collection('despatch-advices');
    // Build the query object based on the provided request metadata
    const dbQuery = { apiKey };

    if (requestMetadata.id) {
      dbQuery._id = requestMetadata.id;
    } else if (requestMetadata.orderId) {
      dbQuery['metadata.orderId'] = requestMetadata.orderId;
    } else if (requestMetadata.receiptAdviceId) {
      dbQuery['metadata.receiptAdviceId'] = requestMetadata.receiptAdviceId;
    } else if (requestMetadata.orderLine) {
      dbQuery['metadata.orderLines'] = requestMetadata.orderLine;
    } else if (requestMetadata.despatchLine) {
      dbQuery['metadata.despatchLines'] = requestMetadata.despatchLine;
    } else {
      throw new Error('At least one query parameter must be provided');
    }

    const despatchAdvice = await collection.findOne(dbQuery);
    return despatchAdvice;
  } catch (error) {
    console.error('Error retrieving despatch advice:', error);
    throw error;
  }
}

module.exports = {
  listDespatchAdvices,
  createDespatchAdvice,
  retrieveDespatchAdvice
};