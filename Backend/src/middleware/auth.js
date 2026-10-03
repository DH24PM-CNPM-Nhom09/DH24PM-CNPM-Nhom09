const jwt = require('jsonwebtoken');
const { AppError } = require('../utils/errors');

function createAuth(jwtSecret) {
  function authenticate(req, _res, next) {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return next(new AppError(401, 'UNAUTHENTICATED', 'Thiếu hoặc sai Bearer token'));
    }
    try {
      const payload = jwt.verify(token, jwtSecret);
      req.user = { id: Number(payload.sub), role: payload.role };
      return next();
    } catch {
      return next(new AppError(401, 'INVALID_TOKEN', 'Token không hợp lệ hoặc đã hết hạn'));
    }
  }

  const requireRole = (...roles) => (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này'));
    }
    return next();
  };

  return { authenticate, requireRole };
}

module.exports = { createAuth };
