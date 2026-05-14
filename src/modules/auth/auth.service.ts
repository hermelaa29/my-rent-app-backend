import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { UserRole } from '../../types/user-role.js';
import { prisma } from '../../prisma/client.js';
import { env } from '../../utils/env.js';
import { AppError } from '../../utils/app-error.js';
import {
  JWT_ACCESS_TYP,
  JWT_SETUP_TYP,
  type AccessJwtPayload,
  type InviteLesseeInput,
  type LesseeLoginInput,
  type LessorLoginInput,
  type PublicUser,
  type SetPasswordInput,
  type SetupJwtPayload,
  type TenantSignupInput,
  type VerifyOtpInput,
} from './auth.types.js';

const BCRYPT_ROUNDS = 12;

function isSetupJwtPayload(value: unknown): value is SetupJwtPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const o = value as Record<string, unknown>;
  return (
    typeof o.sub === 'string' &&
    (o.role === UserRole.LESSOR || o.role === UserRole.LESSEE) &&
    o.typ === JWT_SETUP_TYP
  );
}

function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isVerified: boolean;
}): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role as PublicUser['role'],
    isVerified: user.isVerified,
  };
}

function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

function otpMatches(provided: string, stored: string | null): boolean {
  if (stored === null) {
    return false;
  }
  if (provided.length !== stored.length) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(stored, 'utf8'));
  } catch {
    return false;
  }
}

function signAccessToken(userId: string, role: UserRole): string {
  const payload: AccessJwtPayload = { sub: userId, role, typ: JWT_ACCESS_TYP };
  const options: SignOptions = { expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.jwtSecret, options);
}

function signSetupToken(userId: string, role: UserRole): string {
  const payload: SetupJwtPayload = { sub: userId, role, typ: JWT_SETUP_TYP };
  const options: SignOptions = { expiresIn: env.jwtSetupExpiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.jwtSecret, options);
}

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export const authService = {
  async lessorLogin(input: LessorLoginInput): Promise<{ token: string; user: PublicUser }> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (user?.role !== UserRole.LESSOR) {
      throw new AppError('Invalid email or password', 401);
    }
    if (!user.isVerified) {
      throw new AppError('Account is not verified', 403);
    }
    const match = await verifyPassword(input.password, user.password);
    if (!match) {
      throw new AppError('Invalid email or password', 401);
    }
    return {
      token: signAccessToken(user.id, user.role),
      user: toPublicUser(user),
    };
  },

  async lesseeLogin(input: LesseeLoginInput): Promise<{ token: string; user: PublicUser }> {
    const user = await prisma.user.findFirst({
      where: {
        role: UserRole.LESSEE,
        OR: [
          ...(input.email !== undefined ? [{ email: input.email }] : []),
          ...(input.phone !== undefined ? [{ phone: input.phone }] : []),
        ],
      },
    });
    if (user === null) {
      throw new AppError('Invalid credentials', 401);
    }
    if (!user.isVerified) {
      throw new AppError('Please verify your account with the OTP sent by your lessor', 403);
    }
    const match = await verifyPassword(input.password, user.password);
    if (!match) {
      throw new AppError('Invalid credentials', 401);
    }
    return {
      token: signAccessToken(user.id, user.role),
      user: toPublicUser(user),
    };
  },

  async tenantSignup(input: TenantSignupInput): Promise<{ token: string; user: PublicUser }> {
    const existingEmail = await prisma.user.findUnique({ where: { email: input.email } });

    let user;
    const hashedPassword = await hashPassword(input.password);

    if (existingEmail !== null) {
      if (existingEmail.role !== UserRole.LESSEE) {
        throw new AppError('A user with this email already exists', 409);
      }

      user = await prisma.user.update({
        where: { id: existingEmail.id },
        data: {
          name: input.name,
          password: hashedPassword,
          isVerified: true,
          otpCode: null,
          otpExpires: null,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          phone: `tenant-${randomBytes(6).toString('hex')}`,
          password: hashedPassword,
          role: UserRole.LESSEE,
          isVerified: true,
        },
      });
    }

    return {
      token: signAccessToken(user.id, user.role),
      user: toPublicUser(user),
    };
  },

  async inviteLessee(
    lessorId: string,
    input: InviteLesseeInput,
  ): Promise<{ userId: string; email: string; message: string; otp?: string }> {
    const lessor = await prisma.user.findUnique({ where: { id: lessorId } });
    if (lessor?.role !== UserRole.LESSOR) {
      throw new AppError('Only verified lessors can invite lessees', 403);
    }
    if (!lessor.isVerified) {
      throw new AppError('Your lessor account must be verified', 403);
    }

    const existingEmail = await prisma.user.findUnique({ where: { email: input.email } });
    if (existingEmail !== null) {
      throw new AppError('A user with this email already exists', 409);
    }
    const existingPhone = await prisma.user.findUnique({ where: { phone: input.phone } });
    if (existingPhone !== null) {
      throw new AppError('A user with this phone number already exists', 409);
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + env.otpTtlMinutes * 60 * 1000);
    const placeholderPassword = await hashPassword(randomBytes(32).toString('hex'));

    const lessee = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        password: placeholderPassword,
        role: UserRole.LESSEE,
        isVerified: false,
        otpCode: otp,
        otpExpires,
        invitedByLessorId: lessorId,
      },
      select: { id: true, email: true },
    });

    const message =
      'Lessee account created. They must verify OTP before logging in and setting a password.';
    if (env.exposeInviteOtp) {
      return { userId: lessee.id, email: lessee.email, message, otp };
    }
    return { userId: lessee.id, email: lessee.email, message };
  },

  async verifyOtp(input: VerifyOtpInput): Promise<{ setupToken: string; expiresIn: string }> {
    const user = await prisma.user.findFirst({
      where: {
        role: UserRole.LESSEE,
        OR: [
          ...(input.email !== undefined ? [{ email: input.email }] : []),
          ...(input.phone !== undefined ? [{ phone: input.phone }] : []),
        ],
      },
    });
    if (user === null) {
      throw new AppError('Invalid OTP or account not found', 400);
    }
    if (user.otpCode === null || user.otpExpires === null) {
      throw new AppError('No active OTP for this account', 400);
    }
    if (user.otpExpires.getTime() < Date.now()) {
      throw new AppError('OTP has expired. Ask your lessor to resend an invitation', 400);
    }
    if (!otpMatches(input.otp, user.otpCode)) {
      throw new AppError('Invalid OTP', 400);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        otpCode: null,
        otpExpires: null,
      },
    });

    const setupToken = signSetupToken(user.id, user.role);
    return { setupToken, expiresIn: env.jwtSetupExpiresIn };
  },

  async setPassword(input: SetPasswordInput): Promise<{ message: string }> {
    let decoded: unknown;
    try {
      decoded = jwt.verify(input.setupToken, env.jwtSecret);
    } catch {
      throw new AppError('Invalid or expired setup token', 401);
    }
    if (!isSetupJwtPayload(decoded)) {
      throw new AppError('Invalid setup token', 401);
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
    if (user?.role !== UserRole.LESSEE) {
      throw new AppError('User not found', 404);
    }
    if (!user.isVerified) {
      throw new AppError('Verify your OTP before setting a password', 403);
    }

    const hashed = await hashPassword(input.password);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    return { message: 'Password set successfully. You can now log in.' };
  },
};
