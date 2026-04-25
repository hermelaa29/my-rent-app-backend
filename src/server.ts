import 'dotenv/config';
import { createServer } from 'node:http';
import { env } from './utils/env.js';
import { createApp } from './app.js';
import { prisma } from './prisma/client.js';

async function bootstrap(): Promise<void> {
  await prisma.$connect();

  const app = createApp();
  const server = createServer(app);

  server.listen(env.port, () => {
    console.info(`HTTP server listening on port ${env.port} (${env.nodeEnv})`);
  });

  const shutdown = async (signal: string) => {
    console.info(`${signal} received, shutting down gracefully`);
    server.close(() => console.info('HTTP server closed'));
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void bootstrap().catch((err: unknown) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
