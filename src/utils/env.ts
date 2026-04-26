function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number.parseInt(process.env.PORT ?? '3000', 10),
  isProduction: process.env.NODE_ENV === 'production',
  /** Required at runtime for Prisma; set in .env from .env.example */
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  jwtSetupExpiresIn: process.env.JWT_SETUP_EXPIRES_IN ?? '30m',
  otpTtlMinutes: Number.parseInt(process.env.OTP_TTL_MINUTES ?? '15', 10),
  /**
   * When true, POST /auth/invite-lessee includes `otp` in JSON (avoid in production; use SMS/email).
   */
  exposeInviteOtp:
    process.env.EXPOSE_INVITE_OTP === 'true' ||
    (process.env.NODE_ENV !== 'production' && process.env.EXPOSE_INVITE_OTP !== 'false'),
} as const;
