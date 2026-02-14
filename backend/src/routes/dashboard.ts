import { FastifyInstance } from 'fastify';
import { getDashboardInsights } from '../services/dashboard-insights.js';

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/insights', async () => {
    return getDashboardInsights();
  });
}
