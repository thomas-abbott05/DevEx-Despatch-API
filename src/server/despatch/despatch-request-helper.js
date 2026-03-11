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

module.exports = {
  RequestValidationError,
  buildRequestMetadata,
  validateXmlRequest
};