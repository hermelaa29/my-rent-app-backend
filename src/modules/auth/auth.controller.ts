import { AppError } from '../../utils/app-error.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  inviteLesseeSchema,
  lesseeLoginSchema,
  lessorLoginSchema,
  setPasswordSchema,
  verifyOtpSchema,
} from './auth.types.js';
import { authService } from './auth.service.js';

export const authController = {
  lessorLogin: asyncHandler(async (req, res) => {
    const body = lessorLoginSchema.parse(req.body);
    const data = await authService.lessorLogin(body);
    res.status(200).json({ success: true, data });
  }),

  lesseeLogin: asyncHandler(async (req, res) => {
    const body = lesseeLoginSchema.parse(req.body);
    const data = await authService.lesseeLogin(body);
    res.status(200).json({ success: true, data });
  }),

  inviteLessee: asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (userId === undefined) {
      throw new AppError('Authentication required', 401);
    }
    const body = inviteLesseeSchema.parse(req.body);
    const data = await authService.inviteLessee(userId, body);
    res.status(201).json({ success: true, data });
  }),

  verifyOtp: asyncHandler(async (req, res) => {
    const body = verifyOtpSchema.parse(req.body);
    const data = await authService.verifyOtp(body);
    res.status(200).json({ success: true, data });
  }),

  setPassword: asyncHandler(async (req, res) => {
    const body = setPasswordSchema.parse(req.body);
    const data = await authService.setPassword(body);
    res.status(200).json({ success: true, data });
  }),
};
