import { prisma } from '../../prisma/client.js';
import { UserRole } from '../../types/user-role.js';
import { AppError } from '../../utils/app-error.js';

export const userService = {
  /**
   * List all LESSEE users created by the given lessor.
   * Data isolation: a lessor can only see their own tenants.
   */
  async listLessees(lessorId: string) {
    return prisma.user.findMany({
      where: {
        role: UserRole.LESSEE,
        invitedByLessorId: lessorId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        isVerified: true,
        address: true,
        passportInfo: true,
        photoUrl: true,
        createdAt: true,
        contractsAsLessee: {
          select: {
            id: true,
            status: true,
            rentAmount: true,
            startDate: true,
            endDate: true,
            property: {
              select: { id: true, title: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getTenantById(lessorId: string, id: string) {
    return prisma.user.findFirst({
      where: {
        id,
        role: UserRole.LESSEE,
        invitedByLessorId: lessorId,
      },
      include: {
        contractsAsLessee: {
          include: {
            property: true,
            payments: { orderBy: { createdAt: 'desc' } },
          },
        },
      },
    });
  },

  /**
   * Delete a tenant ONLY if they have no ACTIVE contract.
   * If an active contract exists, throw a 400 error.
   */
  async deleteTenant(lessorId: string, tenantId: string) {
    // Ensure tenant belongs to this lessor
    const tenant = await prisma.user.findFirst({
      where: {
        id: tenantId,
        role: UserRole.LESSEE,
        invitedByLessorId: lessorId,
      },
      select: {
        id: true,
        name: true,
        contractsAsLessee: {
          where: { status: 'ACTIVE' },
          select: { id: true },
        },
      },
    });

    if (!tenant) {
      throw new AppError('Tenant not found or does not belong to your account', 404);
    }

    if (tenant.contractsAsLessee.length > 0) {
      throw new AppError('Cannot delete tenant with an active contract', 400);
    }

    await prisma.user.delete({ where: { id: tenantId } });
    return { message: `Tenant "${tenant.name}" deleted successfully` };
  },
};
