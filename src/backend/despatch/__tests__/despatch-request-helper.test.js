const { RequestValidationError, buildRequestMetadata, validateXmlRequest } = require('../despatch-request-helper');

describe('buildRequestMetadata', () => {
  const baseReq = {
    headers: {
      'content-type': 'application/xml',
      'user-agent': 'TestAgent/1.0'
    },
    ip: '123.456.789.000',
    body: '<test>Valid XML</test>'
  };

  test('Valid request → returns correct shape', () => {
    const metadata = buildRequestMetadata(baseReq);
    expect(metadata).toHaveProperty('contentType', 'application/xml');
    expect(metadata).toHaveProperty('requestIp', '123.456.789.000');
    expect(metadata).toHaveProperty('userAgent', 'TestAgent/1.0');
    expect(metadata).toHaveProperty('receivedAt');
  });

  test('receivedAt is a Date instance', () => {
    const metadata = buildRequestMetadata(baseReq);
    expect(metadata.receivedAt).toBeInstanceOf(Date);
  });

  test('Missing user-agent header → userAgent: null', () => {
    const req = {
      ...baseReq,
      headers: {
        'content-type': 'application/xml'
      }
    };
    const metadata = buildRequestMetadata(req);
    expect(metadata).toHaveProperty('userAgent', null);
  });

});

describe('validateXmlRequest', () => {
  const baseReq = {
    headers: {
      'content-type': 'application/xml',
      'user-agent': 'TestAgent/1.0'
    },
    ip: '123.456.789.000',
    body: '<test>Valid XML</test>'
  };

  test('Valid request → does not throw', () => {
    expect(() => validateXmlRequest(baseReq)).not.toThrow();
  });

  test('Missing body → throws RequestValidationError', () => {
    const req = { ...baseReq, body: undefined };
    expect(() => validateXmlRequest(req)).toThrow(RequestValidationError);
  });

  test('Empty-string body → throws RequestValidationError', () => {
    const req = { ...baseReq, body: '   ' };
    expect(() => validateXmlRequest(req)).toThrow(RequestValidationError);
  });

  test('Body is not a string (null) → throws RequestValidationError', () => {
    const req = { ...baseReq, body: null };
    expect(() => validateXmlRequest(req)).toThrow(RequestValidationError);
  });

  test('Content-Type does not include xml → throws RequestValidationError', () => {
    const req = {
      ...baseReq,
      headers: { 'content-type': 'application/json', 'user-agent': 'TestAgent/1.0' }
    };
    expect(() => validateXmlRequest(req)).toThrow(RequestValidationError);
  });

  test('Missing Content-Type header → throws RequestValidationError', () => {
    const req = {
      ...baseReq,
      headers: { 'user-agent': 'TestAgent/1.0' }
    };
    expect(() => validateXmlRequest(req)).toThrow(RequestValidationError);
  });
});

describe('RequestValidationError', () => {
  test('uses default message when none is provided', () => {
    const err = new RequestValidationError();
    expect(err.message).toBe('Request validation failed');
    expect(err.name).toBe('RequestValidationError');
    expect(err.statusCode).toBe(400);
  });

  test('uses provided message when supplied', () => {
    const err = new RequestValidationError('custom error');
    expect(err.message).toBe('custom error');
  });
});

describe('buildRequestMetadata - null content-type', () => {
  test('Missing content-type header → contentType: null', () => {
    const req = {
      headers: {},
      ip: '127.0.0.1'
    };
    const metadata = buildRequestMetadata(req);
    expect(metadata.contentType).toBeNull();
    expect(metadata.userAgent).toBeNull();
  });
});