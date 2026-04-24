import { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.js';
import { settingsRoutes } from './settings.js';
import { slackRoutes } from './slack.js';
import { githubRoutes } from './github.js';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(healthRoutes);
  await app.register(settingsRoutes, { prefix: '/api/settings' });
  await app.register(slackRoutes, { prefix: '/api/slack' });
  await app.register(githubRoutes, { prefix: '/api/github' });
}
