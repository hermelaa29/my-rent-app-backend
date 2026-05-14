import { Router } from 'express';
import { UserRole } from '../../types/user-role.js';
import { verifyToken, requireRole } from '../../middleware/auth.middleware.js';
import { propertyController } from './property.controller.js';

const router = Router();

router.use(verifyToken);

router.post('/', requireRole(UserRole.LESSOR), propertyController.create);
router.get('/', requireRole(UserRole.LESSOR), propertyController.list);
router.get('/:id', requireRole(UserRole.LESSOR), propertyController.getById);
router.put('/:id', requireRole(UserRole.LESSOR), propertyController.update);
router.patch('/:id/toggle', requireRole(UserRole.LESSOR), propertyController.toggleAvailability);
router.delete('/:id', requireRole(UserRole.LESSOR), propertyController.delete);

export const propertyRouter = router;
