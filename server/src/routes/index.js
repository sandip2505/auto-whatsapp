import { Router } from 'express';
import whatsappRoutes from './whatsapp.routes.js';
import scheduleRoutes from './schedule.routes.js';
import historyRoutes from './history.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import settingsRoutes from './settings.routes.js';
import config from '../config/index.js';
import whatsappService from '../services/whatsapp.service.js';
import { DateTime } from 'luxon';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: DateTime.utc().toISO(),
    version: config.appVersion,
    whatsappStatus: whatsappService.getStatus().status,
    uptime: process.uptime()
  });
});

// Mount modules
router.use('/whatsapp', whatsappRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/history', historyRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/settings', settingsRoutes);

export default router;
