import { env } from '../../utils/env.js';
import { AppError } from '../../utils/app-error.js';

interface ChapaInitializeOptions {
  amount: number;
  currency: string;
  email: string;
  first_name: string;
  last_name: string;
  tx_ref: string;
  callback_url?: string;
  return_url?: string;
  customization?: {
    title?: string;
    description?: string;
  };
}

interface ChapaInitializeResponse {
  message: string;
  status: string;
  data: {
    checkout_url: string;
  };
}

export const chapaService = {
  async initialize(options: ChapaInitializeOptions): Promise<string> {
    try {
      const response = await fetch('https://api.chapa.co/v1/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.chapaSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...options,
          // Default to ETB if not provided
          currency: options.currency || 'ETB',
        }),
      });

      const data = (await response.json()) as ChapaInitializeResponse;

      if (!response.ok || data.status !== 'success') {
        console.error('[CHAPA ERROR]', data);
        throw new AppError(data.message || 'Failed to initialize Chapa transaction', 400);
      }

      return data.data.checkout_url;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      console.error('[CHAPA CRITICAL ERROR]', error);
      throw new AppError('Chapa service unavailable', 503);
    }
  },

  async verify(tx_ref: string): Promise<boolean> {
    try {
      const response = await fetch(`https://api.api.chapa.co/v1/transaction/verify/${tx_ref}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${env.chapaSecretKey}`,
        },
      });

      const data = await response.json();
      return response.ok && data.status === 'success';
    } catch (error) {
      console.error('[CHAPA VERIFY ERROR]', error);
      return false;
    }
  },
};
