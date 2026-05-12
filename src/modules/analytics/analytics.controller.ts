import { asyncHandler } from '../../utils/async-handler.js';
import { AppError } from '../../utils/app-error.js';
import { analyticsService } from './analytics.service.js';

export const analyticsController = {
  overview: asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user) throw new AppError('Unauthorized', 401);
    
    const data = await analyticsService.getOverview(user.id);
    res.status(200).json({ success: true, data });
  }),
};
