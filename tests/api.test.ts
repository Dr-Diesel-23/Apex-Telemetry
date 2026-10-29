import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app';

const api = request(app);

describe('service health', () => {
  it('GET /health reports the database and websocket state', async () => {
    const res = await api.get('/health').expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.database).toEqual({ provider: 'postgresql', status: 'up' });
    expect(res.body.websocket.path).toBe('/ws/telemetry');
    expect(res.body.websocket.sampleRateHz).toBe(2);
  });

  it('GET /api/v1/health mirrors the health payload', async () => {
    const res = await api.get('/api/v1/health').expect(200);
    expect(res.body.service).toBe('apex-telemetry-backend');
  });

  it('GET /api/v1 lists the public endpoints', async () => {
    const res = await api.get('/api/v1').expect(200);

    expect(res.body.version).toBe('v1');
    expect(res.body.endpoints.length).toBeGreaterThanOrEqual(6);
    expect(res.body.websocket).toContain('/ws/telemetry');
  });
});

describe('GET /api/v1/overview/live', () => {
  it('returns the active F1 race, weather and a full leaderboard', async () => {
    const res = await api.get('/api/v1/overview/live').expect(200);
    const { session, weather, leaderboard, meta } = res.body;

    expect(session.series).toBe('F1');
    expect(session.sessionType).toBe('RACE');
    expect(session.isActive).toBe(true);
    expect(session.circuit.name).toBe('Silverstone Circuit');
    expect(session.progressPct).toBeGreaterThanOrEqual(0);
    expect(session.progressPct).toBeLessThanOrEqual(100);

    expect(['open-meteo', 'fallback']).toContain(weather.source);
    expect(weather.trackTempC).toBeTypeOf('number');
    expect(weather.rainProbability).toBeGreaterThanOrEqual(0);

    expect(leaderboard).toHaveLength(6);
    expect(leaderboard.map((driver: { code: string }) => driver.code)).toContain('VER');
    for (const driver of leaderboard) {
      expect(driver.speed).toBeGreaterThan(0);
      expect(driver.gear).toBeGreaterThanOrEqual(1);
      expect(driver.gear).toBeLessThanOrEqual(8);
      expect(driver.throttle).toBeGreaterThanOrEqual(0);
      expect(driver.throttle).toBeLessThanOrEqual(100);
      expect(driver.teamColor).toMatch(/^#[0-9A-F]{6}$/i);
    }

    expect(meta.sampleRateHz).toBe(2);
    expect(meta.websocketPath).toBe('/ws/telemetry');
    expect(meta.degraded).toBe(false);
  });

  it('honours the series filter', async () => {
    const res = await api.get('/api/v1/overview/live?series=motogp').expect(200);

    expect(res.body.session.series).toBe('MOTOGP');
    expect(res.body.session.circuit.name).toBe('Autodromo del Mugello');
    expect(res.body.leaderboard).toHaveLength(5);
  });

  it('rejects an unknown series', async () => {
    const res = await api.get('/api/v1/overview/live?series=nascar').expect(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});

describe('GET /api/v1/overview/predictions', () => {
  it('returns normalised win probabilities ordered by likelihood', async () => {
    const res = await api.get('/api/v1/overview/predictions?series=f1').expect(200);
    const { predictions, model, favourites } = res.body;

    expect(model.simulated).toBe(true);
    expect(model.type).toBe('monte-carlo');
    expect(predictions).toHaveLength(6);
    expect(favourites.mostLikelyPodium).toHaveLength(3);

    const total = predictions.reduce(
      (sum: number, entry: { winProbability: number }) => sum + entry.winProbability,
      0,
    );
    expect(total).toBeGreaterThan(98);
    expect(total).toBeLessThan(102);

    predictions.forEach((entry: { position: number; winProbability: number; podiumProbability: number }, index: number) => {
      expect(entry.position).toBe(index + 1);
      expect(entry.podiumProbability).toBeGreaterThanOrEqual(entry.winProbability);
      if (index > 0) {
        expect(entry.winProbability).toBeLessThanOrEqual(predictions[index - 1].winProbability);
      }
    });

    expect(predictions[0].code).toBe(favourites.mostLikelyWinner);
  });

  it('requires a series', async () => {
    const res = await api.get('/api/v1/overview/predictions').expect(400);
    expect(res.body.error.message).toContain('series');
  });
});

describe('GET /api/v1/overview/news', () => {
  it('returns the feed newest-first', async () => {
    const res = await api.get('/api/v1/overview/news?limit=5').expect(200);

    expect(res.body.items).toHaveLength(5);
    const timestamps = res.body.items.map((item: { publishedAt: string }) =>
      new Date(item.publishedAt).getTime(),
    );
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
    expect(res.body.items[0].sourceUrl).toMatch(/^https?:\/\//);
  });

  it('filters by series', async () => {
    const res = await api.get('/api/v1/overview/news?series=motogp&limit=10').expect(200);

    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(item.series).toBe('MOTOGP');
    }
  });

  it('validates the limit', async () => {
    const res = await api.get('/api/v1/overview/news?limit=0').expect(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});

describe('standings', () => {
  it('GET /:series/standings/drivers returns ordered standings with gaps', async () => {
    const res = await api.get('/api/v1/f1/standings/drivers').expect(200);
    const { standings } = res.body;

    expect(standings).toHaveLength(6);
    expect(standings[0].code).toBe('VER');
    expect(standings[0].position).toBe(1);
    expect(standings[0].gapToLeader).toBe(0);

    standings.forEach(
      (
        entry: { position: number; points: number; gapToLeader: number },
        index: number,
      ) => {
        expect(entry.position).toBe(index + 1);
        expect(entry.gapToLeader).toBeCloseTo(standings[0].points - entry.points, 1);
        if (index > 0) {
          expect(entry.points).toBeLessThanOrEqual(standings[index - 1].points);
        }
      },
    );
  });

  it('GET /:series/standings/constructors returns ordered teams with colours', async () => {
    const res = await api.get('/api/v1/f1/standings/constructors').expect(200);

    expect(res.body.standings).toHaveLength(4);
    expect(res.body.standings[0].name).toBe('McLaren');
    expect(res.body.standings[0].colorHex).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('accepts series aliases', async () => {
    await api.get('/api/v1/formula-1/standings/drivers').expect(200);
    await api.get('/api/v1/moto-gp/standings/constructors').expect(200);
  });

  it('rejects an unknown series', async () => {
    const res = await api.get('/api/v1/indycar/standings/drivers').expect(400);
    expect(res.body.error.message).toContain('Unknown series');
  });
});

describe('GET /:series/telemetry/compare', () => {
  it('compares two drivers using stored samples', async () => {
    const res = await api
      .get('/api/v1/f1/telemetry/compare?driver1=VER&driver2=NOR')
      .expect(200);

    expect(res.body.series).toBe('F1');
    expect(res.body.session.circuit.name).toBe('Silverstone Circuit');
    expect(res.body.window.sampleCount).toBe(10);
    expect(res.body.window.sampleIntervalMs).toBe(30_000);
    expect(res.body.drivers).toHaveLength(2);

    const [first, second] = res.body.drivers;
    expect([first.code, second.code].sort()).toEqual(['NOR', 'VER']);
    for (const driver of res.body.drivers) {
      expect(driver.samples).toHaveLength(10);
      expect(driver.stats.maxSpeed).toBeGreaterThan(driver.stats.minSpeed);
      expect(driver.stats.topGear).toBeGreaterThanOrEqual(1);
      expect(driver.stats.drsUsagePct).toBeGreaterThanOrEqual(0);
      expect(driver.samples[0]).toMatchObject({
        speed: expect.any(Number),
        rpm: expect.any(Number),
        gear: expect.any(Number),
        throttle: expect.any(Number),
        brake: expect.any(Number),
        drs: expect.any(Boolean),
      });
    }

    expect(['VER', 'NOR']).toContain(res.body.delta.fasterDriver);
    expect(res.body.delta.maxSpeedKph).toBeGreaterThanOrEqual(0);
  });

  it('accepts a custom sample limit', async () => {
    const res = await api
      .get('/api/v1/f1/telemetry/compare?driver1=VER&driver2=NOR&limit=5')
      .expect(200);

    expect(res.body.window.sampleCount).toBe(5);
  });

  it('returns 404 for a driver outside the series', async () => {
    const res = await api
      .get('/api/v1/f2/telemetry/compare?driver1=VER&driver2=NOR')
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.details.availableDrivers).toContain('CAM');
  });

  it('rejects identical drivers', async () => {
    const res = await api
      .get('/api/v1/f1/telemetry/compare?driver1=VER&driver2=VER')
      .expect(400);

    expect(res.body.error.message).toContain('different');
  });

  it('rejects a missing driver parameter', async () => {
    const res = await api.get('/api/v1/f1/telemetry/compare?driver1=VER').expect(400);
    expect(res.body.error.details[0].path).toBe('driver2');
  });
});

describe('unknown routes', () => {
  it('returns a structured 404', async () => {
    const res = await api.get('/api/v1/does-not-exist').expect(404);

    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(res.body.error.message).toContain('/api/v1/does-not-exist');
  });
});
