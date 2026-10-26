import { Router } from 'express';
import { getSettings, updateSettings, getSystemLogs, clearSystemLogs } from '../controllers/settings.controller.js';

const router = Router();

router.get('/', getSettings);
router.put('/', updateSettings);
router.get('/logs', getSystemLogs);
router.delete('/logs', clearSystemLogs);

export default router;
