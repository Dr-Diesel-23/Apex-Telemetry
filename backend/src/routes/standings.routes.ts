import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as standings from '../controllers/standings.controller';

/** Mounted at /api/v1/:series/standings — mergeParams exposes `:series`. */
const router = Router({ mergeParams: true });

router.get('/drivers', asyncHandler(standings.drivers));
router.get('/constructors', asyncHandler(standings.constructors));

export default router;
