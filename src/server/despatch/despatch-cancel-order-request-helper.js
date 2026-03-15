const { RequestValidationError } = require('./despatch-request-helper');
const { isValidUuidV4 } = require('../validators/basic-xml-validator-service');

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

  if (!isValidUuidV4(adviceId.trim())) {
    throw new RequestValidationError('Invalid advice-id: must be a valid v4 UUID', 400);
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
 */
function buildCancelRetrievalMetadata(req) {
  const query = req.query;
 
  if (query['id']) {
    if (!isValidUuidV4(query['id'])) {
      throw new RequestValidationError('Invalid advice-id: must be a valid v4 UUID', 400);
    }
    return { adviceId: query['id'] };
  }
 
  if (query['cancellation-id']) {
    if (!isValidUuidV4(query['cancellation-id'])) {
      throw new RequestValidationError('Invalid cancellation-id: must be a valid v4 UUID', 400);
    }
    return { cancellationId: query['cancellation-id'] };
  }
  
  throw new RequestValidationError('Missing required query parameter: id or cancellation-id', 400);
}

module.exports = {
  buildCancelRequestMetadata,
  buildCancelRetrievalMetadata
};