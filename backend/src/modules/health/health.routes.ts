import { Router } from 'express';
import { healthController } from './health.controller.js';

const router = Router();

router.get('/', healthController.getHealth);

export const healthRouter = router;
