import { mkdirSync } from 'node:fs';
import { extname } from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { verifyToken, requireRole } from '../../middleware/auth.middleware.js';
import { UserRole } from '../../types/user-role.js';
import { AppError } from '../../utils/app-error.js';
import { paymentController } from './payment.controller.js';

const uploadDir = 'uploads/payment-proofs';
mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const stamp = Date.now();
      const random = Math.random().toString(36).slice(2, 10);
      cb(null, `${stamp}-${random}${extname(file.originalname)}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new AppError('Only image files are allowed', 400));
      return;
    }
    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const router = Router();

router.use(verifyToken);

router.post('/', requireRole(UserRole.LESSEE), paymentController.create);
router.post('/chapa/init', requireRole(UserRole.LESSEE), paymentController.initChapa);
router.post(
  '/:id/proof',
  requireRole(UserRole.LESSEE),
  upload.single('proof'),
  paymentController.uploadProof,
);
router.post('/:id/approve', requireRole(UserRole.LESSOR), paymentController.approve);
router.post('/:id/reject', requireRole(UserRole.LESSOR), paymentController.reject);
router.get('/summary', paymentController.summary);
router.get('/contract/:contractId', paymentController.getByContract);
router.get('/', paymentController.list);
router.get('/:id', paymentController.getById);

export const paymentRouter = router;
