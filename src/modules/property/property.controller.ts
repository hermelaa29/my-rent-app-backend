import { AppError } from '../../utils/app-error.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  createPropertySchema,
  propertyIdParamSchema,
  updatePropertySchema,
} from './property.types.js';
import { propertyService } from './property.service.js';

function requireUserId(req: { user?: { id: string } }): string {
  const id = req.user?.id;
  if (id === undefined) {
    throw new AppError('Authentication required', 401);
  }
  return id;
}

export const propertyController = {
  create: asyncHandler(async (req, res) => {
    const lessorId = requireUserId(req);
    const body = createPropertySchema.parse(req.body);
    const data = await propertyService.create(lessorId, body);
    res.status(201).json({ success: true, data });
  }),

  list: asyncHandler(async (req, res) => {
    const lessorId = requireUserId(req);
    const data = await propertyService.listByLessor(lessorId);
    res.status(200).json({ success: true, data });
  }),

  getById: asyncHandler(async (req, res) => {
    const lessorId = requireUserId(req);
    const { id } = propertyIdParamSchema.parse(req.params);
    const data = await propertyService.getByIdForLessor(lessorId, id);
    res.status(200).json({ success: true, data });
  }),

  update: asyncHandler(async (req, res) => {
    const lessorId = requireUserId(req);
    const { id } = propertyIdParamSchema.parse(req.params);
    const body = updatePropertySchema.parse(req.body);
    const data = await propertyService.updateForLessor(lessorId, id, body);
    res.status(200).json({ success: true, data });
  }),

  delete: asyncHandler(async (req, res) => {
    const lessorId = requireUserId(req);
    const { id } = propertyIdParamSchema.parse(req.params);
    const data = await propertyService.deleteForLessor(lessorId, id);
    res.status(200).json({ success: true, data });
  }),
};
