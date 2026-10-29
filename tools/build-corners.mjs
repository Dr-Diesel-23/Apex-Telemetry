/**
 * Builds `corners.js`: a real photograph of each circuit's signature corner,
 * sourced from Wikimedia Commons (CC / public domain) with attribution.
 *
 *   node tools/build-corners.mjs
 *
 * Strategy per circuit:
 *   1. Search Commons for the corner by name (`Eau Rouge`, `Tarzan`, ...) and
 *      accept only a landscape JPEG whose title actually mentions the corner or
 *      the circuit (so unrelated search hits are discarded).
 *   2. Otherwise use the Wikipedia lead image of the circuit article — still a
 *      real photo of that circuit, never a map or a stock car.
 *
 * Every entry keeps `title`, `credit` and `license` so the UI can attribute it.
 * When a circuit has no photo the dashboard keeps the SVG corner trace.
 */

import { writeFileSync } from 'node:fs';

const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const WIKI = 'https://en.wikipedia.org/api/rest_v1/page/summary';
const UA = 'ApexTelemetry/1.0 (dashboard asset builder)';

const CIRCUITS = [
  { key: 'albert_park', corner: 'Turn 3', search: 'Albert Park Circuit Melbourne corner', article: 'Albert Park Circuit', file: 'File:Albert Park & Australia Grand Prix Circuit.jpg' },
  { key: 'shanghai', corner: 'Turn 1', search: 'Shanghai International Circuit turn 1', article: 'Shanghai International Circuit' },
  { key: 'suzuka', corner: '130R', search: 'Suzuka Circuit 130R', article: 'Suzuka International Racing Course' },
  { key: 'miami', corner: 'Turn 11', search: 'Miami International Autodrome', article: 'Miami International Autodrome' },
  { key: 'villeneuve', corner: 'Wall of Champions', search: 'Wall of Champions Circuit Gilles Villeneuve', article: 'Circuit Gilles Villeneuve' },
  { key: 'monaco', corner: 'Fairmont Hairpin', search: 'Fairmont Hairpin Monaco', article: 'Circuit de Monaco' },
  { key: 'catalunya', corner: 'Turn 9', search: 'Circuit de Barcelona-Catalunya corner', article: 'Circuit de Barcelona-Catalunya', file: 'File:Circuit de Catalunya, Barcelona (Ank Kumar) 01.jpg' },
  { key: 'red_bull_ring', corner: 'Turn 3', search: 'Red Bull Ring Spielberg corner', article: 'Red Bull Ring', file: 'File:Start-Ziel Red Bull Ring.jpg' },
  { key: 'silverstone', corner: 'Copse', search: 'Copse Silverstone corner', article: 'Silverstone Circuit' },
  { key: 'spa', corner: 'Eau Rouge', search: 'Eau Rouge corner Spa Francorchamps -snow', article: 'Circuit de Spa-Francorchamps', file: 'File:Eau Rouge 1997.jpg' },
  { key: 'hungaroring', corner: 'Turn 1', search: 'Hungaroring turn 1', article: 'Hungaroring' },
  { key: 'zandvoort', corner: 'Tarzan', search: 'Tarzan corner Zandvoort', article: 'Circuit Zandvoort', file: 'File:Circuit Park Zandvoort Rennstrecke Formel 1 (40889939003).jpg' },
  { key: 'monza', corner: 'Parabolica', search: 'Curva Parabolica Monza', article: 'Monza Circuit' },
  { key: 'madring', corner: 'Turn 1', search: 'Madring Madrid circuit', article: 'Madring', skip: true },
  { key: 'baku', corner: 'Castle Section', search: 'Baku City Circuit castle section', article: 'Baku City Circuit', file: 'File:Baku City Circuit, April 9, 2018 SkySat.jpg' },
  { key: 'sepang', corner: 'Turn 1', search: 'Sepang International Circuit corner', article: 'Sepang International Circuit', file: 'File:Bird-eye view of KLIA and Sepang F1 Circuit - panoramio.jpg' },
  { key: 'marina_bay', corner: 'Turn 10', search: 'Marina Bay Street Circuit corner', article: 'Marina Bay Street Circuit' },
  { key: 'americas', corner: 'Turn 1', search: 'Circuit of the Americas turn 1', article: 'Circuit of the Americas', file: 'File:2018 US Grand Prix at the Circuit of the Americas.jpg' },
  { key: 'rodriguez', corner: 'Peraltada', search: 'Peraltada Autodromo Hermanos Rodriguez', article: 'Autódromo Hermanos Rodríguez' },
  { key: 'interlagos', corner: 'Senna S', search: 'Senna S Interlagos', article: 'Interlagos Circuit' },
  { key: 'vegas', corner: 'Strip Straight', search: 'Las Vegas Strip at night', article: 'Las Vegas Strip Circuit', file: 'File:Las Vegas Strip at night 2023.jpg' },
  { key: 'losail', corner: 'Turn 1', search: 'Lusail International Circuit', article: 'Lusail International Circuit', file: 'File:Qatar MotoGP 2010.jpg' },
  { key: 'yas_marina', corner: 'Turn 9', search: 'Yas Marina Circuit corner', article: 'Yas Marina Circuit' },
];

const BAD_TITLE = /(map|logo|diagram|plan|layout|\.svg|flag|icon|ticket|poster)/i;

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 5);
}

/** True when the file title actually mentions the corner or the circuit. */
function relevant(title, circuit) {
  const haystack = String(title || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const needles = [...tokens(circuit.corner), ...tokens(circuit.article)];
  return needles.some((needle) => haystack.includes(needle));
}

async function json(url, attempt = 0) {
  const response = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(25_000),
  });

  if (response.status === 429 && attempt < 5) {
    const wait = 3_000 * (attempt + 1);
    console.warn(`  429 — retrying in ${wait / 1000}s`);
    await new Promise((resolve) => setTimeout(resolve, wait));
    return json(url, attempt + 1);
  }

  if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
  return response.json();
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A specific Commons file, used for hand-picked photos. */
async function fromFile(fileTitle) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    titles: fileTitle,
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '1400',
  });

  const data = await json(`${COMMONS}?${params}`);
  const page = data?.query?.pages?.[0];
  if (!page) return null;

  const info = page.imageinfo?.[0];
  if (!info || info.mime !== 'image/jpeg') return null;

  const meta = info.extmetadata || {};
  return {
    url: info.thumburl || info.url,
    page: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    title: page.title,
    credit: stripHtml(meta.Artist?.value) || 'Wikimedia Commons contributor',
    license: stripHtml(meta.LicenseShortName?.value) || 'CC',
  };
}

/** First suitable landscape JPEG from a Commons file search. */
async function fromCommons(circuit) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${circuit.search}`,
    gsrnamespace: '6',
    gsrlimit: '10',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '1400',
  });

  const data = await json(`${COMMONS}?${params}`);
  const pages = data?.query?.pages ?? [];

  const photos = pages
    .map((page) => toPhoto(page, circuit))
    .filter((photo) => photo && photo.score >= 2) // title must mention corner/circuit
    .sort((a, b) => b.score - a.score);

  return photos[0] ?? null;
}

/** Wikipedia lead image — only when it is a real photograph, never a map/logo. */
async function fromWikipedia(article) {
  const data = await json(`${WIKI}/${encodeURIComponent(article.replace(/ /g, '_'))}`);
  const image = data?.originalimage || data?.thumbnail;
  if (!image?.source) return null;
  // Infobox images are frequently SVG track maps or PNG logos.
  if (!/\.jpe?g(\?|$)/i.test(image.source)) return null;

  return {
    url: image.source,
    page: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${article.replace(/ /g, '_')}`,
    title: data.title || article,
    credit: 'Wikipedia / Wikimedia Commons',
    license: 'CC',
  };
}

function toPhoto(page, circuit) {
  const info = page.imageinfo?.[0];
  if (!info) return null;
  if (info.mime !== 'image/jpeg') return null;
  if (!info.width || info.width < 1000) return null;
  if (info.width <= info.height) return null; // landscape only
  if (BAD_TITLE.test(page.title || '')) return null;

  const meta = info.extmetadata || {};
  return {
    url: info.thumburl || info.url,
    page: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    title: page.title,
    credit: stripHtml(meta.Artist?.value) || 'Wikimedia Commons contributor',
    license: stripHtml(meta.LicenseShortName?.value) || 'CC',
    score: (relevant(page.title, circuit) ? 2 : 0) + (/jpe?g$/i.test(info.url || '') ? 1 : 0),
  };
}

/**
 * Photos from the circuit's own Commons category. Categories for race tracks
 * are full of real photographs, unlike the article infobox (often a map).
 */
async function fromCategory(circuit) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'categorymembers',
    gcmtitle: `Category:${circuit.article}`,
    gcmtype: 'file',
    gcmlimit: '50',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '1400',
  });

  const data = await json(`${COMMONS}?${params}`);
  const pages = data?.query?.pages ?? [];

  const photos = pages
    .map((page) => toPhoto(page, circuit))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  return photos[0] ?? null;
}

const output = {};

for (const circuit of CIRCUITS) {
  let photo = null;

  // Brand-new venues with no free photography: keep the SVG trace.
  if (circuit.skip) {
    console.warn(`SKIP ${circuit.key}: no free photo available`);
    continue;
  }

  // 0. Hand-picked file (deterministic, best quality).
  if (circuit.file) {
    try {
      photo = await fromFile(circuit.file);
    } catch (error) {
      console.warn(`  override failed for ${circuit.key}: ${error.message}`);
    }
    await pause(900);
  }

  // 1. Corner-specific Commons search.
  if (!photo) {
    try {
      photo = await fromCommons(circuit);
    } catch (error) {
      console.warn(`  commons search failed for ${circuit.key}: ${error.message}`);
    }
    await pause(1_200);
  }

  // 2. The circuit's own Commons category (real photos, correct venue).
  if (!photo) {
    try {
      photo = await fromCategory(circuit);
    } catch (error) {
      console.warn(`  commons category failed for ${circuit.key}: ${error.message}`);
    }
    await pause(1_200);
  }

  // 3. Wikipedia lead image, only if it is a JPEG photograph.
  if (!photo) {
    try {
      photo = await fromWikipedia(circuit.article);
    } catch (error) {
      console.warn(`  wikipedia fallback failed for ${circuit.key}: ${error.message}`);
    }
    await pause(1_200);
  }

  if (!photo) {
    console.warn(`SKIP ${circuit.key}: no photo`);
    continue;
  }

  output[circuit.key] = {
    key: circuit.key,
    corner: circuit.corner,
    url: photo.url,
    page: photo.page,
    title: photo.title,
    credit: photo.credit,
    license: photo.license,
  };

  console.log(`${circuit.key.padEnd(14)} ${circuit.corner.padEnd(18)} ${photo.title}`);
}

const body = `/**
 * Signature-corner photographs — generated, do not edit by hand.
 *
 *   node tools/build-corners.mjs
 *
 * Real photos of each circuit's most famous corner, from Wikimedia Commons /
 * Wikipedia. Every entry carries its source page, author and licence so the
 * dashboard can credit it. Circuits with no entry fall back to the SVG trace
 * in \`circuits.js\`.
 *
 * Generated ${new Date().toISOString().slice(0, 10)}.
 */
(function () {
  'use strict';

  var CORNERS = ${JSON.stringify(output, null, 2)};

  window.APEX_CORNERS = CORNERS;

  /** Photo for a circuit key (or any alias handled by apexCircuitFor). */
  window.apexCornerFor = function (key) {
    if (!key) return null;
    if (CORNERS[key]) return CORNERS[key];

    var resolved = window.apexCircuitFor ? window.apexCircuitFor(key) : null;
    return resolved && CORNERS[resolved.key] ? CORNERS[resolved.key] : null;
  };
})();
`;

writeFileSync(new URL('../corners.js', import.meta.url), body, 'utf8');
console.log(`\nWrote corners.js (${Object.keys(output).length}/${CIRCUITS.length} circuits, ${(body.length / 1024).toFixed(1)} KB)`);
