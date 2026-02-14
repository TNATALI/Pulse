import Fastify from 'fastify';
import { config } from './config.js';
import { corsPlugin } from './plugins/cors.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';
import { registerRoutes } from './routes/index.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      transport:
        config.nodeEnv === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  await app.register(corsPlugin);
  await app.register(errorHandlerPlugin);
  await registerRoutes(app);

  return app;
}
