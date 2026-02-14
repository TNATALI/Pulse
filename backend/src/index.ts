import { buildApp } from './app.js';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { startSlackSyncWorker } from './workers/slack-sync.js';

async function main() {
  const app = await buildApp();
  startSlackSyncWorker();

  try {
    await app.listen({ port: config.port, host: config.host });
    logger.info(`Server running on http://${config.host}:${config.port}`);
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }
}

main();
