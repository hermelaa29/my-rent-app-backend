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

  // 1. Create LESSOR
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
  });

  // 2. Create LESSEE
  const lessee = await prisma.user.create({
    data: {
      name: 'Abebe Bekele',
      email: 'abebe.tenant@rentms.com',
      phone: '0988776655',
      password: passwordHash,
      role: 'LESSEE',
      isVerified: true,
      isActive: true,
    },
  });

  // 3. Create a Property
  const property = await prisma.property.create({
    data: {
      title: 'Luxury Villa - Bole Atlas',
      description: 'Stunning 4-bedroom villa with a private garden and modern amenities.',
      location: 'Addis Ababa, Bole Atlas',
      price: 2500,
      isAvailable: false,
      lessorId: lessor.id,
    },
  });

  // 4. Create a Contract
  await prisma.contract.create({
    data: {
      propertyId: property.id,
      lessorId: lessor.id,
      lesseeId: lessee.id,
      startDate: new Date(),
      endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
      rentAmount: 2500,
      reminderDay: 5,
      status: 'ACTIVE',
    },
  });

  console.log('[SEED] Seeding complete.');
  console.log('--------------------------------------------------');
  console.log('LESSOR (Owner):');
  console.log('  Email:    daniel.solomon@rentms.com');
  console.log('  Password: 123456');
  console.log('--------------------------------------------------');
  console.log('LESSEE (Tenant):');
  console.log('  Email:    abebe.tenant@rentms.com');
  console.log('  Password: 123456');
  console.log('--------------------------------------------------');
}

main()
  .catch(e => { console.error('[SEED ERROR]', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
