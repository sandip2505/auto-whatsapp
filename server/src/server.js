import http from 'http';
import { createApp } from './app.js';
import config from './config/index.js';
import { initDb, closeDb } from './database/db.js';
import logger from './services/logger.service.js';
import whatsappService from './services/whatsapp.service.js';
import schedulerService from './services/scheduler.service.js';

let server = null;

async function bootstrap() {
  console.log('----------------------------------------------------');
  console.log(`WhatsApp Message Scheduler — v${config.appVersion}`);
  console.log(`Node.js: ${process.version} | OS: ${process.platform}`);
  console.log(`Environment: ${config.nodeEnv} | Host: ${config.host}:${config.port}`);
  console.log(`Mock WhatsApp Mode: ${config.whatsappMock ? 'ENABLED (Testing)' : 'DISABLED (Live Session)'}`);
  console.log('----------------------------------------------------');

  try {
    // 1. Initialize SQLite Database
    logger.info('system', 'Initializing database connection and schema...');
    await initDb();
    logger.info('system', 'Database initialized successfully.');

    // 2. Initialize Scheduler Service
    logger.info('system', 'Starting scheduler service...');
    await schedulerService.start();

    // 3. Initialize WhatsApp Client Service
    logger.info('system', 'Initializing WhatsApp Web client...');
    whatsappService.initialize().catch(err => {
      logger.error('whatsapp', `WhatsApp initial startup error: ${err.message}`);
    });

    // 4. Start HTTP Server
    const app = createApp();
    server = http.createServer(app);

    server.listen(config.port, config.host, () => {
      logger.info('system', `Server listening on http://${config.host}:${config.port}`);
      logger.info('system', `API base url: http://${config.host}:${config.port}/api`);
    });

  } catch (err) {
    console.error('Fatal startup error:', err);
    process.exit(1);
  }
}

// Graceful shutdown handling
async function shutdown(signal) {
  logger.info('system', `Received ${signal}. Performing graceful shutdown...`);

  // Stop scheduler
  try {
    schedulerService.stop();
  } catch (e) {
    console.error('Error stopping scheduler:', e);
  }

  // Destroy WhatsApp client
  try {
    await whatsappService.destroy();
  } catch (e) {
    console.error('Error closing WhatsApp client:', e);
  }

  // Close HTTP server
  if (server) {
    server.close(() => {
      logger.info('system', 'HTTP server closed.');
    });
  }

  // Close database
  try {
    await closeDb();
    logger.info('system', 'Database connection closed.');
  } catch (e) {
    console.error('Error closing database:', e);
  }

  setTimeout(() => {
    logger.info('system', 'Shutdown completed. Exiting.');
    process.exit(0);
  }, 1000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('system', 'Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('system', 'Uncaught Exception:', err.message);
});

bootstrap();
