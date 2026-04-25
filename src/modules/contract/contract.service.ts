import { ContractStatus, UserRole } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { AppError } from '../../utils/app-error.js';
import type { CreateContractInput } from './contract.types.js';

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
  description: true,
  location: true,
  price: true,
  isAvailable: true,
  lessorId: true,
  createdAt: true,
  updatedAt: true,
} as const;

const contractWithRelations = {
  id: true,
  startDate: true,
  endDate: true,
  status: true,
  rentAmount: true,
  reminderDay: true,
  propertyId: true,
  lessorId: true,
  lesseeId: true,
  createdAt: true,
  updatedAt: true,
  property: { select: propertyPublic },
  lessor: { select: userPublic },
  lessee: { select: userPublic },
} as const;

export const contractService = {
  async create(lessorId: string, input: CreateContractInput) {
    const property = await prisma.property.findUnique({
      where: { id: input.propertyId },
    });
    if (property === null) {
      throw new AppError('Property not found', 404);
    }
    if (property.lessorId !== lessorId) {
      throw new AppError('You do not own this property', 403);
    }
    if (!property.isAvailable) {
      throw new AppError('This property is not available for a new contract', 409);
    }

    if (input.lesseeId === lessorId) {
      throw new AppError('You cannot create a contract with yourself as the lessee', 400);
    }

    const lessee = await prisma.user.findUnique({
      where: { id: input.lesseeId },
    });
    if (lessee === null) {
      throw new AppError('Lessee not found', 404);
    }
    if (lessee.role !== UserRole.LESSEE) {
      throw new AppError('The selected user is not a lessee', 400);
    }
    if (!lessee.isVerified) {
      throw new AppError('The lessee must verify their account before entering a contract', 403);
    }

    const contractId = await prisma.$transaction(async (tx) => {
      const created = await tx.contract.create({
        data: {
          propertyId: input.propertyId,
          lessorId,
          lesseeId: input.lesseeId,
          startDate: input.startDate,
          endDate: input.endDate ?? undefined,
          rentAmount: input.rentAmount,
          reminderDay: input.reminderDay,
          status: ContractStatus.ACTIVE,
        },
        select: { id: true },
      });
      await tx.property.update({
        where: { id: input.propertyId },
        data: { isAvailable: false },
      });
      return created.id;
    });

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: contractWithRelations,
    });
    if (contract === null) {
      throw new AppError('Contract not found', 404);
    }
    return contract;
  },

  async listForUser(userId: string, role: UserRole) {
    const where =
      role === UserRole.LESSOR
        ? { lessorId: userId }
        : { lesseeId: userId };

    return prisma.contract.findMany({
      where,
      select: contractWithRelations,
      orderBy: { createdAt: 'desc' },
    });
  },

  async getByIdForUser(userId: string, role: UserRole, contractId: string) {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: contractWithRelations,
    });
    if (contract === null) {
      throw new AppError('Contract not found', 404);
    }
    if (role === UserRole.LESSOR && contract.lessorId !== userId) {
      throw new AppError('You do not have access to this contract', 403);
    }
    if (role === UserRole.LESSEE && contract.lesseeId !== userId) {
      throw new AppError('You do not have access to this contract', 403);
    }
    return contract;
  },

  async endByLessor(lessorId: string, contractId: string) {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        lessorId: true,
        propertyId: true,
        status: true,
      },
    });
    if (contract === null) {
      throw new AppError('Contract not found', 404);
    }
    if (contract.lessorId !== lessorId) {
      throw new AppError('Only the lessor on this contract can end it', 403);
    }
    if (contract.status === ContractStatus.ENDED) {
      throw new AppError('This contract is already ended', 400);
    }

    await prisma.$transaction([
      prisma.contract.update({
        where: { id: contractId },
        data: { status: ContractStatus.ENDED },
      }),
      prisma.property.update({
        where: { id: contract.propertyId },
        data: { isAvailable: true },
      }),
    ]);

    const updated = await prisma.contract.findUnique({
      where: { id: contractId },
      select: contractWithRelations,
    });
    if (updated === null) {
      throw new AppError('Contract not found', 404);
    }
    return updated;
  },
};
