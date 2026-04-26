import type { UserRole } from '@prisma/client';
import { AppError } from '../../utils/app-error.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { contractIdParamSchema, createContractSchema } from './contract.types.js';
import { contractService } from './contract.service.js';

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

export const contractController = {
  create: asyncHandler(async (req, res) => {
    const { id: lessorId } = requireUser(req);
    const body = createContractSchema.parse(req.body);
    const data = await contractService.create(lessorId, body);
    res.status(201).json({ success: true, data });
  }),

  list: asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const data = await contractService.listForUser(user.id, user.role);
    res.status(200).json({ success: true, data });
  }),

  getById: asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const { id } = contractIdParamSchema.parse(req.params);
    const data = await contractService.getByIdForUser(user.id, user.role, id);
    res.status(200).json({ success: true, data });
  }),

  end: asyncHandler(async (req, res) => {
    const { id: lessorId } = requireUser(req);
    const { id } = contractIdParamSchema.parse(req.params);
    const data = await contractService.endByLessor(lessorId, id);
    res.status(200).json({ success: true, data });
  }),

  renew: asyncHandler(async (req, res) => {
    const { id: lessorId } = requireUser(req);
    const { id } = contractIdParamSchema.parse(req.params);
    const body = req.body; // Validation can be added here or in service
    const data = await contractService.renewByLessor(lessorId, id, body);
    res.status(200).json({ success: true, data });
  }),

  listActive: asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const data = await contractService.listActiveForUser(user.id, user.role);
    res.status(200).json({ success: true, data });
  }),

  archive: asyncHandler(async (req, res) => {
    const { id: lessorId } = requireUser(req);
    const { id } = contractIdParamSchema.parse(req.params);
    const data = await contractService.archiveByLessor(lessorId, id);
    res.status(200).json({ success: true, data });
  }),
};
