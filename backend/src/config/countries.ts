/**
 * Country name → ISO 3166-1 alpha-2 code.
 *
 * The F1 calendar (Jolpica) only returns country *names*, while the dashboard
 * needs a two-letter code to render a flag (`flagcdn.com/w40/{code}.png`).
 * The MotoGP feed (Pulse Live) already returns ISO-2 codes.
 */
const COUNTRY_CODES: Record<string, string> = {
  australia: 'AU',
  austria: 'AT',
  azerbaijan: 'AZ',
  bahrain: 'BH',
  belgium: 'BE',
  brazil: 'BR',
  canada: 'CA',
  china: 'CN',
  france: 'FR',
  germany: 'DE',
  hungary: 'HU',
  italy: 'IT',
  japan: 'JP',
  malaysia: 'MY',
  mexico: 'MX',
  monaco: 'MC',
  netherlands: 'NL',
  portugal: 'PT',
  qatar: 'QA',
  russia: 'RU',
  'saudi arabia': 'SA',
  singapore: 'SG',
  'south korea': 'KR',
  korea: 'KR',
  spain: 'ES',
  turkey: 'TR',
  uae: 'AE',
  'united arab emirates': 'AE',
  uk: 'GB',
  'united kingdom': 'GB',
  'great britain': 'GB',
  usa: 'US',
  us: 'US',
  'united states': 'US',
  'united states of america': 'US',
  'united states of america (usa)': 'US',
};

/** ISO-2 code for a country name/code, or `null` when unknown. */
export function countryCode(country: string | null | undefined): string | null {
  if (!country) return null;

  const value = country.trim();
  if (!value) return null;

  // Already an ISO-2 code (Pulse Live).
  if (/^[A-Za-z]{2}$/.test(value)) return value.toUpperCase();

  return COUNTRY_CODES[value.toLowerCase()] ?? null;
}
