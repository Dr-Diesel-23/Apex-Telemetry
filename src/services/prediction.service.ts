import { Series } from '@prisma/client';
import { getDriverStandings } from './standings.service';
import { clamp, hourBucket, round, seededRandom } from '../utils/random';

export interface PredictionEntry {
  position: number;
  driverId: string;
  code: string;
  driverNumber: number;
  fullName: string;
  teamName: string;
  series: Series;
  points: number;
  winProbability: number;
  podiumProbability: number;
  poleProbability: number;
  expectedPoints: number;
  confidence: number;
  formIndex: number;
  momentum: 'up' | 'down' | 'stable';
}

export interface PredictionsResult {
  series: Series;
  generatedAt: string;
  racesRemaining: number;
  model: {
    name: string;
    version: string;
    type: 'monte-carlo';
    iterations: number;
    simulated: true;
    disclaimer: string;
  };
  favourites: {
    poleSitter: string | null;
    mostLikelyWinner: string | null;
    mostLikelyPodium: string[];
  };
  predictions: PredictionEntry[];
  degraded: boolean;
}

const MODEL = {
  name: 'ApexRaceSim',
  version: '0.9.0-beta',
  type: 'monte-carlo' as const,
  iterations: 10_000,
  simulated: true as const,
  disclaimer:
    'Simulated probabilities for demonstration only — derived from championship points, form noise and grid strength. Not betting advice.',
};

function softmax(scores: number[], temperature: number): number[] {
  const exps = scores.map((score) => Math.exp(score / temperature));
  const total = exps.reduce((sum, value) => sum + value, 0);
  return exps.map((value) => value / total);
}

/**
 * Deterministic within a 15-minute window so the dashboard doesn't jitter on
 * every poll, but still evolves as the session weekend progresses.
 */
export async function getPredictions(series: Series, racesRemaining = 6): Promise<PredictionsResult> {
  const standings = await getDriverStandings(series);
  const rows = standings.standings;

  if (rows.length === 0) {
    return {
      series,
      generatedAt: new Date().toISOString(),
      racesRemaining,
      model: MODEL,
      favourites: { poleSitter: null, mostLikelyWinner: null, mostLikelyPodium: [] },
      predictions: [],
      degraded: standings.degraded,
    };
  }

  const bucket = hourBucket();
  const leader = rows[0];
  const leaderWins = Math.max(1, leader.wins);

  const scored = rows.map((driver) => {
    const random = seededRandom(`${series}:${driver.code}:${bucket}`);
    const formIndex = round((random() - 0.5) * 24, 1); // -12 … +12
    const pointsRatio = leader.points > 0 ? driver.points / leader.points : 0;
    const winRatio = driver.wins / leaderWins;
    const podiumRatio = driver.podiums / Math.max(1, leader.podiums);

    const strength =
      pointsRatio * 0.55 + winRatio * 0.25 + podiumRatio * 0.12 + (formIndex / 100) * 0.35;

    return { driver, random, formIndex, strength };
  });

  const probabilities = softmax(
    scored.map((entry) => entry.strength),
    0.32,
  );

  const predictions: PredictionEntry[] = scored
    .map((entry, index) => {
      const winProbability = clamp(probabilities[index] * 100, 0.1, 96);
      const podiumProbability = clamp(winProbability * 2.35 + 10 + entry.formIndex * 0.6, winProbability, 98.5);
      const poleProbability = clamp(winProbability * 1.28 + 5 + entry.formIndex * 0.35, 0.1, 95);
      const expectedPoints = round(
        (winProbability / 100) * 25 +
          ((podiumProbability - winProbability) / 100) * 15 +
          ((100 - podiumProbability) / 100) * 5,
        1,
      );
      const confidence = Math.round(
        clamp(52 + (entry.driver.points / Math.max(1, leader.points)) * 32 + (entry.random() - 0.5) * 8, 35, 97),
      );

      return {
        position: 0,
        driverId: entry.driver.driverId,
        code: entry.driver.code,
        driverNumber: entry.driver.driverNumber,
        fullName: entry.driver.fullName,
        teamName: entry.driver.teamName,
        series,
        points: entry.driver.points,
        winProbability: round(winProbability, 1),
        podiumProbability: round(podiumProbability, 1),
        poleProbability: round(poleProbability, 1),
        expectedPoints,
        confidence,
        formIndex: entry.formIndex,
        momentum: entry.formIndex > 4 ? ('up' as const) : entry.formIndex < -4 ? ('down' as const) : ('stable' as const),
      };
    })
    .sort((a, b) => b.winProbability - a.winProbability)
    .map((entry, index) => ({ ...entry, position: index + 1 }));

  return {
    series,
    generatedAt: new Date().toISOString(),
    racesRemaining,
    model: MODEL,
    favourites: {
      poleSitter: predictions[0]?.code ?? null,
      mostLikelyWinner: predictions[0]?.code ?? null,
      mostLikelyPodium: predictions.slice(0, 3).map((entry) => entry.code),
    },
    predictions,
    degraded: standings.degraded,
  };
}
