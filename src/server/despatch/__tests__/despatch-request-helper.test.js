const { RequestValidationError, buildRequestMetadata } = require('../despatch-request-helper');

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

  test('Missing body → throws RequestValidationError', () => {
    const req = {
      ...baseReq,
      body: undefined
    };
    expect(() => buildRequestMetadata(req)).toThrow(RequestValidationError);
  });

  test('Empty-string body → throws RequestValidationError', () => {
    const req = {
      ...baseReq,
      body: '   '
    };
    expect(() => buildRequestMetadata(req)).toThrow(RequestValidationError);
  });

  test('Body is not a string (null) → throws RequestValidationError', () => {
    const req = {
      ...baseReq,
      body: null
    };
    expect(() => buildRequestMetadata(req)).toThrow(RequestValidationError);
  });

  test('Content-type does not include xml → throws RequestValidationError', () => {
    const req = {
      ...baseReq,
      headers: {
        'content-type': 'application/json',
        'user-agent': 'TestAgent/1.0'
      }
    };
    expect(() => buildRequestMetadata(req)).toThrow(RequestValidationError);
  });
});