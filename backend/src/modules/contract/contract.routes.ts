import { Router } from 'express';
import { UserRole } from '../../types/user-role.js';
import { verifyToken, requireRole } from '../../middleware/auth.middleware.js';
import { contractController } from './contract.controller.js';

const router = Router();

router.use(verifyToken);

router.post('/', requireRole(UserRole.LESSOR), contractController.create);
router.get('/', contractController.list);
router.get('/active', contractController.listActive);
router.patch('/:id/end', requireRole(UserRole.LESSOR), contractController.end);
router.patch('/:id/renew', requireRole(UserRole.LESSOR), contractController.renew);
router.patch('/:id/archive', requireRole(UserRole.LESSOR), contractController.archive);
router.get('/:id', contractController.getById);

export const contractRouter = router;
