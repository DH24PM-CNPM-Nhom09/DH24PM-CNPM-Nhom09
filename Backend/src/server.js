const { PrismaClient } = require('@prisma/client');
const config = require('./config');
const { createApp } = require('./app');

const prisma = new PrismaClient();
const app = createApp({ prisma, config });

const server = app.listen(config.port, () => {
  console.log(`API chạy tại cổng ${config.port}`);
});

process.on('SIGTERM', async () => {
  server.close();
  await prisma.$disconnect();
});
