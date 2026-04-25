import { Router } from 'express';
import { UserRole } from '../../types/user-role.js';
import { verifyToken, requireRole } from '../../middleware/auth.middleware.js';
import { contractController } from './contract.controller.js';

const router = Router();

router.use(verifyToken);

router.post('/', requireRole(UserRole.LESSOR), contractController.create);
router.get('/', contractController.list);
router.post('/:id/end', requireRole(UserRole.LESSOR), contractController.end);
router.get('/:id', contractController.getById);

export const contractRouter = router;
