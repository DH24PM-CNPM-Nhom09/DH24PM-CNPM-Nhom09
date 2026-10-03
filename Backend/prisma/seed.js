const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const programs = [
    { code: 'CNTT', name: 'Công nghệ thông tin' },
    { code: 'KHMT', name: 'Khoa học máy tính' },
    { code: 'QTKD', name: 'Quản trị kinh doanh' },
  ];
  for (const p of programs) {
    await prisma.program.upsert({ where: { code: p.code }, update: {}, create: p });
  }
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: { email: 'admin@example.com', fullName: 'Quản trị viên', role: 'ADMIN' },
  });
}

main().finally(() => prisma.$disconnect());
