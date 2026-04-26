import { z } from 'zod';

export const createContractSchema = z
  .object({
    propertyId: z.string().cuid(),
    lesseeId: z.string().cuid(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional().nullable(),
    rentAmount: z.number().positive().finite(),
    reminderDay: z.number().int().min(1).max(31),
  })
  .refine((data) => data.endDate === undefined || data.endDate === null || data.endDate >= data.startDate, {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
  });

export const contractIdParamSchema = z.object({
  id: z.string().cuid(),
});

export const renewContractSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  rentAmount: z.number().positive().finite().optional(),
}).refine((data) => data.endDate === undefined || data.endDate === null || data.endDate >= data.startDate, {
  message: 'endDate must be on or after startDate',
  path: ['endDate'],
});

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type RenewContractInput = z.infer<typeof renewContractSchema>;
