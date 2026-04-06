function requireSessionAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      errors: ['Not authenticated. Please log in.'],
      'executed-at': Math.floor(Date.now() / 1000)
    });
  }

  return next();
}

module.exports = requireSessionAuth;
