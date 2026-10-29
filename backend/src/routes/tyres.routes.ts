import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as tyres from '../controllers/tyres.controller';

/** Mounted at /api/v1/:series/tyres — mergeParams exposes `:series`. */
const router = Router({ mergeParams: true });

router.get('/', asyncHandler(tyres.tyres));

export default router;
