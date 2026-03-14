const { RequestValidationError } = require('./despatch-request-helper');
const { isValidUuidV4 } = require('../validators/order-xml-validator-service');

/**
 * Validates and extracts fields from the POST api/v1/despatch/cancel/order request body.
 * Expects a JSON body with advice-id and order-cancellation-document fields.
 */
function buildCancelRequestMetadata(req) {
  const body = req.body;

  if (!body || typeof body !== 'object') {
    throw new RequestValidationError('Request body must be a JSON object');
  }

  const adviceId = body['advice-id'];
  const orderCancellationDocument = body['order-cancellation-document'];

  if (!adviceId || typeof adviceId !== 'string' || adviceId.trim() === '') {
    throw new RequestValidationError('Missing required field: advice-id');
  }

  if (!isValidUuidV4(adviceId.trim())) {
    throw new RequestValidationError('Invalid advice-id: must be a valid v4 UUID');
  }

  if (!orderCancellationDocument || typeof orderCancellationDocument !== 'string' || orderCancellationDocument.trim() === '') {
    throw new RequestValidationError('Missing required field: order-cancellation-document');
  }

  return {
    adviceId: adviceId.trim(),
    orderCancellationDocument: orderCancellationDocument.trim()
  };
}

module.exports = {
  buildCancelRequestMetadata
};