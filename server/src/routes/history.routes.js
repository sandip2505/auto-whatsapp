import { Router } from 'express';
import { listHistory, getHistoryItem, retryExecution, clearHistory } from '../controllers/history.controller.js';

const router = Router();

router.get('/', listHistory);
router.get('/:id', getHistoryItem);
router.post('/:id/retry', retryExecution);
router.delete('/', clearHistory);

export default router;
