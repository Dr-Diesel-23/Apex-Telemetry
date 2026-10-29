/**
 * Official 2026 Formula 1 entrant names.
 *
 * OpenF1 (and most timing feeds) expose short commercial names such as
 * `Ferrari`, `Audi` or `Haas F1 Team`. The dashboard shows the full official
 * team name instead, matching the FIA entry list / F1.com.
 *
 * Source: FIA 2026 F1 entry list (published 2025-12-19).
 */
const F1_TEAM_NAMES: Record<string, string> = {
  // 2026 grid — official entrant names.
  mclaren: 'McLaren Mastercard F1 Team',
  mercedes: 'Mercedes-AMG PETRONAS Formula One Team',
  'red bull racing': 'Oracle Red Bull Racing',
  'red bull': 'Oracle Red Bull Racing',
  ferrari: 'Scuderia Ferrari HP',
  williams: 'Atlassian Williams F1 Team',
  'racing bulls': 'Visa Cash App Racing Bulls F1 Team',
  'rb f1 team': 'Visa Cash App Racing Bulls F1 Team',
  'aston martin': 'Aston Martin Aramco Formula One Team',
  'haas f1 team': 'TGR Haas F1 Team',
  haas: 'TGR Haas F1 Team',
  audi: 'Audi Revolut F1 Team',
  sauber: 'Audi Revolut F1 Team',
  'kick sauber': 'Audi Revolut F1 Team',
  alpine: 'BWT Alpine Formula One Team',
  cadillac: 'Cadillac Formula 1 Team',

  // Already-official spellings (idempotent so the mapper can be re-applied).
  'mclaren mastercard f1 team': 'McLaren Mastercard F1 Team',
  'mercedes-amg petronas formula one team': 'Mercedes-AMG PETRONAS Formula One Team',
  'oracle red bull racing': 'Oracle Red Bull Racing',
  'scuderia ferrari hp': 'Scuderia Ferrari HP',
  'atlassian williams f1 team': 'Atlassian Williams F1 Team',
  'visa cash app racing bulls f1 team': 'Visa Cash App Racing Bulls F1 Team',
  'aston martin aramco formula one team': 'Aston Martin Aramco Formula One Team',
  'tgr haas f1 team': 'TGR Haas F1 Team',
  'audi revolut f1 team': 'Audi Revolut F1 Team',
  'bwt alpine formula one team': 'BWT Alpine Formula One Team',
  'cadillac formula 1 team': 'Cadillac Formula 1 Team',
};

/**
 * Resolves a timing-feed team name to its official 2026 entrant name.
 * Unknown names (MotoGP, F2, new entrants) pass through unchanged.
 */
export function fullTeamName(teamName: string | null | undefined): string {
  if (!teamName) return 'Unknown';

  const trimmed = teamName.trim();
  if (!trimmed) return 'Unknown';

  return F1_TEAM_NAMES[trimmed.toLowerCase()] ?? trimmed;
}

/**
 * Short team name used inside compact telemetry rows where the full name would
 * not fit (`Scuderia Ferrari HP` → `Ferrari`).
 */
export function shortTeamName(teamName: string | null | undefined): string {
  const full = fullTeamName(teamName);

  const short: Record<string, string> = {
    'McLaren Mastercard F1 Team': 'McLaren',
    'Mercedes-AMG PETRONAS Formula One Team': 'Mercedes',
    'Oracle Red Bull Racing': 'Red Bull',
    'Scuderia Ferrari HP': 'Ferrari',
    'Atlassian Williams F1 Team': 'Williams',
    'Visa Cash App Racing Bulls F1 Team': 'Racing Bulls',
    'Aston Martin Aramco Formula One Team': 'Aston Martin',
    'TGR Haas F1 Team': 'Haas',
    'Audi Revolut F1 Team': 'Audi',
    'BWT Alpine Formula One Team': 'Alpine',
    'Cadillac Formula 1 Team': 'Cadillac',
  };

  return short[full] ?? full;
}
