import { prisma } from '../../prisma/client.js';
import { Prisma } from '@prisma/client';
import { AppError } from '../../utils/app-error.js';
import type { CreatePropertyInput, UpdatePropertyInput } from './property.types.js';

const propertySelect = {
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

export const propertyService = {
  async create(lessorId: string, input: CreatePropertyInput) {
    try {
      if (!input.title || !input.location || input.price === undefined) {
        throw new AppError('Title, location, and price are required', 400);
      }

      return await prisma.property.create({
        data: {
          title: input.title,
          description: input.description ?? undefined,
          location: input.location,
          price: input.price,
          lessorId,
        },
        select: propertySelect,
      });
    } catch (error) {
      console.error("CREATE PROPERTY ERROR:", error);
      if (error instanceof AppError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new AppError('Property with similar details already exists', 409);
        }
        if (error.code === 'P2003') {
          throw new AppError('Invalid lessor account', 400);
        }
      }
      throw new AppError('Failed to create property', 500);
    }
  },

  async listByLessor(lessorId: string) {
    return prisma.property.findMany({
      where: { lessorId },
      select: propertySelect,
      orderBy: { createdAt: 'desc' },
    });
  },

  async getByIdForLessor(lessorId: string, propertyId: string) {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, lessorId },
      select: propertySelect,
    });
    if (property === null) {
      throw new AppError('Property not found', 404);
    }
    return property;
  },

  async updateForLessor(lessorId: string, propertyId: string, input: UpdatePropertyInput) {
    await this.assertOwned(lessorId, propertyId);
    return prisma.property.update({
      where: { id: propertyId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
      },
      select: propertySelect,
    });
  },

  async deleteForLessor(lessorId: string, propertyId: string) {
    await this.assertOwned(lessorId, propertyId);
    const activeContractCount = await prisma.contract.count({
      where: { propertyId, status: 'ACTIVE' },
    });
    if (activeContractCount > 0) {
      throw new AppError(
        'Cannot delete a property that is currently under an active contract.',
        409,
      );
    }
    await prisma.property.delete({ where: { id: propertyId } });
    return { deleted: true as const };
  },

  async toggleAvailability(lessorId: string, propertyId: string) {
    const property = await this.getByIdForLessor(lessorId, propertyId);
    return prisma.property.update({
      where: { id: propertyId },
      data: { isAvailable: !property.isAvailable },
      select: propertySelect,
    });
  },

  async assertOwned(lessorId: string, propertyId: string): Promise<void> {
    const count = await prisma.property.count({
      where: { id: propertyId, lessorId },
    });
    if (count === 0) {
      throw new AppError('Property not found', 404);
    }
  },
};
