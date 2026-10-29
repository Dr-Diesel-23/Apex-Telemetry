import { Series, SessionType } from '@prisma/client';

/**
 * Single source of truth for the demo/seed grid.
 *
 * The seed script writes this into PostgreSQL, and the services fall back to it
 * when the database is unreachable so the dashboard still renders. IDs are
 * deterministic (`ref_*`) which makes the fallback stable across restarts.
 */

export interface ReferenceDriver {
  code: string;
  driverNumber: number;
  fullName: string;
  teamName: string;
  series: Series;
  points: number;
  wins: number;
  podiums: number;
}

export interface ReferenceConstructor {
  name: string;
  series: Series;
  points: number;
  colorHex: string;
}

export interface ReferenceCircuit {
  key: string;
  name: string;
  /** Short label for tight UI slots (e.g. "COTA"). */
  shortName: string;
  country: string;
  latitude: number;
  longitude: number;
  lengthKm: number;
}

export interface ReferenceSession {
  key: string;
  series: Series;
  sessionType: SessionType;
  circuitKey: string;
  /** Minutes relative to process start — negative values are in the past. */
  startOffsetMinutes: number;
  isActive: boolean;
}

export interface ReferenceNewsItem {
  key: string;
  title: string;
  summary: string;
  series: Series;
  sourceUrl: string;
  imageUrl: string | null;
  publishedOffsetMinutes: number;
}

export const REFERENCE_DRIVERS: ReferenceDriver[] = [
  // ── Formula 1 ────────────────────────────────────────────────────────────
  {
    code: 'VER',
    driverNumber: 1,
    fullName: 'Max Verstappen',
    teamName: 'Red Bull Racing',
    series: Series.F1,
    points: 437,
    wins: 9,
    podiums: 14,
  },
  {
    code: 'NOR',
    driverNumber: 4,
    fullName: 'Lando Norris',
    teamName: 'McLaren',
    series: Series.F1,
    points: 401,
    wins: 7,
    podiums: 15,
  },
  {
    code: 'PIA',
    driverNumber: 81,
    fullName: 'Oscar Piastri',
    teamName: 'McLaren',
    series: Series.F1,
    points: 389,
    wins: 7,
    podiums: 14,
  },
  {
    code: 'LEC',
    driverNumber: 16,
    fullName: 'Charles Leclerc',
    teamName: 'Ferrari',
    series: Series.F1,
    points: 288,
    wins: 2,
    podiums: 10,
  },
  {
    code: 'HAM',
    driverNumber: 44,
    fullName: 'Lewis Hamilton',
    teamName: 'Ferrari',
    series: Series.F1,
    points: 241,
    wins: 1,
    podiums: 7,
  },
  {
    code: 'RUS',
    driverNumber: 63,
    fullName: 'George Russell',
    teamName: 'Mercedes',
    series: Series.F1,
    points: 236,
    wins: 1,
    podiums: 6,
  },

  // ── Formula 2 (2026 prospects) ───────────────────────────────────────────
  {
    code: 'CAM',
    driverNumber: 1,
    fullName: 'Rafael Câmara',
    teamName: 'Invicta Racing',
    series: Series.F2,
    points: 168,
    wins: 4,
    podiums: 7,
  },
  {
    code: 'GOE',
    driverNumber: 2,
    fullName: 'Oliver Goethe',
    teamName: 'Campos Racing',
    series: Series.F2,
    points: 151,
    wins: 3,
    podiums: 6,
  },
  {
    code: 'BEG',
    driverNumber: 3,
    fullName: 'Dino Beganovic',
    teamName: 'Hitech TGR',
    series: Series.F2,
    points: 144,
    wins: 3,
    podiums: 5,
  },
  {
    code: 'LIN',
    driverNumber: 4,
    fullName: 'Arvid Lindblad',
    teamName: 'PREMA Racing',
    series: Series.F2,
    points: 139,
    wins: 2,
    podiums: 6,
  },
  {
    code: 'MIN',
    driverNumber: 5,
    fullName: 'Gabriele Minì',
    teamName: 'ART Grand Prix',
    series: Series.F2,
    points: 121,
    wins: 2,
    podiums: 4,
  },
  {
    code: 'DUN',
    driverNumber: 6,
    fullName: 'Alexander Dunne',
    teamName: 'MP Motorsport',
    series: Series.F2,
    points: 98,
    wins: 1,
    podiums: 3,
  },

  // ── MotoGP ───────────────────────────────────────────────────────────────
  {
    code: 'MAR',
    driverNumber: 93,
    fullName: 'Marc Márquez',
    teamName: 'Ducati Lenovo Team',
    series: Series.MOTOGP,
    points: 421,
    wins: 11,
    podiums: 16,
  },
  {
    code: 'BAG',
    driverNumber: 63,
    fullName: 'Francesco Bagnaia',
    teamName: 'Ducati Lenovo Team',
    series: Series.MOTOGP,
    points: 356,
    wins: 6,
    podiums: 13,
  },
  {
    code: 'MART',
    driverNumber: 89,
    fullName: 'Jorge Martín',
    teamName: 'Aprilia Racing',
    series: Series.MOTOGP,
    points: 302,
    wins: 4,
    podiums: 11,
  },
  {
    code: 'ACO',
    driverNumber: 37,
    fullName: 'Pedro Acosta',
    teamName: 'Red Bull KTM Factory Racing',
    series: Series.MOTOGP,
    points: 274,
    wins: 3,
    podiums: 9,
  },
  {
    code: 'BEZ',
    driverNumber: 72,
    fullName: 'Marco Bezzecchi',
    teamName: 'Aprilia Racing',
    series: Series.MOTOGP,
    points: 219,
    wins: 2,
    podiums: 6,
  },
];

export const REFERENCE_CONSTRUCTORS: ReferenceConstructor[] = [
  { name: 'McLaren', series: Series.F1, points: 790, colorHex: '#FF8000' },
  { name: 'Red Bull Racing', series: Series.F1, points: 641, colorHex: '#3671C6' },
  { name: 'Ferrari', series: Series.F1, points: 529, colorHex: '#E8002D' },
  { name: 'Mercedes', series: Series.F1, points: 447, colorHex: '#27F4D2' },

  { name: 'Invicta Racing', series: Series.F2, points: 255, colorHex: '#00A19C' },
  { name: 'Campos Racing', series: Series.F2, points: 233, colorHex: '#F2A900' },
  { name: 'Hitech TGR', series: Series.F2, points: 219, colorHex: '#0033A0' },
  { name: 'PREMA Racing', series: Series.F2, points: 208, colorHex: '#E4002B' },
  { name: 'ART Grand Prix', series: Series.F2, points: 187, colorHex: '#1B1B1B' },
  { name: 'MP Motorsport', series: Series.F2, points: 164, colorHex: '#FF6A00' },

  { name: 'Ducati Lenovo Team', series: Series.MOTOGP, points: 777, colorHex: '#CC0000' },
  { name: 'Aprilia Racing', series: Series.MOTOGP, points: 521, colorHex: '#00A0DE' },
  { name: 'Red Bull KTM Factory Racing', series: Series.MOTOGP, points: 412, colorHex: '#FF6600' },
];

export const REFERENCE_CIRCUITS: ReferenceCircuit[] = [
  { key: 'silverstone', name: 'Silverstone Circuit', shortName: 'Silverstone', country: 'United Kingdom', latitude: 52.0786, longitude: -1.0169, lengthKm: 5.891 },
  { key: 'monza', name: 'Autodromo Nazionale Monza', shortName: 'Monza', country: 'Italy', latitude: 45.6156, longitude: 9.2811, lengthKm: 5.793 },
  { key: 'spa', name: 'Circuit de Spa-Francorchamps', shortName: 'Spa', country: 'Belgium', latitude: 50.4372, longitude: 5.9714, lengthKm: 7.004 },
  { key: 'barcelona', name: 'Circuit de Barcelona-Catalunya', shortName: 'Barcelona', country: 'Spain', latitude: 41.57, longitude: 2.2611, lengthKm: 4.657 },
  { key: 'mugello', name: 'Autodromo del Mugello', shortName: 'Mugello', country: 'Italy', latitude: 43.9975, longitude: 11.3719, lengthKm: 5.245 },
  { key: 'jerez', name: 'Circuito de Jerez-Ángel Nieto', shortName: 'Jerez', country: 'Spain', latitude: 36.7083, longitude: -6.0342, lengthKm: 4.428 },
  { key: 'bahrain', name: 'Bahrain International Circuit', shortName: 'Bahrain', country: 'Bahrain', latitude: 26.0325, longitude: 50.5106, lengthKm: 5.412 },
  { key: 'suzuka', name: 'Suzuka International Racing Course', shortName: 'Suzuka', country: 'Japan', latitude: 34.8431, longitude: 136.5407, lengthKm: 5.807 },
  { key: 'cota', name: 'Circuit of the Americas', shortName: 'COTA', country: 'United States', latitude: 30.1328, longitude: -97.6411, lengthKm: 5.513 },
  { key: 'interlagos', name: 'Autódromo José Carlos Pace', shortName: 'Interlagos', country: 'Brazil', latitude: -23.7036, longitude: -46.6997, lengthKm: 4.309 },
  { key: 'losail', name: 'Lusail International Circuit', shortName: 'Lusail', country: 'Qatar', latitude: 25.49, longitude: 51.454, lengthKm: 5.38 },
  { key: 'redbullring', name: 'Red Bull Ring', shortName: 'Red Bull Ring', country: 'Austria', latitude: 47.2197, longitude: 14.7647, lengthKm: 4.318 },
];

export const REFERENCE_SESSIONS: ReferenceSession[] = [
  { key: 'f1-race-silverstone', series: Series.F1, sessionType: SessionType.RACE, circuitKey: 'silverstone', startOffsetMinutes: -42, isActive: true },
  { key: 'f1-quali-spa', series: Series.F1, sessionType: SessionType.QUALIFYING, circuitKey: 'spa', startOffsetMinutes: -1_460, isActive: false },
  { key: 'f2-race-barcelona', series: Series.F2, sessionType: SessionType.RACE, circuitKey: 'barcelona', startOffsetMinutes: -26, isActive: false },
  { key: 'f2-sprint-monza', series: Series.F2, sessionType: SessionType.SPRINT, circuitKey: 'monza', startOffsetMinutes: -3_120, isActive: false },
  { key: 'motogp-race-mugello', series: Series.MOTOGP, sessionType: SessionType.RACE, circuitKey: 'mugello', startOffsetMinutes: -18, isActive: false },
  { key: 'motogp-quali-jerez', series: Series.MOTOGP, sessionType: SessionType.QUALIFYING, circuitKey: 'jerez', startOffsetMinutes: -4_400, isActive: false },
];

export const REFERENCE_NEWS: ReferenceNewsItem[] = [
  {
    key: 'verstappen-silverstone-pole',
    title: 'Verstappen edges Norris by 0.041s in Silverstone qualifying thriller',
    summary:
      'A late Q3 flyer from Max Verstappen denied Lando Norris a home pole position, with the top four covered by less than a tenth.',
    series: Series.F1,
    sourceUrl: 'https://www.formula1.com/en/latest',
    imageUrl: 'https://images.unsplash.com/photo-1504707748692-419802cf939d?auto=format&fit=crop&w=1200&q=70',
    publishedOffsetMinutes: -95,
  },
  {
    key: 'mclaren-team-orders',
    title: 'McLaren confirm free-to-race policy for the final six rounds',
    summary:
      'Andrea Stella says Piastri and Norris will continue to race each other while the constructors’ title remains mathematically open.',
    series: Series.F1,
    sourceUrl: 'https://www.mclaren.com/racing/',
    imageUrl: 'https://images.unsplash.com/photo-1541443131876-44b03de101c5?auto=format&fit=crop&w=1200&q=70',
    publishedOffsetMinutes: -240,
  },
  {
    key: 'camara-f2-barcelona-win',
    title: 'Câmara converts reverse-grid pole into commanding Barcelona feature win',
    summary:
      'The Invicta driver managed the tyres through a 28-lap opening stint and pulled 6.2s clear of Goethe in the closing laps.',
    series: Series.F2,
    sourceUrl: 'https://www.fiaformula2.com/Latest',
    imageUrl: 'https://images.unsplash.com/photo-1580274455191-1c62238fa333?auto=format&fit=crop&w=1200&q=70',
    publishedOffsetMinutes: -320,
  },
  {
    key: 'lindblad-prema-upgrade',
    title: 'PREMA bring revised floor to Monza as Lindblad chases rookie crown',
    summary:
      'The Italian squad used its final in-season upgrade allocation on a low-drag floor package aimed at the Temple of Speed.',
    series: Series.F2,
    sourceUrl: 'https://www.fiaformula2.com/Latest',
    imageUrl: null,
    publishedOffsetMinutes: -600,
  },
  {
    key: 'marquez-mugello-domination',
    title: 'Márquez takes seventh win of the year after Mugello masterclass',
    summary:
      'Marc Márquez led every lap from pole and set a new race-lap record on his way to a 4.8-second victory over Bagnaia.',
    series: Series.MOTOGP,
    sourceUrl: 'https://www.motogp.com/en/news',
    imageUrl: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1200&q=70',
    publishedOffsetMinutes: -70,
  },
  {
    key: 'acosta-ktm-contract',
    title: 'Acosta signs KTM extension through 2028',
    summary:
      'Pedro Acosta has committed his future to the Austrian manufacturer, ending speculation of a switch to the factory Ducati seat.',
    series: Series.MOTOGP,
    sourceUrl: 'https://www.motogp.com/en/news',
    imageUrl: null,
    publishedOffsetMinutes: -1_120,
  },
  {
    key: 'rain-threat-silverstone',
    title: 'Rain threat grows for Silverstone race start',
    summary:
      'Radar models put the chance of a shower inside the first 15 laps at 55%, with track temperatures dropping sharply after sunset.',
    series: Series.F1,
    sourceUrl: 'https://www.formula1.com/en/latest',
    imageUrl: null,
    publishedOffsetMinutes: -35,
  },
  {
    key: 'motogp-tyre-allocation',
    title: 'Michelin confirm softer rear allocation for the flyaway triple-header',
    summary:
      'The softer rear compound returns for Motegi, Phillip Island and Sepang after rider feedback on warm-up performance.',
    series: Series.MOTOGP,
    sourceUrl: 'https://www.motogp.com/en/news',
    imageUrl: null,
    publishedOffsetMinutes: -1_500,
  },
];

/** Deterministic IDs used by the degraded-mode fallback. */
export const referenceIds = {
  driver: (code: string) => `ref_driver_${code.toLowerCase()}`,
  constructor: (name: string) =>
    `ref_team_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
  circuit: (key: string) => `ref_circuit_${key}`,
  session: (key: string) => `ref_session_${key}`,
  news: (key: string) => `ref_news_${key}`,
};
