import { z } from 'zod';
import type { UserRole } from '../../types/user-role.js';

export const JWT_ACCESS_TYP = 'access' as const;
export const JWT_SETUP_TYP = 'password_setup' as const;

export interface AccessJwtPayload {
  sub: string;
  role: UserRole;
  typ: typeof JWT_ACCESS_TYP;
}

export interface SetupJwtPayload {
  sub: string;
  role: UserRole;
  typ: typeof JWT_SETUP_TYP;
}

export const lessorLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, 'Password is required'),
});


export const lessorSignupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  phone: z.string().trim().min(5, 'Phone is too short').max(32),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const tenantSignupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});




export const lesseeLoginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().optional(),
    phone: z.string().trim().min(1).optional(),
    password: z.string().min(1, 'Password is required'),
  })
  .refine((data) => (data.email !== undefined) !== (data.phone !== undefined), {
    message: 'Provide exactly one of email or phone',
    path: ['email'],
  });

export const inviteLesseeSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().min(5).max(32),
});

export const verifyOtpSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().optional(),
    phone: z.string().trim().min(1).optional(),
    otp: z.string().regex(/^\d{6}$/, 'OTP must be a 6-digit code'),
  })
  .refine((data) => (data.email !== undefined) !== (data.phone !== undefined), {
    message: 'Provide exactly one of email or phone',
    path: ['email'],
  });

export const setPasswordSchema = z.object({
  setupToken: z.string().min(1, 'setupToken is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long'),
});

export const createTenantSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().min(5).max(32),
  address: z.string().trim().optional().or(z.literal('')),
  passportInfo: z.string().trim().optional().or(z.literal('')),
  photoUrl: z.string().trim().optional().or(z.literal('')),
});

export const activateTenantSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LessorLoginInput = z.infer<typeof lessorLoginSchema>;
export type LessorSignupInput = z.infer<typeof lessorSignupSchema>;
export type LesseeLoginInput = z.infer<typeof lesseeLoginSchema>;

export type InviteLesseeInput = z.infer<typeof inviteLesseeSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type ActivateTenantInput = z.infer<typeof activateTenantSchema>;

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  isVerified: boolean;
  isActive: boolean;
}
