import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { errorHandlerMiddleware } from './middleware/error-handler.middleware.js';
import { notFoundMiddleware } from './middleware/not-found.middleware.js';
import { authRouter } from './modules/auth/index.js';
import { contractRouter } from './modules/contract/index.js';
import { healthRouter } from './modules/health/index.js';
import { paymentRouter } from './modules/payments/index.js';
import { propertyRouter } from './modules/property/index.js';
import { analyticsRouter } from './modules/analytics/analytics.routes.js';
import { notificationRouter } from './modules/notifications/notifications.routes.js';
import { userRouter } from './modules/user/user.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use('/health', healthRouter);
  app.use('/auth', authRouter);
  app.use('/users', userRouter);
  app.use('/properties', propertyRouter);
  app.use('/contracts', contractRouter);
  app.use('/payments', paymentRouter);
  app.use('/analytics', analyticsRouter);
  app.use('/notifications', notificationRouter);
  app.use('/uploads', express.static('uploads'));

  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
}
