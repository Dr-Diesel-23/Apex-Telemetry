import { Series } from '@prisma/client';
import { clamp, round, seededRandom } from '../utils/random';

export interface SimulatedFrame {
  driverCode: string;
  speed: number;
  rpm: number;
  gear: number;
  throttle: number;
  brake: number;
  drs: boolean;
  timestamp: string;
}

interface SeriesProfile {
  cruise: number;
  amplitude: number;
  maxRpm: number;
  idleRpm: number;
  topGear: number;
}

const PROFILES: Record<Series, SeriesProfile> = {
  F1: { cruise: 232, amplitude: 92, maxRpm: 15_000, idleRpm: 4_000, topGear: 8 },
  F2: { cruise: 205, amplitude: 78, maxRpm: 8_750, idleRpm: 3_000, topGear: 6 },
  MOTOGP: { cruise: 196, amplitude: 86, maxRpm: 18_000, idleRpm: 5_000, topGear: 6 },
};

const GEAR_BANDS: Record<Series, number[]> = {
  F1: [0, 65, 105, 145, 185, 225, 265, 300],
  F2: [0, 55, 95, 140, 185, 230],
  MOTOGP: [0, 55, 100, 145, 190, 240],
};

function speedAt(code: string, series: Series, atMs: number): number {
  const profile = PROFILES[series];
  const random = seededRandom(`sim:${code}:${series}`);
  const phase = (atMs / 1_000) * (0.55 + random() * 0.25) + random() * Math.PI * 2;
  const wave = Math.sin(phase) * 0.72 + Math.sin(phase * 2.35 + 1.1) * 0.2 + Math.sin(phase * 0.37) * 0.08;
  return clamp(profile.cruise + wave * profile.amplitude, 45, 355);
}

function gearFor(speed: number, series: Series): number {
  const bands = GEAR_BANDS[series];
  let gear = 1;
  for (let index = 1; index < bands.length; index += 1) {
    if (speed >= bands[index]) gear = index + 1;
  }
  return Math.min(gear, PROFILES[series].topGear);
}

/** Deterministic on-track simulation — the same instant yields the same frame. */
export function simulateFrame(code: string, series: Series, atMs = Date.now()): SimulatedFrame {
  const profile = PROFILES[series];
  const speed = speedAt(code, series, atMs);
  const lookahead = speedAt(code, series, atMs + 120);
  const delta = lookahead - speed;

  const throttle = clamp(52 + delta * 2.6 + Math.sin(atMs / 900) * 12, 0, 100);
  const braking = delta < -1.5 ? clamp(-delta * 9, 0, 100) : 0;
  const gear = gearFor(speed, series);
  const gearLoad = gear / profile.topGear;
  const rpm = Math.round(
    clamp(profile.idleRpm + gearLoad * (profile.maxRpm - profile.idleRpm) * 0.72 + throttle * 22, profile.idleRpm, profile.maxRpm),
  );

  return {
    driverCode: code,
    speed: round(speed, 1),
    rpm,
    gear,
    throttle: round(throttle, 1),
    brake: round(braking, 1),
    drs: speed > 255 && throttle > 92 && braking === 0,
    timestamp: new Date(atMs).toISOString(),
  };
}

export function seriesProfile(series: Series): SeriesProfile {
  return PROFILES[series];
}
