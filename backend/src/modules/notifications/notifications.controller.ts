import { asyncHandler } from '../../utils/async-handler.js';
import { AppError } from '../../utils/app-error.js';
import { notificationService } from './notifications.service.js';

export const notificationController = {
  list: asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user) throw new AppError('Unauthorized', 401);
    
    const data = await notificationService.getNotifications(user.id);
    res.status(200).json({ success: true, data });
  }),

  runCron: asyncHandler(async (_req, res) => {
    await notificationService.runDailyJob();
    res.status(200).json({ success: true, message: 'Cron job executed manually' });
  }),
};
