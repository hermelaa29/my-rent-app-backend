import { Router } from 'express';
import { UserRole } from '../../types/user-role.js';
import { verifyToken, requireRole } from '../../middleware/auth.middleware.js';
import { authController } from './auth.controller.js';

const router = Router();

router.post('/lessor/login', authController.lessorLogin);
router.post('/lessor/signup', authController.lessorSignup);
router.post('/tenant/signup', authController.tenantSignup);


router.post('/lessee/login', authController.lesseeLogin);
router.post('/verify-otp', authController.verifyOtp);
router.post('/set-password', authController.setPassword);
router.post('/tenant/activate', authController.activateTenant);
router.post('/tenant/set-password', authController.activateTenant); // Alias for convenience or handle separately
router.post(
  '/invite-lessee',
  verifyToken,
  requireRole(UserRole.LESSOR),
  authController.inviteLessee,
);

export const authRouter = router;
