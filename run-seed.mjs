import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const { UserRole } = await import('@prisma/client');

async function main() {
  console.log('[SEED] Wiping all tables...');
  await prisma.reminder.deleteMany();
  await prisma.lateFee.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.property.deleteMany();
  await prisma.user.deleteMany();
  console.log('[SEED] All tables cleared.');

  const passwordHash = await bcrypt.hash('123456', 12);
  const lessor = await prisma.user.create({
    data: {
      name: 'Daniel Solomon',
      email: 'daniel.solomon@rentms.com',
      phone: '0911223344',
      password: passwordHash,
      role: 'LESSOR',
      isVerified: true,
      isActive: true,
    },
    select: { id: true, email: true, role: true },
  });

  console.log(`[SEED] Lessor created: ${lessor.email} (${lessor.id})`);
  console.log('[SEED] Done. Login: daniel.solomon@rentms.com / 123456');
}

main()
  .catch(e => { console.error('[SEED ERROR]', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
