import { Router } from 'express';
import { UserRole } from '../../types/user-role.js';
import { verifyToken, requireRole } from '../../middleware/auth.middleware.js';
import { userController } from './user.controller.js';

const router = Router();

router.use(verifyToken);
router.use(requireRole(UserRole.LESSOR));

router.get('/tenants', userController.listTenants);
router.post('/tenants', userController.createTenant);
router.get('/tenants/:id', userController.getTenantById);
router.delete('/tenants/:id', userController.deleteTenant);

export const userRouter = router;
