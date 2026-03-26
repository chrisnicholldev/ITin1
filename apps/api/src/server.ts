import 'dotenv/config';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { redis } from './config/redis.js';
import { initJwt } from './config/jwt.js';
import { bootstrapSuperAdmin } from './modules/auth/auth.service.js';
import { bootstrapCategories } from './modules/categories/category.service.js';
import { startWorkers, stopWorkers } from './jobs/queues.js';
import { createApp } from './app.js';

async function main() {
  // Validate env (already parsed in env.ts, but ensures it runs at startup)
  console.log(`[server] Starting in ${env.NODE_ENV} mode`);

  // Init dependencies
  await connectDatabase();
  await redis.connect();
  await initJwt();

  // Bootstrap
  await bootstrapSuperAdmin();
  await bootstrapCategories();

  // Start background workers
  await startWorkers();

  // Start server
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`[server] Listening on http://0.0.0.0:${env.PORT}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[server] ${signal} received — shutting down`);
    await stopWorkers();
    server.close(async () => {
      await disconnectDatabase();
      await redis.quit();
      console.log('[server] Shutdown complete');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[server] Fatal error:', err);
  process.exit(1);
});
