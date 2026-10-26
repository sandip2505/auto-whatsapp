import { Router } from 'express';
import {
  listSchedules,
  getSchedule,
  createSchedule,
  updateSchedule,
  updateStatus,
  deleteSchedule,
  duplicateSchedule
} from '../controllers/schedule.controller.js';

const router = Router();

router.get('/', listSchedules);
router.post('/', createSchedule);
router.get('/:id', getSchedule);
router.put('/:id', updateSchedule);
router.patch('/:id/status', updateStatus);
router.delete('/:id', deleteSchedule);
router.post('/:id/duplicate', duplicateSchedule);

export default router;
