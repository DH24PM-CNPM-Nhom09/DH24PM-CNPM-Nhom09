const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createAuth } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const { AppError } = require('./utils/errors');
const { createAuthService, defaultGoogleVerifier } = require('./modules/auth/auth.service');
const { createAuthRouter } = require('./modules/auth/auth.routes');
const { createApplicationService } = require('./modules/applications/application.service');
const { createApplicationRouter } = require('./modules/applications/application.routes');
const { createPaymentService } = require('./modules/payments/payment.service');
const { createPaymentRouter } = require('./modules/payments/payment.routes');

function createApp({ prisma, config, googleVerifier }) {
  if (!config.jwtSecret) throw new Error('Thiếu JWT_SECRET');

  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));

  const auth = createAuth(config.jwtSecret);
  const authService = createAuthService({
    prisma,
    googleVerifier: googleVerifier || defaultGoogleVerifier(config.googleClientId),
    jwtSecret: config.jwtSecret,
    jwtExpiresIn: config.jwtExpiresIn,
  });
  const applicationService = createApplicationService({ prisma });
  const paymentService = createPaymentService({ prisma, fee: config.applicationFee });

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/v1/auth', createAuthRouter({ service: authService, auth }));
  app.use('/api/v1/applications', createApplicationRouter({ service: applicationService, auth }));
  app.use('/api/v1', createPaymentRouter({ service: paymentService, auth }));

  app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Không tìm thấy đường dẫn')));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
