// despatch-service.js
const { getDb } = require('../database');
const { validateDespatchAdvice } = require('../validators/despatch-validator-service');

async function createDespatchAdvice(apiKey, rawXml, requestMetadata = {}) {
  try {
    const db = getDb();
    const collection = db.collection('despatch-advices');
    const now = new Date();

    // Validate the raw XML using the despatch validator service
    const validationResult = await validateDespatchAdvice(rawXml, requestMetadata);
    if (!validationResult.success) {
      throw new Error(`Despatch advice validation failed: ${validationResult.errors.join(', ')}`);
    }

    const result = await collection.insertOne({
      apiKey,
      rawXml,
      metadata: {
        ...requestMetadata,
        receivedAt: now
      },
      createdAt: now
    });

    return result.insertedId;
  } catch (error) {
    console.error('Error creating despatch advice:', error);
    throw error;
  }
}

module.exports = {
  createDespatchAdvice
};
