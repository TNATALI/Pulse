import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',

  database: {
    url: process.env.DATABASE_URL || 'postgresql://pulse:pulse@localhost:5432/pulse',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  slack: {
    botToken: process.env.SLACK_BOT_TOKEN || '',
    signingSecret: process.env.SLACK_SIGNING_SECRET || '',
  },

  github: {
    token: process.env.GITHUB_TOKEN || '',
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY || '',
  },
} as const;
