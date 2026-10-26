import { Router } from 'express';
import { getStatus, getQr, logout, reconnect } from '../controllers/whatsapp.controller.js';

const router = Router();

router.get('/status', getStatus);
router.get('/qr', getQr);
router.post('/logout', logout);
router.post('/reconnect', reconnect);

export default router;
