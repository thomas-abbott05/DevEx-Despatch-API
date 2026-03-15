const { RequestValidationError } = require('./despatch-request-helper');
const { isValidUuidV4 } = require('../validators/basic-xml-validator-service');

/**
 * Validates and extracts fields from the POST /despatch/cancel/fulfilment request body.
 * Expects a JSON body with advice-id and fulfilment-cancellation-reason fields.
 */
function buildFulfilmentCancelRequestMetadata(req) {
  const body = req.body;

  if (!body || typeof body !== 'object') {
    throw new RequestValidationError('Request body must be a JSON object');
  }

  const adviceId = body['advice-id'];
  const cancellationReason = body['fulfilment-cancellation-reason'];

  if (!adviceId || typeof adviceId !== 'string' || adviceId.trim() === '') {
    throw new RequestValidationError('Missing required field: advice-id');
  }

  if (!isValidUuidV4(adviceId.trim())) {
    throw new RequestValidationError('Invalid advice-id: must be a valid v4 UUID');
  }

  if (!cancellationReason || typeof cancellationReason !== 'string' || cancellationReason.trim() === '') {
    throw new RequestValidationError('Missing required field: fulfilment-cancellation-reason');
  }

  return {
    adviceId: adviceId.trim(),
    cancellationReason: cancellationReason.trim()
  };
}

/**
 * Validates and extracts query params from the GET /despatch/cancel/fulfilment request.
 * Expects either ?id=<advice-id> or ?fulfilment-cancellation-id=<id>.
 */
function buildFulfilmentCancelRetrievalMetadata(req) {
  const query = req.query;

  if (query['id']) {
    if (!isValidUuidV4(query['id'])) {
      throw new RequestValidationError('Invalid advice-id: must be a valid v4 UUID');
    }
    return { adviceId: query['id'] };
  }

  if (query['fulfilment-cancellation-id']) {
    if (!isValidUuidV4(query['fulfilment-cancellation-id'])) {
      throw new RequestValidationError('Invalid fulfilment-cancellation-id: must be a valid v4 UUID');
    }
    return { fulfilmentCancellationId: query['fulfilment-cancellation-id'] };
  }

  throw new RequestValidationError('Missing required query parameter: id or fulfilment-cancellation-id');
}

module.exports = {
  buildFulfilmentCancelRequestMetadata,
  buildFulfilmentCancelRetrievalMetadata
};