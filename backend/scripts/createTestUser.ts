import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const password = "123456";
  const saltRounds = 12;
  const hash = await bcrypt.hash(password, saltRounds);

  console.log('Generated hash:', hash);

  const userData = {
    name: "Admin",
    email: "admin@test.com",
    phone: "0911111111",
    password: hash,
    role: UserRole.LESSOR,
    isVerified: true,
  };

  const user = await prisma.user.upsert({
    where: { email: userData.email },
    update: userData,
    create: userData,
  });

  console.log('User created/updated:', user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
