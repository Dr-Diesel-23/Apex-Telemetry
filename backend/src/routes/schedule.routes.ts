import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as schedule from '../controllers/schedule.controller';

/** Mounted at /api/v1/:series/schedule — mergeParams exposes `:series`. */
const router = Router({ mergeParams: true });

router.get('/', asyncHandler(schedule.schedule));

export default router;
