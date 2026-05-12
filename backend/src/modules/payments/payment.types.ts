import { PaymentMethod } from '@prisma/client';
import { z } from 'zod';

export const createPaymentSchema = z.object({
  contractId: z.string().cuid(),
  amount: z.number().positive().finite(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(9999),
  method: z.nativeEnum(PaymentMethod).refine((value) => value !== PaymentMethod.CHAPA, {
    message: 'Use /payments/chapa/init for CHAPA initialization',
  }),
});

export const chapaInitSchema = z.object({
  contractId: z.string().cuid(),
  amount: z.number().positive().finite(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(9999),
});

export const paymentIdParamSchema = z.object({
  id: z.string().cuid(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type ChapaInitInput = z.infer<typeof chapaInitSchema>;
