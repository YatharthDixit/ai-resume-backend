// src/config/index.js
const dotenv = require('dotenv');
const path = require('path');
const z = require('zod');

// Load .env file
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Define a schema for environment variables
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8080),
  ROLE: z.enum(['web', 'worker']).default('web'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  AWS_REGION: z.string().min(1, 'AWS_REGION is required'),
  AWS_ACCESS_KEY_ID: z.string().min(1, 'AWS_ACCESS_KEY_ID is required'),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, 'AWS_SECRET_ACCESS_KEY is required'),
  AWS_SQS_QUEUE_URL: z.string().min(1, 'AWS_SQS_QUEUE_URL is required'),
  LEASE_TTL_MS: z.coerce.number().default(90000),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().default(5000),
  DEFAULT_RETENTION_HOURS: z.coerce.number().default(24),
  MAX_ATTEMPTS: z.coerce.number().default(3),
  LLM_API_KEYS: z.string().min(1, 'LLM_API_KEYS is required'),
  LLM_MODEL: z.string().default('gemini-1.5-flash'),
  LLM_TIMEOUT_MS: z.coerce.number().default(60000),
  OPENROUTER_API_KEY: z.string().default(''),
  OPENROUTER_MODEL: z.string().default('openai/gpt-4o'),
});

// Parse and validate
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    '❌ Invalid environment variables:',
    parsedEnv.error.format()
  );
  process.exit(1);
}

const config = parsedEnv.data;

// Export the validated config
module.exports = {
  env: config.NODE_ENV,
  port: config.PORT,
  role: config.ROLE,
  leaseTtlMs: config.LEASE_TTL_MS,
  pollIntervalMs: config.WORKER_POLL_INTERVAL_MS,
  retentionHours: config.DEFAULT_RETENTION_HOURS,
  maxAttempts: config.MAX_ATTEMPTS,
  llm: {
    model: config.LLM_MODEL,
    timeout: config.LLM_TIMEOUT_MS,
    // Split comma-separated keys into an array
    apiKeys: config.LLM_API_KEYS.split(','),
  },
  openRouter: {
    apiKey: config.OPENROUTER_API_KEY,
    model: config.OPENROUTER_MODEL,
  },
  aws: {
    region: config.AWS_REGION,
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    sqsQueueUrl: config.AWS_SQS_QUEUE_URL,
  },
  mongoose: {
    url: config.MONGODB_URI,
    options: {
      // Mongoose 6+ options are simplified
    },
  },
};