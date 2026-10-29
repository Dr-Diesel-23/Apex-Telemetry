import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as telemetry from '../controllers/telemetry.controller';

/** Mounted at /api/v1/:series/telemetry — mergeParams exposes `:series`. */
const router = Router({ mergeParams: true });

router.get('/compare', asyncHandler(telemetry.compare));

export default router;
