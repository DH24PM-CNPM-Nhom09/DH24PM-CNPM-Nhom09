require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  applicationFee: Number(process.env.APPLICATION_FEE) || 500000,
  corsOrigin: process.env.CORS_ORIGIN || '*',
};
