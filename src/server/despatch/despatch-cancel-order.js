const { getDb } = require('../database');
const { validateOrderCancellationXml } = require('../validators/order-cancellation-xml-validator-service');
const { BasicXmlValidationError } = require('../validators/basic-xml-validator-service');

class CancellationNotFoundError extends Error {
  constructor(message) {
    super(message || 'Despatch advice not found');
    this.name = 'CancellationNotFoundError';
    this.statusCode = 404;
  }
}

class CancellationForbiddenError extends Error {
  constructor(message) {
    super(message || 'Unauthorised access');
    this.name = 'CancellationForbiddenError';
    this.statusCode = 403;
  }
}

/**
 * POST api/v1/despatch/cancel/order
 *
 * Finds the despatch advice by ID, verifies ownership through apiKey,
 * validates the submitted Order Cancellation XML, stores it,
 * and removes the original despatch XML.
 *
 * @param {string} apiKey - The API key from the request header
 * @param {object} metadata - Validated request metadata from buildCancelRequestMetadata
 * @param {string} metadata.adviceId - The despatch advice ID to cancel
 * @param {string} metadata.orderCancellationDocument - The submitted order cancellation XML document
 */
async function cancelDespatchAdvice(apiKey, metadata) {
  const { adviceId, orderCancellationDocument } = metadata;

  const db = getDb();
  const collection = db.collection('despatch-advice');

  const despatchAdvice = await collection.findOne({ _id: adviceId });

  if (!despatchAdvice) {
    throw new CancellationNotFoundError(`Failed to find Despatch Advice with id ${adviceId}.`);
  }

  if (despatchAdvice.apiKey !== apiKey) {
    throw new CancellationForbiddenError('Unauthorised access.');
  }

  const validatedCancellation = await validateOrderCancellationXml(orderCancellationDocument);
  if (!validatedCancellation.success) {
    throw new BasicXmlValidationError(validatedCancellation.errors, 400);
  }

  const cancellationId = validatedCancellation.id;
  const cancellationReason = validatedCancellation.cancellationNote;
  const now = new Date();

  await collection.updateOne(
    { _id: adviceId },
    {
      $set: {
        status: 'cancelled',
        cancellationXml: orderCancellationDocument,
        cancellationReason,
        cancellationId,
        cancelledAt: now
      },
      $unset: {
        despatchXml: ''
      }
    }
  );

  return {
    'order-cancellation': orderCancellationDocument,
    'order-cancellation-reason': cancellationReason,
    'order-cancellation-id': cancellationId,
    'advice-id': adviceId,
    'executed-at': now
  };
}

/**
 * GET api/v1/despatch/cancel/order
 *
 * Retrieves an existing cancellation document by advice-id or cancellation-id.
 *
 * @param {string} apiKey - The API key from the request header
 * @param {object} metadata - Validated query metadata from buildCancelRetrievalMetadata
 * @param {string} [metadata.adviceId] - The despatch advice ID to look up
 * @param {string} [metadata.cancellationId] - The cancellation ID to look up
 */
async function getCancellation(apiKey, metadata) {
  const { adviceId, cancellationId } = metadata;
 
  const db = getDb();
  const collection = db.collection('despatch-advice');
 
  const dbQuery = adviceId ? { _id: adviceId } : { cancellationId: cancellationId };
 
  const despatchAdvice = await collection.findOne(dbQuery);
 
  if (!despatchAdvice) {
    throw new CancellationNotFoundError(
      `Failed to find Despatch Advice with id ${adviceId ?? cancellationId}.`
    );
  }
 
  if (despatchAdvice.apiKey !== apiKey) {
    throw new CancellationForbiddenError('Unauthorised access.');
  }
 
  return {
    'order-cancellation': despatchAdvice.cancellationXml,
    'order-cancellation-reason': despatchAdvice.cancellationReason,
    'order-cancellation-id': despatchAdvice.cancellationId,
    'advice-id': despatchAdvice._id,
    'executed-at': new Date()
  };
}
 
module.exports = {
  cancelDespatchAdvice,
  getCancellation,
  CancellationNotFoundError,
  CancellationForbiddenError
};