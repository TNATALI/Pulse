import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { AppError } from '../lib/errors.js';

async function errorHandlerPluginFn(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.name,
        message: error.message,
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    });
  });
}

export const errorHandlerPlugin = fp(errorHandlerPluginFn, { name: 'error-handler' });
