import type { NextFunction, Request, Response } from 'express';
import { reminderService } from './reminder.service.js';

export const reminderController = {
  async runDailyJob(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await reminderService.runDailyReminderJob();
      res.json({
        message: 'Daily reminder job completed',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async getReminders(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const reminders = await reminderService.getRemindersForUser(req.user.id, req.user.role);
      res.json({ data: reminders });
    } catch (error) {
      next(error);
    }
  },

  async getRemindersByContract(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const { contractId } = req.params;
      if (!contractId) {
        res.status(400).json({ message: 'Contract ID is required' });
        return;
      }
      const reminders = await reminderService.getRemindersForContract(contractId, req.user.id, req.user.role);
      res.json({ data: reminders });
    } catch (error) {
      next(error);
    }
  },
};
