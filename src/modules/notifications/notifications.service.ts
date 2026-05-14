import { PaymentStatus } from '@prisma/client';
import { prisma } from '../../prisma/client.js';

export const notificationService = {
  async getNotifications(lessorId: string) {
    const now = new Date();

    const payments = await prisma.payment.findMany({
      where: {
        contract: { lessorId },
        status: { in: [PaymentStatus.PENDING] },
      },
      include: {
        contract: {
          include: {
            property: true,
            lessee: true,
          },
        },
      },
    });

    const upcoming: any[] = [];
    const overdue: any[] = [];

    payments.forEach((p) => {
      const reminderDay = p.contract.reminderDay;
      const dueDate = new Date(p.year, p.month - 1, reminderDay);
      
      const diffTime = dueDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Upcoming: today is before reminderDay and within next 7 days
      if (diffDays >= 0 && diffDays <= 7) {
        upcoming.push({
          paymentId: p.id,
          tenantName: p.contract.lessee.name,
          propertyName: p.contract.property.title,
          dueDate: dueDate.toISOString().split('T')[0],
          amount: p.amount,
        });
      } 
      // Overdue: today is past the reminder day
      else if (diffDays < 0) {
        overdue.push({
          paymentId: p.id,
          tenantName: p.contract.lessee.name,
          propertyName: p.contract.property.title,
          daysLate: Math.abs(diffDays),
          amountDue: p.amount,
          status: p.status,
        });
      }
    });

    return { upcoming, overdue };
  },

  async runDailyJob() {
    console.log('[Cron] Running daily notification job...');
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const activeContracts = await prisma.contract.findMany({
      where: { status: 'ACTIVE' },
      include: { property: true },
    });

    for (const contract of activeContracts) {
      const reminderDay = contract.reminderDay;
      const todayDay = now.getDate();

      // Overdue check: if today is reminderDay + 4 (past 3 days grace)
      if (todayDay === reminderDay + 4) {
        const pendingPayment = await prisma.payment.findFirst({
          where: {
            contractId: contract.id,
            month: currentMonth,
            year: currentYear,
            status: PaymentStatus.PENDING,
          },
        });

        if (pendingPayment) {
          console.log(`[Cron] Applying late fee for contract ${contract.id}`);
          const lateFee = contract.property.price * 0.05;
          
          // Add late fee record
          await prisma.lateFee.create({
            data: {
              paymentId: pendingPayment.id,
              amount: lateFee,
              reason: 'Automatic late fee (5%)',
            },
          });

          // Update payment amount and status
          await prisma.payment.update({
            where: { id: pendingPayment.id },
            data: {
              amount: pendingPayment.amount + lateFee,
            },
          });
        }
      }
    }
    console.log('[Cron] Daily job finished.');
  },
};
