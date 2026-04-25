import { Router } from 'express';
import { verifyToken } from '../../middleware/auth.middleware.js';
import { reminderController } from './reminder.controller.js';

export const reminderRouter = Router();

reminderRouter.use(verifyToken);

reminderRouter.post('/run', reminderController.runDailyJob);
reminderRouter.get('/', reminderController.getReminders);
reminderRouter.get('/:contractId', reminderController.getRemindersByContract);
