import axios from 'axios';
import { env } from '../config/env';
import { cache } from './cache.service';
import { clamp, round, seededRandom } from '../utils/random';
import { logger } from '../utils/logger';

export interface WeatherSnapshot {
  source: 'open-meteo' | 'openf1' | 'fallback';
  fetchedAt: string;
  airTempC: number;
  trackTempC: number;
  rainProbability: number;
  humidity: number;
  windSpeedKph: number;
  precipitationMm: number;
  isRaining: boolean;
  condition: string;
  conditionCode: number;
  nextHours: Array<{ time: string; airTempC: number; rainProbability: number }>;
}

interface OpenMeteoResponse {
  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    rain?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    precipitation_probability?: number[];
  };
}

const WMO_CONDITIONS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  80: 'Rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Severe thunderstorm with hail',
};

const http = axios.create({ timeout: 5_000, headers: { Accept: 'application/json' } });

/**
 * Open-Meteo is free but not unlimited. p-queue caps concurrent/outbound
 * request rate so a cold cache + traffic spike can't hammer the upstream API.
 * (p-queue is ESM-only, hence the lazy dynamic import from this CJS build.)
 */
let queuePromise: Promise<OutboundQueue> | null = null;

interface OutboundQueue {
  add<T>(task: () => Promise<T>): Promise<T | void>;
}

function weatherQueue(): Promise<OutboundQueue> {
  queuePromise ??= import('p-queue').then(
    ({ default: PQueue }) =>
      new PQueue({ concurrency: 4, interval: 1_000, intervalCap: 8 }),
  );
  return queuePromise;
}

function conditionFor(code: number): string {
  return WMO_CONDITIONS[code] ?? 'Unknown';
}

/** Asphalt runs hotter than air; sun angle, wind and cloud cover all matter. */
function estimateTrackTemp(airTemp: number, windKph: number, code: number, hour: number): number {
  const daylight = hour >= 7 && hour <= 19;
  const solarGain = daylight ? 11 : -1.5;
  const cloudPenalty = code >= 3 ? 0.45 : 1;
  const windPenalty = clamp(windKph / 40, 0, 0.5);
  return round(airTemp + solarGain * cloudPenalty * (1 - windPenalty), 1);
}

function fallbackWeather(latitude: number, longitude: number): WeatherSnapshot {
  const random = seededRandom(`weather:${latitude.toFixed(2)}:${longitude.toFixed(2)}:${new Date().toISOString().slice(0, 13)}`);
  const hour = new Date().getUTCHours();
  const airTemp = round(18 + random() * 12 + Math.sin(((hour - 6) / 24) * Math.PI * 2) * 5, 1);
  const code = random() > 0.75 ? 61 : random() > 0.4 ? 2 : 0;
  const rainProbability = code >= 51 ? Math.round(55 + random() * 35) : Math.round(random() * 30);
  const windSpeedKph = round(6 + random() * 18, 1);

  return {
    source: 'fallback',
    fetchedAt: new Date().toISOString(),
    airTempC: airTemp,
    trackTempC: estimateTrackTemp(airTemp, windSpeedKph, code, hour),
    rainProbability,
    humidity: Math.round(45 + random() * 40),
    windSpeedKph,
    precipitationMm: code >= 51 ? round(random() * 2.4, 1) : 0,
    isRaining: code >= 51,
    condition: conditionFor(code),
    conditionCode: code,
    nextHours: Array.from({ length: 3 }, (_, index) => ({
      time: new Date(Date.now() + (index + 1) * 3_600_000).toISOString(),
      airTempC: round(airTemp + (random() - 0.5) * 2, 1),
      rainProbability: clamp(rainProbability + Math.round((random() - 0.5) * 20), 0, 100),
    })),
  };
}

export async function getWeather(
  latitude: number,
  longitude: number,
): Promise<WeatherSnapshot> {
  const key = `weather:v1:${latitude.toFixed(3)}:${longitude.toFixed(3)}`;
  const cached = await cache.get<WeatherSnapshot>(key);
  if (cached) return cached;

  const url = env.OPEN_METEO_BASE_URL;
  const params = {
    latitude,
    longitude,
    current: 'temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,precipitation_probability',
    forecast_days: 1,
    timezone: 'auto',
  };

  try {
    const queue = await weatherQueue();
    const response = await queue.add(() => http.get<OpenMeteoResponse>(url, { params }));
    if (!response) {
      throw new Error('Weather request was dropped before execution.');
    }
    const { data } = response;
    const current = data.current ?? {};
    const airTemp = current.temperature_2m ?? 20;
    const windSpeed = current.wind_speed_10m ?? 10;
    const code = current.weather_code ?? 0;
    const hourlyTimes = data.hourly?.time ?? [];
    const hourlyTemps = data.hourly?.temperature_2m ?? [];
    const hourlyRain = data.hourly?.precipitation_probability ?? [];

    const nowIndex = Math.max(
      0,
      hourlyTimes.findIndex((time) => new Date(time).getTime() >= Date.now() - 3_600_000),
    );

    const snapshot: WeatherSnapshot = {
      source: 'open-meteo',
      fetchedAt: new Date().toISOString(),
      airTempC: round(airTemp, 1),
      trackTempC: estimateTrackTemp(airTemp, windSpeed, code, new Date().getHours()),
      rainProbability: Math.round(hourlyRain[nowIndex] ?? (code >= 51 ? 80 : 10)),
      humidity: Math.round(current.relative_humidity_2m ?? 55),
      windSpeedKph: round(windSpeed, 1),
      precipitationMm: round(current.precipitation ?? 0, 2),
      isRaining: code >= 51 || (current.rain ?? 0) > 0,
      condition: conditionFor(code),
      conditionCode: code,
      nextHours: Array.from({ length: 3 }, (_, offset) => {
        const index = Math.min(nowIndex + offset + 1, hourlyTimes.length - 1);
        return {
          time: hourlyTimes[index] ?? new Date(Date.now() + (offset + 1) * 3_600_000).toISOString(),
          airTempC: round(hourlyTemps[index] ?? airTemp, 1),
          rainProbability: Math.round(hourlyRain[index] ?? 0),
        };
      }),
    };

    await cache.set(key, snapshot, env.WEATHER_CACHE_TTL_SECONDS);
    return snapshot;
  } catch (error) {
    logger.warn('weather.open_meteo_failed', {
      message: error instanceof Error ? error.message : String(error),
      hint: 'Serving deterministic fallback weather.',
    });
    const snapshot = fallbackWeather(latitude, longitude);
    await cache.set(key, snapshot, 60);
    return snapshot;
  }
}
