import { FastifyInstance } from 'fastify';
import { SETTING_KEYS, type SettingKey } from '@pulse/shared';
import { getAllSettings, upsertSettings, deleteSetting } from '../services/settings.js';
import { resetAllData } from '../services/reset-data.js';

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const settingsList = await getAllSettings();
    return { settings: settingsList };
  });

  app.put('/', async (request, reply) => {
    const { settings: inputs } = request.body as { settings: { key: string; value: string }[] };

    if (!Array.isArray(inputs) || inputs.length === 0) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'settings array is required' });
    }

    for (const input of inputs) {
      if (!SETTING_KEYS.includes(input.key as SettingKey)) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: `Invalid setting key: ${input.key}` });
      }
      if (typeof input.value !== 'string' || input.value.length === 0) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: `Value for ${input.key} must be a non-empty string` });
      }
    }

    const settingsList = await upsertSettings(inputs as { key: SettingKey; value: string }[]);
    return { settings: settingsList };
  });

  app.delete('/:key', async (request, reply) => {
    const { key } = request.params as { key: string };

    if (!SETTING_KEYS.includes(key as SettingKey)) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: `Invalid setting key: ${key}` });
    }

    await deleteSetting(key as SettingKey);
    return { success: true };
  });

  app.post('/reset-data', async (request, reply) => {
    const { confirmation } = (request.body ?? {}) as { confirmation?: string };

    if (confirmation !== 'RESET ALL DATA') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'You must send { "confirmation": "RESET ALL DATA" } to confirm.',
      });
    }

    const result = await resetAllData();
    return { success: true, ...result };
  });
}
