import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * PRODUCTION SEED
 *
 * Creates ONLY one LESSOR account.
 * No tenants, no properties, no contracts, no payments are seeded.
 * All existing data is wiped before seeding to guarantee a clean state.
 *
 * Credentials:
 *   Email:    daniel.solomon@rentms.com
 *   Password: 123456
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

  const passwordHash = await bcrypt.hash('123456', 12);

  // Create the one and only LESSOR account
  const lessor = await prisma.user.create({
    data: {
      name: 'Daniel Solomon',
      email: 'daniel.solomon@rentms.com',
      phone: '0911223344',
      password: passwordHash,
      role: UserRole.LESSOR,
      isVerified: true,
      isActive: true,
    },
    select: { id: true, email: true, role: true },
  });

  console.log(`[SEED] Lessor created: ${lessor.email} (${lessor.id})`);
  console.log('[SEED] Seeding complete. System is ready.');
  console.log('[SEED] Login: daniel.solomon@rentms.com / 123456');
}

main()
  .catch((e) => {
    console.error('[SEED ERROR]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
