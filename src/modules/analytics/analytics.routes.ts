import { Router } from 'express';
import { UserRole } from '../../types/user-role.js';
import { verifyToken, requireRole } from '../../middleware/auth.middleware.js';
import { analyticsController } from './analytics.controller.js';

const router = Router();

router.use(verifyToken);
router.get('/overview', requireRole(UserRole.LESSOR), analyticsController.overview);

export const analyticsRouter = router;
