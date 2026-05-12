import cron from 'node-cron';
import { notificationService } from './modules/notifications/notifications.service.js';

export function initScheduler() {
  // Run every day at 08:00 AM
  cron.schedule('0 8 * * *', async () => {
    try {
      await notificationService.runDailyJob();
    } catch (err) {
      console.error('[Scheduler Error]', err);
    }
  });
  console.info('[Scheduler] Daily job scheduled at 08:00 AM');
}
