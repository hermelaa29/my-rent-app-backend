import { prisma } from '../../prisma/client.js';
import { AppError } from '../../utils/app-error.js';
import { UserRole } from '../../types/user-role.js';

export function getCurrentMonthYear() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export const reminderService = {
  async runDailyReminderJob() {
    const { month, year } = getCurrentMonthYear();
    const todayDate = new Date();
    const today = todayDate.getDate();

    const activeContracts = await prisma.contract.findMany({
      where: { status: 'ACTIVE' },
      include: {
        property: true,
      },
    });

    let processedContracts = 0;
    let remindersCreated = 0;
    let lateFeesCreated = 0;

    for (const contract of activeContracts) {
      if (today >= contract.reminderDay) {
        processedContracts++;
        
        // Check payment for current month
        const payment = await prisma.payment.findFirst({
          where: {
            contractId: contract.id,
            month,
            year,
          },
          include: { lateFees: true },
        });

        // Check for existing reminder in the current month
        const startOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
        const endOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0, 23, 59, 59, 999);
        
        let reminder = await prisma.reminder.findFirst({
          where: {
            contractId: contract.id,
            createdAt: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
        });

        const isThreeDaysLate = today >= contract.reminderDay + 3;

        if (!payment) {
          if (!reminder) {
            const monthName = todayDate.toLocaleString('default', { month: 'long' });
            reminder = await prisma.reminder.create({
              data: {
                contractId: contract.id,
                message: `Rent for ${monthName} ${year} is due`,
                isLate: isThreeDaysLate,
              },
            });
            remindersCreated++;
          } else if (isThreeDaysLate && !reminder.isLate) {
            reminder = await prisma.reminder.update({
              where: { id: reminder.id },
              data: { isLate: true },
            });
          }
        } else {
          if (isThreeDaysLate) {
            if (payment.status === 'PENDING' && payment.lateFees.length === 0) {
              await prisma.lateFee.create({
                data: {
                  amount: contract.property.price * 0.05,
                  reason: 'Late rent penalty',
                  paymentId: payment.id,
                },
              });
              lateFeesCreated++;
            }
          }
        }
      }
    }

    return { processedContracts, remindersCreated, lateFeesCreated };
  },

  async getRemindersForContract(contractId: string, userId: string, userRole: UserRole) {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
    });
    if (!contract) {
      throw new AppError('Contract not found', 404);
    }
    
    if (userRole === UserRole.LESSOR && contract.lessorId !== userId) {
      throw new AppError('You do not have access to this contract', 403);
    }
    if (userRole === UserRole.LESSEE && contract.lesseeId !== userId) {
      throw new AppError('You do not have access to this contract', 403);
    }

    return prisma.reminder.findMany({
      where: { contractId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getRemindersForUser(userId: string, userRole: UserRole) {
    if (userRole === UserRole.LESSOR) {
      return prisma.reminder.findMany({
        where: {
          contract: { lessorId: userId },
        },
        include: { contract: true },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      return prisma.reminder.findMany({
        where: {
          contract: { lesseeId: userId },
        },
        include: { contract: true },
        orderBy: { createdAt: 'desc' },
      });
    }
  },
};
