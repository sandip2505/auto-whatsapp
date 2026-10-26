import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root or server directory
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  host: process.env.HOST || '127.0.0.1',
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  databasePath: path.resolve(__dirname, '../../../', process.env.DATABASE_PATH || './data/scheduler.db'),
  whatsappSessionPath: path.resolve(__dirname, '../../../', process.env.WHATSAPP_SESSION_PATH || './data/whatsapp_session'),
  defaultTimezone: process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata',
  defaultCountryCode: process.env.DEFAULT_COUNTRY_CODE || '+91',
  missedJobPolicy: process.env.MISSED_JOB_POLICY || 'skip', // 'skip' | 'manual_retry'
  maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3', 10),
  retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '60000', 10),
  whatsappMock: process.env.WHATSAPP_MOCK === 'true',
  puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  puppeteerHeadless: process.env.PUPPETEER_HEADLESS !== 'false',
  appVersion: '1.0.0'
};

export default config;
