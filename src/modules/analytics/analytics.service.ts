import { PaymentStatus } from '@prisma/client';
import { prisma } from '../../prisma/client.js';

export const analyticsService = {
  async getOverview(lessorId: string) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = lastMonthDate.getMonth() + 1;
    const lastMonthYear = lastMonthDate.getFullYear();

    // 1. Revenue this month & last month
    const revenueThisMonth = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        contract: { lessorId },
        status: PaymentStatus.APPROVED,
        month: currentMonth,
        year: currentYear,
      },
    });

    const revenueLastMonth = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        contract: { lessorId },
        status: PaymentStatus.APPROVED,
        month: lastMonth,
        year: lastMonthYear,
      },
    });

    const thisRevenue = revenueThisMonth._sum.amount || 0;
    const lastRevenue = revenueLastMonth._sum.amount || 0;
    const growthPercent = lastRevenue === 0 ? 100 : ((thisRevenue - lastRevenue) / lastRevenue) * 100;

    // 2. Active Contracts & Total Properties
    const totalActiveContracts = await prisma.contract.count({
      where: { lessorId, status: 'ACTIVE' },
    });

    const totalProperties = await prisma.property.count({
      where: { lessorId },
    });

    const occupancyRatePercent = totalProperties === 0 ? 0 : (totalActiveContracts / totalProperties) * 100;
    
    const totalTenants = await prisma.user.count({
      where: { invitedByLessorId: lessorId, role: 'LESSEE' },
    });

    // 3. Monthly Revenue (Last 12 months)
    const monthlyPayments = await prisma.payment.findMany({
      where: {
        contract: { lessorId },
        status: PaymentStatus.APPROVED,
      },
      select: {
        amount: true,
        month: true,
        year: true,
      },
    });

    const revenueTrendMap: Record<string, number> = {};
    monthlyPayments.forEach((p) => {
      const key = `${p.year}-${String(p.month).padStart(2, '0')}`;
      revenueTrendMap[key] = (revenueTrendMap[key] || 0) + p.amount;
    });

    const monthlyRevenue = Object.entries(revenueTrendMap)
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);

    // 4. Arrears by Month (Overdue logic simplified for analytics: any non-approved past payment)
    const allPayments = await prisma.payment.findMany({
      where: { contract: { lessorId } },
      include: { contract: true },
    });

    const arrearsMap: Record<string, number> = {};
    allPayments.forEach((p) => {
      const isPast = p.year < currentYear || (p.year === currentYear && p.month < currentMonth);
      const isOverdue = p.status !== PaymentStatus.APPROVED && isPast;
      if (isOverdue) {
        const key = `${p.year}-${String(p.month).padStart(2, '0')}`;
        arrearsMap[key] = (arrearsMap[key] || 0) + 1;
      }
    });

    const arrearsByMonth = Object.entries(arrearsMap)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);

    const overdueCount = Object.values(arrearsMap).reduce((acc, curr) => acc + curr, 0);

    // 5. Upcoming next-month dues (Contract is active, and no approved payment for next month yet)
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonth = nextMonthDate.getMonth() + 1;
    const nextMonthYear = nextMonthDate.getFullYear();

    const activeContracts = await prisma.contract.findMany({
      where: { lessorId, status: 'ACTIVE' },
    });

    let upcomingNextMonthDues = 0;
    for (const contract of activeContracts) {
      const payment = await prisma.payment.findFirst({
        where: {
          contractId: contract.id,
          month: nextMonth,
          year: nextMonthYear,
          status: PaymentStatus.APPROVED,
        },
      });
      if (!payment) {
        upcomingNextMonthDues++;
      }
    }

    // 5. Top Paying Tenants
    const tenantSummary = await prisma.payment.groupBy({
      by: ['userId'],
      _sum: { amount: true },
      where: {
        contract: { lessorId },
        status: PaymentStatus.APPROVED,
      },
      orderBy: {
        _sum: { amount: 'desc' },
      },
      take: 5,
    });

    const topPayingTenants = await Promise.all(
      tenantSummary.map(async (ts) => {
        const user = await prisma.user.findUnique({ where: { id: ts.userId }, select: { name: true } });
        return {
          tenantName: user?.name || 'Unknown',
          totalPaid: ts._sum.amount || 0,
        };
      })
    );

    // 6. Payment Method Breakdown
    const methodBreakdown = await prisma.payment.groupBy({
      by: ['method'],
      _count: { id: true },
      where: {
        contract: { lessorId },
      },
    });

    const methodData = methodBreakdown.map((m) => ({
      method: m.method,
      count: m._count.id,
    }));

    return {
      revenueThisMonth: thisRevenue,
      revenueLastMonth: lastRevenue,
      revenueGrowthPercent: growthPercent,
      totalActiveContracts,
      totalProperties,
      occupancyRatePercent,
      monthlyRevenue,
      arrearsByMonth,
      overdueCount,
      totalTenants,
      upcomingNextMonthDues,
      topPayingTenants,
      methodBreakdown: methodData,
    };
  },
};
