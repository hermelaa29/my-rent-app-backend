import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
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
  type VerifyOtpInput,
  type CreateTenantInput,
  type LessorSignupInput,
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
  isActive: boolean;
}): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role as PublicUser['role'],
    isVerified: user.isVerified,
    isActive: user.isActive,
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
  async lessorSignup(input: LessorSignupInput): Promise<{ token: string; user: PublicUser }> {
    console.log(`[AUTH] Lessor signup attempt: ${input.email}`);
    try {
      const existingEmail = await prisma.user.findUnique({ where: { email: input.email } });
      if (existingEmail) throw new AppError('Email already in use', 409);

      const existingPhone = await prisma.user.findUnique({ where: { phone: input.phone } });
      if (existingPhone) throw new AppError('Phone already in use', 409);

      const hashed = await hashPassword(input.password);

      const user = await prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          password: hashed,
          role: UserRole.LESSOR,
          isVerified: true, // Auto-verified for now for simplicity, or we could add email verification later
          isActive: true,
        },
      });

      console.log(`[AUTH] Lessor signup successful: ${input.email}`);
      return {
        token: signAccessToken(user.id, user.role),
        user: toPublicUser(user),
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      console.error(`[AUTH] Critical error during lessor signup for ${input.email}:`, err);
      throw new AppError('Internal server error during signup', 500);
    }
  },

  async lessorLogin(input: LessorLoginInput): Promise<{ token: string; user: PublicUser }> {

    console.log(`[AUTH] Lessor login attempt: ${input.email}`);
    try {
      const user = await prisma.user.findUnique({ where: { email: input.email } });
      
      if (!user) {
        console.warn(`[AUTH] Login failed: User not found (${input.email})`);
        throw new AppError('Invalid email or password', 401);
      }

      if (user.role !== UserRole.LESSOR) {
        console.warn(`[AUTH] Login failed: Role mismatch. User ${input.email} is ${user.role}, not LESSOR`);
        throw new AppError('Unauthorized role', 403);
      }

      if (!user.isVerified) {
        console.warn(`[AUTH] Login failed: Account not verified (${input.email})`);
        throw new AppError('Account is not verified', 403);
      }

      if (!user.isActive) {
        console.warn(`[AUTH] Login failed: Account is inactive (${input.email})`);
        throw new AppError('Account is inactive', 403);
      }

      const match = await verifyPassword(input.password, user.password);
      if (!match) {
        console.warn(`[AUTH] Login failed: Password mismatch for ${input.email}`);
        throw new AppError('Invalid email or password', 401);
      }

      console.log(`[AUTH] Lessor login successful: ${input.email}`);
      return {
        token: signAccessToken(user.id, user.role),
        user: toPublicUser(user),
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      console.error(`[AUTH] Critical error during lessor login for ${input.email}:`, err);
      throw new AppError('Internal server error during login', 500);
    }
  },

  async lesseeLogin(input: LesseeLoginInput): Promise<{ token: string; user: PublicUser }> {
    const identifier = input.email || input.phone;
    console.log(`[AUTH] Lessee login attempt: ${identifier}`);
    try {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            ...(input.email !== undefined ? [{ email: input.email }] : []),
            ...(input.phone !== undefined ? [{ phone: input.phone }] : []),
          ],
        },
      });

      if (!user) {
        console.warn(`[AUTH] Login failed: User not found (${identifier})`);
        throw new AppError('Invalid credentials', 401);
      }

      if (user.role !== UserRole.LESSEE) {
        console.warn(`[AUTH] Login failed: Role mismatch. User ${identifier} is ${user.role}, not LESSEE`);
        throw new AppError('Unauthorized role', 403);
      }

      if (!user.isVerified) {
        console.warn(`[AUTH] Login failed: Account not verified (${identifier})`);
        throw new AppError('Please verify your account with the OTP sent by your lessor', 403);
      }

      if (!user.isActive) {
        console.warn(`[AUTH] Login failed: Account is inactive (${identifier})`);
        throw new AppError('Account is inactive', 403);
      }

      const match = await verifyPassword(input.password, user.password);
      if (!match) {
        console.warn(`[AUTH] Login failed: Password mismatch for ${identifier}`);
        throw new AppError('Invalid credentials', 401);
      }

      console.log(`[AUTH] Lessee login successful: ${identifier}`);
      return {
        token: signAccessToken(user.id, user.role),
        user: toPublicUser(user),
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      console.error(`[AUTH] Critical error during lessee login for ${identifier}:`, err);
      throw new AppError('Internal server error during login', 500);
    }
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

  async createTenant(
    lessorId: string,
    input: CreateTenantInput,
  ): Promise<{ userId: string; message: string; tempPassword?: string }> {
    try {
      // Validate lessor before proceeding
      const lessor = await prisma.user.findUnique({
        where: { id: lessorId },
      });
      if (!lessor) {
        throw new AppError('Lessor account no longer exists. Please log in again.', 401);
      }
      if (lessor.role !== UserRole.LESSOR) {
        throw new AppError('Unauthorized role', 403);
      }

      const existingEmail = await prisma.user.findUnique({ where: { email: input.email } });
      if (existingEmail) throw new AppError('A user with this email already exists', 409);

      const existingPhone = await prisma.user.findUnique({ where: { phone: input.phone } });
      if (existingPhone) throw new AppError('A user with this phone number already exists', 409);

      const tempPassword = randomBytes(4).toString('hex'); // 8 characters
      const hashedTemp = await hashPassword(tempPassword);
      const activationToken = randomBytes(24).toString('hex');
      const activationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const user = await prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          address: input.address || undefined,
          passportInfo: input.passportInfo || undefined,
          photoUrl: input.photoUrl || undefined,
          password: hashedTemp,
          role: UserRole.LESSEE,
          isVerified: true,
          isActive: false,
          activationToken,
          activationTokenExpires,
          invitedByLessorId: lessorId,
        },
      });

      // ── NOTIFICATION MOCK ──────────────────────────────────────────────────
      const activationLink = `http://localhost:5173/tenant/activate/${activationToken}`;
      console.log(
        `[SMS/EMAIL MOCK] To: ${input.email} | Phone: ${input.phone}\n` +
        `Message: Your rental account has been created.\n` +
        `Login email: ${input.email}\n` +
        `Temporary password: ${tempPassword}\n` +
        `Or activate directly: ${activationLink}`
      );
      // ───────────────────────────────────────────────────────────────────────

      return {
        userId: user.id,
        message: 'Tenant created. Activation link sent.',
        tempPassword,
      };
    } catch (error: any) {
      console.error("CREATE TENANT ERROR:", error);
      
      if (error instanceof AppError) throw error;
      
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new AppError('Email or phone already exists', 409);
        }
        if (error.code === 'P2003') {
          throw new AppError('Invalid lessor reference (foreign key error)', 400);
        }
        throw new AppError(`Database request error: ${error.message}`, 400);
      }
      
      if (error instanceof Prisma.PrismaClientValidationError) {
        throw new AppError(`Database validation error: missing or invalid fields.`, 400);
      }
      
      throw new AppError(`Failed to create tenant: ${error.message || 'Unexpected error'}`, 500);
    }
  },

  async activateTenant(input: any): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({
      where: { activationToken: input.token },
    });

    if (!user) throw new AppError('Invalid or expired activation token', 400);
    if (user.activationTokenExpires && user.activationTokenExpires.getTime() < Date.now()) {
      throw new AppError('Activation token has expired', 400);
    }

    const hashed = await hashPassword(input.password);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        isActive: true,
        activationToken: null,
        activationTokenExpires: null,
      },
    });

    return { message: 'Account activated and password set successfully. You can now log in.' };
  },

  async tenantSignup(input: { email: string; name: string; password: string }): Promise<{ token: string; user: PublicUser }> {
    console.log(`[AUTH] Tenant signup attempt: ${input.email}`);
    
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    
    if (!user) {
      throw new AppError('No invitation found for this email. Please contact your lessor.', 404);
    }
    
    if (user.role !== UserRole.LESSEE) {
      throw new AppError('This email is already registered as a Lessor.', 400);
    }
    
    if (user.isActive) {
      throw new AppError('Account is already active. Please log in.', 400);
    }

    // Optional: verify name matches to be a bit safer
    if (user.name.toLowerCase() !== input.name.toLowerCase()) {
      throw new AppError('Name does not match the one registered by your lessor.', 400);
    }

    const hashed = await hashPassword(input.password);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        isActive: true,
        isVerified: true, // Mark as verified since they are signing up via known email
        activationToken: null,
        activationTokenExpires: null,
      },
    });

    console.log(`[AUTH] Tenant signup successful: ${input.email}`);
    return {
      token: signAccessToken(updatedUser.id, updatedUser.role),
      user: toPublicUser(updatedUser),
    };
  },
};

