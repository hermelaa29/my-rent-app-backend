import {
  PaymentMethod,
  PaymentStatus,
  Prisma,
  type UserRole,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../prisma/client.js';
import { AppError } from '../../utils/app-error.js';
import type { ChapaInitInput, CreatePaymentInput } from './payment.types.js';

const userPublic = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
} as const;

const propertyPublic = {
  id: true,
  title: true,
  location: true,
  price: true,
  lessorId: true,
} as const;

const contractPublic = {
  id: true,
  startDate: true,
  endDate: true,
  status: true,
  rentAmount: true,
  reminderDay: true,
  lessorId: true,
  lesseeId: true,
  property: { select: propertyPublic },
} as const;

const paymentSelect = {
  id: true,
  amount: true,
  method: true,
  status: true,
  month: true,
  year: true,
  transactionRef: true,
  proofImageURL: true,
  contractId: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  payer: { select: userPublic },
  contract: { select: contractPublic },
} as const;

async function assertLesseeOwnsContract(lesseeId: string, contractId: string): Promise<void> {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { id: true, lesseeId: true },
  });
  if (contract === null) {
    throw new AppError('Contract not found', 404);
  }
  if (contract.lesseeId !== lesseeId) {
    throw new AppError('This contract does not belong to you', 403);
  }
}

function isDuplicatePaymentError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

export const paymentService = {
  async create(lesseeId: string, input: CreatePaymentInput) {
    await assertLesseeOwnsContract(lesseeId, input.contractId);
    try {
      return await prisma.payment.create({
        data: {
          contractId: input.contractId,
          userId: lesseeId,
          amount: input.amount,
          month: input.month,
          year: input.year,
          method: input.method,
          status: PaymentStatus.PENDING,
        },
        select: paymentSelect,
      });
    } catch (error: unknown) {
      if (isDuplicatePaymentError(error)) {
        throw new AppError('A payment already exists for this contract and month', 409);
      }
      throw error;
    }
  },

  async initChapa(lesseeId: string, input: ChapaInitInput) {
    await assertLesseeOwnsContract(lesseeId, input.contractId);
    const transactionRef = `chapa_${Date.now()}_${randomUUID().slice(0, 8)}`;
    try {
      return await prisma.payment.create({
        data: {
          contractId: input.contractId,
          userId: lesseeId,
          amount: input.amount,
          month: input.month,
          year: input.year,
          method: PaymentMethod.CHAPA,
          status: PaymentStatus.PENDING,
          transactionRef,
        },
        select: paymentSelect,
      });
    } catch (error: unknown) {
      if (isDuplicatePaymentError(error)) {
        throw new AppError('A payment already exists for this contract and month', 409);
      }
      throw error;
    }
  },

  async uploadProof(lesseeId: string, paymentId: string, proofImageURL: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        userId: true,
        method: true,
      },
    });
    if (payment === null) {
      throw new AppError('Payment not found', 404);
    }
    if (payment.userId !== lesseeId) {
      throw new AppError('You can only upload proof for your own payments', 403);
    }
    if (payment.method !== PaymentMethod.OTHER) {
      throw new AppError('Payment proof upload is only allowed for method OTHER', 400);
    }
    return prisma.payment.update({
      where: { id: payment.id },
      data: { proofImageURL },
      select: paymentSelect,
    });
  },

  async approve(lessorId: string, paymentId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        status: true,
        contract: {
          select: {
            lessorId: true,
          },
        },
      },
    });
    if (payment === null) {
      throw new AppError('Payment not found', 404);
    }
    if (payment.contract.lessorId !== lessorId) {
      throw new AppError('This payment does not belong to your contracts', 403);
    }
    if (payment.status !== PaymentStatus.PENDING) {
      throw new AppError('Only pending payments can be approved', 400);
    }
    return prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.APPROVED },
      select: paymentSelect,
    });
  },

  async reject(lessorId: string, paymentId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        status: true,
        contract: {
          select: {
            lessorId: true,
          },
        },
      },
    });
    if (payment === null) {
      throw new AppError('Payment not found', 404);
    }
    if (payment.contract.lessorId !== lessorId) {
      throw new AppError('This payment does not belong to your contracts', 403);
    }
    if (payment.status !== PaymentStatus.PENDING) {
      throw new AppError('Only pending payments can be rejected', 400);
    }
    return prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.REJECTED },
      select: paymentSelect,
    });
  },

  async listForUser(userId: string, role: UserRole) {
    const where =
      role === 'LESSOR'
        ? { contract: { lessorId: userId } }
        : { userId };

    return prisma.payment.findMany({
      where,
      select: paymentSelect,
      orderBy: { createdAt: 'desc' },
    });
  },

  async getByIdForUser(userId: string, role: UserRole, paymentId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: paymentSelect,
    });
    if (payment === null) {
      throw new AppError('Payment not found', 404);
    }
    if (role === 'LESSOR' && payment.contract.lessorId !== userId) {
      throw new AppError('You do not have access to this payment', 403);
    }
    if (role === 'LESSEE' && payment.userId !== userId) {
      throw new AppError('You do not have access to this payment', 403);
    }
    return payment;
  },

  async getSummaryForUser(userId: string, role: UserRole) {
    const where =
      role === 'LESSOR'
        ? { contract: { lessorId: userId } }
        : { userId };

    const payments = await prisma.payment.findMany({
      where,
      select: {
        amount: true,
        status: true,
      },
    });

    const totalPaid = payments
      .filter((p) => p.status === PaymentStatus.APPROVED)
      .reduce((sum, p) => sum + p.amount, 0);

    const totalUnpaid = payments
      .filter((p) => p.status === PaymentStatus.PENDING)
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      totalPaid,
      totalUnpaid,
      overdueCount: 0,
      upcomingDueCount: 0,
    };
  },

  async getByContractId(contractId: string) {
    return prisma.payment.findMany({
      where: { contractId },
      select: paymentSelect,
      orderBy: { createdAt: 'desc' },
    });
  },
};
