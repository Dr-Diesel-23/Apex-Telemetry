import 'dotenv/config';
import { PrismaClient, Series, SessionType } from '@prisma/client';
import {
  REFERENCE_CIRCUITS,
  REFERENCE_CONSTRUCTORS,
  REFERENCE_DRIVERS,
  REFERENCE_NEWS,
  REFERENCE_SESSIONS,
  referenceIds,
} from '../src/config/referenceData';
import { simulateFrame } from '../src/services/simulation.service';

const prisma = new PrismaClient();

const TELEMETRY_TOTAL = 100;
const SAMPLE_INTERVAL_MS = 30_000;

/** Points per driver, per seeded session — sums to exactly 100. */
const TELEMETRY_PLAN: Array<{ sessionKey: string; perDriver: number; extra?: { code: string; count: number } }> = [
  { sessionKey: 'f1-race-silverstone', perDriver: 10 }, // 6 drivers → 60
  { sessionKey: 'f2-race-barcelona', perDriver: 4, extra: { code: 'CAM', count: 1 } }, // 6 × 4 + 1 → 25
  { sessionKey: 'motogp-race-mugello', perDriver: 3 }, // 5 drivers → 15
];

async function seedCircuits(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const circuit of REFERENCE_CIRCUITS) {
    const record = await prisma.circuit.upsert({
      where: { name_country: { name: circuit.name, country: circuit.country } },
      update: {
        latitude: circuit.latitude,
        longitude: circuit.longitude,
        lengthKm: circuit.lengthKm,
      },
      create: {
        name: circuit.name,
        country: circuit.country,
        latitude: circuit.latitude,
        longitude: circuit.longitude,
        lengthKm: circuit.lengthKm,
      },
    });
    ids.set(circuit.key, record.id);
  }

  console.log(`✔ circuits: ${ids.size}`);
  return ids;
}

async function seedDrivers(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const driver of REFERENCE_DRIVERS) {
    const record = await prisma.driver.upsert({
      where: { code: driver.code },
      update: {
        driverNumber: driver.driverNumber,
        fullName: driver.fullName,
        teamName: driver.teamName,
        series: driver.series,
        points: driver.points,
        wins: driver.wins,
        podiums: driver.podiums,
      },
      create: {
        driverNumber: driver.driverNumber,
        code: driver.code,
        fullName: driver.fullName,
        teamName: driver.teamName,
        series: driver.series,
        points: driver.points,
        wins: driver.wins,
        podiums: driver.podiums,
      },
    });
    ids.set(driver.code, record.id);
  }

  console.log(`✔ drivers: ${ids.size}`);
  return ids;
}

async function seedConstructors(): Promise<void> {
  for (const constructor of REFERENCE_CONSTRUCTORS) {
    await prisma.constructor.upsert({
      where: { name: constructor.name },
      update: {
        series: constructor.series,
        points: constructor.points,
        colorHex: constructor.colorHex,
      },
      create: {
        name: constructor.name,
        series: constructor.series,
        points: constructor.points,
        colorHex: constructor.colorHex,
      },
    });
  }

  console.log(`✔ constructors: ${REFERENCE_CONSTRUCTORS.length}`);
}

async function seedSessions(circuitIds: Map<string, string>): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  const now = Date.now();

  for (const session of REFERENCE_SESSIONS) {
    const circuitId = circuitIds.get(session.circuitKey);
    if (!circuitId) {
      throw new Error(`Unknown circuit key '${session.circuitKey}' in session seed data.`);
    }

    const startTime = new Date(now + session.startOffsetMinutes * 60_000);
    const id = `seed_session_${session.key.replace(/-/g, '_')}`;

    const record = await prisma.session.upsert({
      where: { id },
      update: {
        series: session.series,
        sessionType: session.sessionType,
        circuitId,
        startTime,
        isActive: session.isActive,
      },
      create: {
        id,
        series: session.series,
        sessionType: session.sessionType,
        circuitId,
        startTime,
        isActive: session.isActive,
      },
    });

    ids.set(session.key, record.id);
  }

  console.log(`✔ sessions: ${ids.size}`);
  return ids;
}

async function seedTelemetry(
  sessionIds: Map<string, string>,
  driverIds: Map<string, string>,
): Promise<void> {
  const seededSessionIds = [...sessionIds.values()];

  // Idempotent: wipe telemetry for seeded sessions before re-inserting.
  await prisma.telemetry.deleteMany({ where: { sessionId: { in: seededSessionIds } } });

  const rows: Array<{
    sessionId: string;
    driverId: string;
    speed: number;
    rpm: number;
    gear: number;
    throttle: number;
    brake: number;
    drs: boolean;
    timestamp: Date;
  }> = [];

  for (const plan of TELEMETRY_PLAN) {
    const sessionSeed = REFERENCE_SESSIONS.find((session) => session.key === plan.sessionKey);
    const sessionId = sessionIds.get(plan.sessionKey);
    if (!sessionSeed || !sessionId) continue;

    const drivers = REFERENCE_DRIVERS.filter((driver) => driver.series === sessionSeed.series);
    const sessionStart = Date.now() + sessionSeed.startOffsetMinutes * 60_000;

    drivers.forEach((driver, driverIndex) => {
      const driverId = driverIds.get(driver.code);
      if (!driverId) return;

      const extraPoints =
        plan.extra && plan.extra.code === driver.code ? plan.extra.count : 0;

      for (let point = 0; point < plan.perDriver + extraPoints; point += 1) {
        const at = sessionStart + point * SAMPLE_INTERVAL_MS + driverIndex * 37;
        const frame = simulateFrame(driver.code, sessionSeed.series, at);

        rows.push({
          sessionId,
          driverId,
          speed: frame.speed,
          rpm: frame.rpm,
          gear: frame.gear,
          throttle: frame.throttle,
          brake: frame.brake,
          drs: frame.drs,
          timestamp: new Date(at),
        });
      }
    });
  }

  const limited = rows.slice(0, TELEMETRY_TOTAL);

  await prisma.telemetry.createMany({ data: limited });
  console.log(`✔ telemetry: ${limited.length} historical points`);
}

async function seedWeather(sessionIds: Map<string, string>): Promise<void> {
  await prisma.weatherLog.deleteMany({
    where: { sessionId: { in: [...sessionIds.values()] } },
  });

  const profiles: Record<Series, { trackTemp: number; airTemp: number; rain: number }> = {
    F1: { trackTemp: 41.5, airTemp: 24.2, rain: 55 },
    F2: { trackTemp: 38.8, airTemp: 26.4, rain: 10 },
    MOTOGP: { trackTemp: 46.2, airTemp: 29.1, rain: 5 },
  };

  const rows = REFERENCE_SESSIONS.flatMap((session) => {
    const sessionId = sessionIds.get(session.key);
    if (!sessionId) return [];
    const profile = profiles[session.series];

    return Array.from({ length: 3 }, (_, index) => ({
      sessionId,
      trackTemp: profile.trackTemp - index * 0.6,
      airTemp: profile.airTemp - index * 0.2,
      rainProbability: profile.rain,
      recordedAt: new Date(Date.now() - index * 10 * 60_000),
    }));
  });

  await prisma.weatherLog.createMany({ data: rows });
  console.log(`✔ weather logs: ${rows.length}`);
}

async function seedNews(): Promise<void> {
  const now = Date.now();

  for (const item of REFERENCE_NEWS) {
    const id = referenceIds.news(item.key);

    await prisma.newsItem.upsert({
      where: { id },
      update: {
        title: item.title,
        summary: item.summary,
        series: item.series,
        sourceUrl: item.sourceUrl,
        imageUrl: item.imageUrl,
        publishedAt: new Date(now + item.publishedOffsetMinutes * 60_000),
      },
      create: {
        id,
        title: item.title,
        summary: item.summary,
        series: item.series,
        sourceUrl: item.sourceUrl,
        imageUrl: item.imageUrl,
        publishedAt: new Date(now + item.publishedOffsetMinutes * 60_000),
      },
    });
  }

  console.log(`✔ news items: ${REFERENCE_NEWS.length}`);
}

async function main(): Promise<void> {
  console.log('\n🏁 ApexTelemetry — seeding database\n');

  const circuitIds = await seedCircuits();
  const driverIds = await seedDrivers();
  await seedConstructors();
  const sessionIds = await seedSessions(circuitIds);
  await seedTelemetry(sessionIds, driverIds);
  await seedWeather(sessionIds);
  await seedNews();

  const [drivers, constructors, circuits, sessions, telemetry, news] = await Promise.all([
    prisma.driver.count(),
    prisma.constructor.count(),
    prisma.circuit.count(),
    prisma.session.count(),
    prisma.telemetry.count(),
    prisma.newsItem.count(),
  ]);

  const active = await prisma.session.findFirst({
    where: { isActive: true, sessionType: SessionType.RACE },
    include: { circuit: true },
  });

  console.log('\n─── Seed summary ───────────────────────────────');
  console.log(` drivers:      ${drivers}`);
  console.log(` constructors: ${constructors}`);
  console.log(` circuits:     ${circuits}`);
  console.log(` sessions:     ${sessions}`);
  console.log(` telemetry:    ${telemetry}`);
  console.log(` news:         ${news}`);
  console.log(
    ` active race:  ${
      active ? `${active.series} ${active.sessionType} @ ${active.circuit.name}` : 'none'
    }`,
  );
  console.log('────────────────────────────────────────────────\n');
}

main()
  .catch((error: unknown) => {
    console.error('✖ Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
