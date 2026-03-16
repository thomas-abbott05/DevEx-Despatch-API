const { RequestValidationError } = require('./despatch-request-helper');
const { isValidUuid } = require('../validators/basic-xml-validator-service');

/**
 * Validates and extracts fields from the POST api/v1/despatch/cancel/order request body.
 * Expects a JSON body with advice-id and order-cancellation-document fields.
 */
function buildCancelRequestMetadata(req) {
  const body = req.body;

  if (!body || typeof body !== 'object') {
    throw new RequestValidationError('Request body must be a JSON object', 400);
  }

  const adviceId = body['advice-id'];
  const orderCancellationDocument = body['order-cancellation-document'];

  if (!adviceId || typeof adviceId !== 'string' || adviceId.trim() === '') {
    throw new RequestValidationError('Missing required field: advice-id', 400);
  }

  if (!isValidUuid(adviceId.trim())) {
    throw new RequestValidationError('Invalid advice-id: must be a valid UUID', 400);
  }

  if (!orderCancellationDocument || typeof orderCancellationDocument !== 'string' || orderCancellationDocument.trim() === '') {
    throw new RequestValidationError('Missing required field: order-cancellation-document', 400);
  }

  return {
    adviceId: adviceId.trim(),
    orderCancellationDocument: orderCancellationDocument.trim()
  };
}

/**
 * Validates and extracts query params from the GET api/v1/despatch/cancel/order request.
 * Expects either ?id=<advice-id> or ?cancellation-id=<cancellation-id>.
 * Also accepts ?advice-id=<advice-id> for compatibility.
 */
function buildCancelRetrievalMetadata(req) {
  const query = req.query;
  const adviceId = query['advice-id'];
 
  if (adviceId !== undefined) {
    if (!isValidUuid(adviceId)) {
      throw new RequestValidationError('Invalid advice-id: must be a valid UUID', 400);
    }
    return { adviceId };
  }
 
  const cancellationId = query['cancellation-id'];

  if (cancellationId !== undefined) {
    if (!isValidUuid(cancellationId)) {
      throw new RequestValidationError('Invalid cancellation-id: must be a valid UUID', 400);
    }
    return { cancellationId };
  }
  
  throw new RequestValidationError('Missing required query parameter: id or cancellation-id', 400);
}

module.exports = {
  buildCancelRequestMetadata,
  buildCancelRetrievalMetadata
};