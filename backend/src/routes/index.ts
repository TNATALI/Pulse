import { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.js';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(healthRoutes);

  // Future route registrations:
  // await app.register(dashboardRoutes, { prefix: '/api/dashboard' });
  // await app.register(slackRoutes, { prefix: '/api/slack' });
  // await app.register(githubRoutes, { prefix: '/api/github' });
  // await app.register(usersRoutes, { prefix: '/api/users' });
  // await app.register(settingsRoutes, { prefix: '/api/settings' });
  // await app.register(syncRoutes, { prefix: '/api/sync' });
  // await app.register(exportRoutes, { prefix: '/api/export' });
}
