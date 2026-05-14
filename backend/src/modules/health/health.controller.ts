import type { RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';

const health: RequestHandler = (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
  });
};

export const healthController = {
  getHealth: asyncHandler(health),
};
