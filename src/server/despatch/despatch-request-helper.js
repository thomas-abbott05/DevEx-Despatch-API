class RequestValidationError extends Error {
  constructor(message) {
    super(message || 'Request validation failed');
    this.name = 'RequestValidationError';
    this.statusCode = 400;
  }
}
function buildRequestMetadata(req) {
  validateXmlRequest(req);
  return {
    contentType: req.headers['content-type'] || null,
    requestIp: req.ip,
    userAgent: req.headers['user-agent'] || null,
    receivedAt: new Date()
  };
}

function validateXmlRequest(req) {
  const rawXml = req.body;
  const contentType = req.headers['content-type'] || '';

  if (!rawXml || typeof rawXml !== 'string' || rawXml.trim() === '') {
    throw new RequestValidationError('Request body must contain raw XML data');
  }
  if (!contentType || !contentType.includes('xml')) {
    throw new RequestValidationError('Content-Type must be application/xml or text/xml');
  }
}

function buildDespatchRetrievalMetadata(req) {
  const query = req.query;
  const metadata = {};

  if (query['id']) {
    metadata.id = query['id'];
    // must be valid v4 UUID.
    if (!isValidUuidV4(metadata.id)) {
      throw new RequestValidationError('Invalid despatch advice ID');
    }
  } else if (query['order-id']) {
    metadata.orderId = query['order-id'];
  } else if (query['receipt-advice-id']) {
    metadata.receiptAdviceId = query['receipt-advice-id'];
  } else if (query['order-line']) {
    metadata.orderLine = query['order-line'];
  } else if (query['despatch-line']) {
    metadata.despatchLine = query['despatch-line'];
  } else {
    throw new RequestValidationError('At least one query parameter must be provided');
  }

  return metadata;
}

module.exports = {
  RequestValidationError,
  buildRequestMetadata,
  validateXmlRequest,
  buildDespatchRetrievalMetadata
};