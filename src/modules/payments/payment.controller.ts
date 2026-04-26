import type { UserRole } from '@prisma/client';
import { AppError } from '../../utils/app-error.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  chapaInitSchema,
  createPaymentSchema,
  paymentIdParamSchema,
} from './payment.types.js';
import { paymentService } from './payment.service.js';

function requireUser(req: { user?: { id: string; role: UserRole } }): {
  id: string;
  role: UserRole;
} {
  const user = req.user;
  if (user === undefined) {
    throw new AppError('Authentication required', 401);
  }
  return user;
}

export const paymentController = {
  create: asyncHandler(async (req, res) => {
    const { id: lesseeId } = requireUser(req);
    const body = createPaymentSchema.parse(req.body);
    const data = await paymentService.create(lesseeId, body);
    res.status(201).json({ success: true, data });
  }),

  initChapa: asyncHandler(async (req, res) => {
    const { id: lesseeId } = requireUser(req);
    const body = chapaInitSchema.parse(req.body);
    const data = await paymentService.initChapa(lesseeId, body);
    res.status(201).json({ success: true, data });
  }),

  uploadProof: asyncHandler(async (req, res) => {
    const { id: lesseeId } = requireUser(req);
    const { id } = paymentIdParamSchema.parse(req.params);
    const file = req.file;
    if (file === undefined) {
      throw new AppError('proof image is required', 400);
    }
    const proofImageURL = `/uploads/payment-proofs/${file.filename}`;
    const data = await paymentService.uploadProof(lesseeId, id, proofImageURL);
    res.status(200).json({ success: true, data });
  }),

  approve: asyncHandler(async (req, res) => {
    const { id: lessorId } = requireUser(req);
    const { id } = paymentIdParamSchema.parse(req.params);
    const data = await paymentService.approve(lessorId, id);
    res.status(200).json({ success: true, data });
  }),

  reject: asyncHandler(async (req, res) => {
    const { id: lessorId } = requireUser(req);
    const { id } = paymentIdParamSchema.parse(req.params);
    const data = await paymentService.reject(lessorId, id);
    res.status(200).json({ success: true, data });
  }),

  list: asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const data = await paymentService.listForUser(user.id, user.role, page, limit);
    res.status(200).json({ success: true, data });
  }),

  exportPdf: asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const doc = await paymentService.exportPaymentsPdf(user.id, user.role);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=payments.pdf');
    
    doc.pipe(res);
  }),

  listForContract: asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const { contractId } = req.params;
    if (!contractId) throw new AppError('Contract ID is required', 400);
    const data = await paymentService.listForContract(user.id, user.role, contractId);
    res.status(200).json({ success: true, data });
  }),

  listForLessor: asyncHandler(async (req, res) => {
    const { id: lessorId } = requireUser(req);
    const data = await paymentService.listForLessor(lessorId);
    res.status(200).json({ success: true, data });
  }),

  summary: asyncHandler(async (req, res) => {
    const { id: lessorId } = requireUser(req);
    const data = await paymentService.getSummary(lessorId);
    res.status(200).json({ success: true, data });
  }),

  getById: asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const { id } = paymentIdParamSchema.parse(req.params);
    const data = await paymentService.getByIdForUser(user.id, user.role, id);
    res.status(200).json({ success: true, data });
  }),
};
