import { z } from 'zod';

export const createPropertySchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(10_000).optional().nullable(),
  location: z.string().trim().min(1).max(500),
  price: z.number().positive().finite(),
});

export const updatePropertySchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().trim().max(10_000).optional().nullable(),
    location: z.string().trim().min(1).max(500).optional(),
    price: z.number().positive().finite().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export const propertyIdParamSchema = z.object({
  id: z.string().cuid(),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
