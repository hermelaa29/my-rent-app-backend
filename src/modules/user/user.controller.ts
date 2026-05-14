import { asyncHandler } from '../../utils/async-handler.js';
import { userService } from './user.service.js';
import { AppError } from '../../utils/app-error.js';
import { inviteLesseeSchema } from '../auth/auth.types.js';
import { authService } from '../auth/auth.service.js';

function requireLessorId(req: any): string {
  const id = req.user?.id;
  if (!id) throw new AppError('Unauthorized', 401);
  return id;
}

export const userController = {
  listTenants: asyncHandler(async (req, res) => {
    const lessorId = requireLessorId(req);
    const data = await userService.listLessees(lessorId);
    res.status(200).json({ success: true, data });
  }),

  getTenantById: asyncHandler(async (req, res) => {
    const lessorId = requireLessorId(req);
    const { id } = req.params;
    if (!id) throw new AppError('Tenant ID is required', 400);
    const data = await userService.getTenantById(lessorId, id);
    if (!data) throw new AppError('Tenant not found', 404);
    res.status(200).json({ success: true, data });
  }),

  createTenant: asyncHandler(async (req, res) => {
    const lessorId = requireLessorId(req);
    const body = inviteLesseeSchema.parse(req.body);
    const result = await authService.inviteLessee(lessorId, body);
    res.status(201).json({ success: true, data: result });
  }),

  deleteTenant: asyncHandler(async (req, res) => {
    const lessorId = requireLessorId(req);
    const { id } = req.params;
    if (!id) throw new AppError('Tenant ID is required', 400);
    const result = await userService.deleteTenant(lessorId, id);
    res.status(200).json({ success: true, data: result });
  }),
};
