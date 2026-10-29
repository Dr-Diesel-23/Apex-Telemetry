import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as overview from '../controllers/overview.controller';

const router = Router();

router.get('/live', asyncHandler(overview.live));
router.get('/predictions', asyncHandler(overview.predictions));
router.get('/news', asyncHandler(overview.news));

export default router;
