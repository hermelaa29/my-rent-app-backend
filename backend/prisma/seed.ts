import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * DEMO SEED
 *
 * Creates:
 *   - 1 LESSOR account (Admin)
 *   - 1 LESSEE account (Tenant)
 *   - 1 Property
 *   - 1 Active Contract linking them
 *
 * All existing data is wiped before seeding.
 */
async function main() {
  console.log('[SEED] Wiping all tables...');

  // Wipe in FK-safe order
  await prisma.reminder.deleteMany();
  await prisma.lateFee.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.property.deleteMany();
  await prisma.user.deleteMany();

  console.log('[SEED] All tables cleared.');

  console.log('[SEED] All tables cleared.');
  console.log('--------------------------------------------------');
  console.log('DATABASE IS NOW EMPTY');
  console.log('You can now sign up as a new Lessor via the UI.');
  console.log('--------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('[SEED ERROR]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
