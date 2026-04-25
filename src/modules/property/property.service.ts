import { prisma } from '../../prisma/client.js';
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
    return prisma.property.create({
      data: {
        title: input.title,
        description: input.description ?? undefined,
        location: input.location,
        price: input.price,
        lessorId,
      },
      select: propertySelect,
    });
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
    const contractCount = await prisma.contract.count({
      where: { propertyId },
    });
    if (contractCount > 0) {
      throw new AppError(
        'Cannot delete a property that has contract history. Contracts are kept for audit purposes.',
        409,
      );
    }
    await prisma.property.delete({ where: { id: propertyId } });
    return { deleted: true as const };
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
