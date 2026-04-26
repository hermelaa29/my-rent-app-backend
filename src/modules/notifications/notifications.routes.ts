import { Router } from 'express';
import { UserRole } from '../../types/user-role.js';
import { verifyToken, requireRole } from '../../middleware/auth.middleware.js';
import { notificationController } from './notifications.controller.js';

const router = Router();

router.use(verifyToken);
router.get('/', requireRole(UserRole.LESSOR), notificationController.list);
router.post('/run-cron', requireRole(UserRole.LESSOR), notificationController.runCron);

export const notificationRouter = router;
