const requireSessionAuth = require('../session-auth');

describe('requireSessionAuth middleware', () => {
  test('calls next() when session and userId are present', () => {
    const req = { session: { userId: 'user-123' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    requireSessionAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('returns 401 when session is null', () => {
    const req = { session: null };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    requireSessionAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      errors: expect.arrayContaining(['Not authenticated. Please log in.']),
      'executed-at': expect.any(Number)
    }));
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when session exists but userId is absent', () => {
    const req = { session: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    requireSessionAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      errors: expect.arrayContaining(['Not authenticated. Please log in.']),
      'executed-at': expect.any(Number)
    }));
    expect(next).not.toHaveBeenCalled();
  });
});
