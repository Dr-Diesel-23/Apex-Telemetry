import { Router } from 'express';
import overviewRoutes from './overview.routes';
import standingsRoutes from './standings.routes';
import telemetryRoutes from './telemetry.routes';
import tyresRoutes from './tyres.routes';
import scheduleRoutes from './schedule.routes';
import { env } from '../config/env';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    service: 'ApexTelemetry API',
    version: 'v1',
    endpoints: [
      'GET /api/v1/overview/live?series=f1',
      'GET /api/v1/overview/predictions?series=f1',
      'GET /api/v1/overview/news?series=f1&limit=20',
      'GET /api/v1/:series/standings/drivers',
      'GET /api/v1/:series/standings/constructors',
      'GET /api/v1/:series/telemetry/compare?driver1=VER&driver2=NOR',
      'GET /api/v1/:series/tyres',
      'GET /api/v1/:series/schedule',
    ],
    websocket: `${env.WS_PATH} (${env.wsBroadcastHz} Hz)`,
  });
});

router.use('/overview', overviewRoutes);
router.use('/:series/standings', standingsRoutes);
router.use('/:series/telemetry', telemetryRoutes);
router.use('/:series/tyres', tyresRoutes);
router.use('/:series/schedule', scheduleRoutes);

export default router;
export { router as apiRouter };
