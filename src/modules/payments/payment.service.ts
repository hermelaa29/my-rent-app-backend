import PDFDocument from 'pdfkit';
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
import { chapaService } from './chapa.service.js';
import { env } from '../../utils/env.js';


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
    const user = await prisma.user.findUnique({ where: { id: lesseeId } });
    if (!user) throw new AppError('User not found', 404);

    await assertLesseeOwnsContract(lesseeId, input.contractId);
    
    const transactionRef = `chapa_${Date.now()}_${randomUUID().slice(0, 8)}`;
    
    // 1. Create a PENDING payment record
    try {
      const payment = await prisma.payment.create({
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
        include: {
          contract: {
            include: { property: true }
          }
        }
      });

      // 2. Mock Chapa Transaction (as requested to keep backend clean without API key)
      // This allows the frontend to proceed to the success page for demonstration
      const checkoutUrl = `${env.isProduction ? 'https://your-app.com' : 'http://localhost:5173'}/payments/success?tx_ref=${transactionRef}`;

      return {
        payment,
        checkoutUrl,
      };
    } catch (error: unknown) {
      if (isDuplicatePaymentError(error)) {
        throw new AppError('A payment already exists for this contract and month', 409);
      }
      throw error;
    }
  },

  async verifyChapaPayment(tx_ref: string) {
    const payment = await prisma.payment.findFirst({
      where: { transactionRef: tx_ref },
    });

    if (!payment) throw new AppError('Payment not found', 404);
    if (payment.status === PaymentStatus.PAID) return payment;

    // Mock success for demonstration since API key is not integrated
    const isSuccess = tx_ref.startsWith('chapa_');
    if (isSuccess) {
      return prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.PAID },
        select: paymentSelect,
      });
    }

    return payment;
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
      data: { proofImageURL, status: PaymentStatus.PENDING }, // Ensure it stays pending until lessor approves
      select: paymentSelect,
    });
  },

  async approve(lessorId: string, paymentId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { contract: true },
    });
    if (!payment) throw new AppError('Payment not found', 404);
    if (payment.contract.lessorId !== lessorId) throw new AppError('Unauthorized', 403);
    
    if (payment.method === PaymentMethod.OTHER && !payment.proofImageURL) {
      throw new AppError('Cannot approve OTHER payment without proof image', 400);
    }

    return prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.APPROVED },
      select: paymentSelect,
    });
  },

  async reject(lessorId: string, paymentId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { contract: true },
    });
    if (!payment) throw new AppError('Payment not found', 404);
    if (payment.contract.lessorId !== lessorId) throw new AppError('Unauthorized', 403);

    return prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.REJECTED },
      select: paymentSelect,
    });
  },

  async listForContract(userId: string, role: UserRole, contractId: string) {
    const where =
      role === 'LESSOR'
        ? { contractId, contract: { lessorId: userId } }
        : { contractId, userId };

    return prisma.payment.findMany({
      where,
      select: paymentSelect,
      orderBy: { year: 'desc', month: 'desc' },
    });
  },

  async listForLessor(lessorId: string) {
    return prisma.payment.findMany({
      where: { contract: { lessorId } },
      select: paymentSelect,
      orderBy: { createdAt: 'desc' },
    });
  },

  async getSummary(lessorId: string) {
    const payments = await prisma.payment.findMany({
      where: { contract: { lessorId } },
      include: { contract: true },
    });

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    let totalPaid = 0;
    let totalUnpaid = 0;
    let overdueCount = 0;
    let upcomingDueCount = 0;

    payments.forEach((p) => {
      const isPaid = p.status === PaymentStatus.APPROVED;
      if (isPaid) {
        totalPaid += p.amount;
      } else {
        totalUnpaid += p.amount;
        
        // Overdue logic: if month/year is in the past and not paid
        if (p.year < currentYear || (p.year === currentYear && p.month < currentMonth)) {
          overdueCount++;
        } else if (p.year === currentYear && p.month === currentMonth) {
          // If today > reminderDay, it's overdue
          if (now.getDate() > p.contract.reminderDay) {
            overdueCount++;
          } else {
            upcomingDueCount++;
          }
        }
      }
    });

    return {
      totalPaid,
      totalUnpaid,
      overdueCount,
      upcomingDueCount,
    };
  },

  async listForUser(userId: string, role: UserRole, page = 1, limit = 10) {
    const where =
      role === 'LESSOR'
        ? { contract: { lessorId: userId } }
        : { userId };

    const [total, items] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        select: paymentSelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items,
    };
  },

  async exportPaymentsPdf(userId: string, role: UserRole) {
    const where =
      role === 'LESSOR'
        ? { contract: { lessorId: userId } }
        : { userId };

    const payments = await prisma.payment.findMany({
      where,
      select: paymentSelect,
      orderBy: { createdAt: 'desc' },
    });

    const doc = new PDFDocument({ margin: 30, size: 'A4' });

    doc.fontSize(20).text('Payment History Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'right' });
    doc.moveDown();

    // Table Header
    const tableTop = 150;
    const col1 = 30;
    const col2 = 130;
    const col3 = 230;
    const col4 = 300;
    const col5 = 380;
    const col6 = 480;

    doc.font('Helvetica-Bold');
    doc.text('Tenant', col1, tableTop);
    doc.text('Property', col2, tableTop);
    doc.text('Amount', col3, tableTop);
    doc.text('Method', col4, tableTop);
    doc.text('Date', col5, tableTop);
    doc.text('Status', col6, tableTop);
    
    doc.moveTo(30, tableTop + 15).lineTo(565, tableTop + 15).stroke();
    
    doc.font('Helvetica');
    let y = tableTop + 25;

    payments.forEach((p) => {
      if (y > 750) {
        doc.addPage();
        y = 50;
      }
      doc.text(p.payer?.name || 'Unknown', col1, y);
      doc.text(p.contract?.property?.title || 'Property', col2, y, { width: 90 });
      doc.text(`${p.amount} ETB`, col3, y);
      doc.text(p.method || 'OTHER', col4, y);
      doc.text(`${p.month}/${p.year}`, col5, y);
      doc.text(p.status || 'PENDING', col6, y);
      y += 30;
    });

    doc.end();
    return doc;
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
};
