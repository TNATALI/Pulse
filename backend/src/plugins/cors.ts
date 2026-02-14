import cors from '@fastify/cors';
import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

async function corsPluginFn(app: FastifyInstance) {
  await app.register(cors, {
    origin: true,
    credentials: true,
  });
}

export const corsPlugin = fp(corsPluginFn, { name: 'cors' });
