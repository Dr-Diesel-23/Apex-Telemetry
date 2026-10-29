/**
 * Builds `circuits.js` from the MIT-licensed bacinger/f1-circuits dataset
 * (https://github.com/bacinger/f1-circuits, geometry derived from
 * OpenStreetMap contributors, ODbL).
 *
 *   node tools/build-circuits.mjs
 *
 * For every circuit we emit two normalised SVG paths in a 100x100 viewBox:
 *   - `path`   the full layout (used by the circuit map),
 *   - `corner` a zoomed trace of the circuit's tightest corner section, used as
 *              translucent background art behind the circuit details.
 */

import { writeFileSync } from 'node:fs';

const BASE = 'https://raw.githubusercontent.com/bacinger/f1-circuits/master/circuits';

const CIRCUITS = [
  { key: 'albert_park', file: 'au-1953', name: 'Albert Park Grand Prix Circuit', short: 'ALBERT PARK', country: 'Australia', aliases: ['albert park', 'melbourne'] },
  { key: 'shanghai', file: 'cn-2004', name: 'Shanghai International Circuit', short: 'SHANGHAI', country: 'China', aliases: ['shanghai'] },
  { key: 'suzuka', file: 'jp-1962', name: 'Suzuka Circuit', short: 'SUZUKA', country: 'Japan', aliases: ['suzuka'] },
  { key: 'miami', file: 'us-2022', name: 'Miami International Autodrome', short: 'MIAMI', country: 'United States', aliases: ['miami'] },
  { key: 'villeneuve', file: 'ca-1978', name: 'Circuit Gilles Villeneuve', short: 'MONTREAL', country: 'Canada', aliases: ['villeneuve', 'montreal', 'montréal'] },
  { key: 'monaco', file: 'mc-1929', name: 'Circuit de Monaco', short: 'MONACO', country: 'Monaco', aliases: ['monaco', 'monte carlo'] },
  { key: 'catalunya', file: 'es-1991', name: 'Circuit de Barcelona-Catalunya', short: 'BARCELONA', country: 'Spain', aliases: ['catalunya', 'barcelona'] },
  { key: 'red_bull_ring', file: 'at-1969', name: 'Red Bull Ring', short: 'SPIELBERG', country: 'Austria', aliases: ['red bull ring', 'spielberg'] },
  { key: 'silverstone', file: 'gb-1948', name: 'Silverstone Circuit', short: 'SILVERSTONE', country: 'United Kingdom', aliases: ['silverstone'] },
  { key: 'spa', file: 'be-1925', name: 'Circuit de Spa-Francorchamps', short: 'SPA', country: 'Belgium', aliases: ['spa', 'francorchamps'] },
  { key: 'hungaroring', file: 'hu-1986', name: 'Hungaroring', short: 'HUNGARORING', country: 'Hungary', aliases: ['hungaroring', 'budapest'] },
  { key: 'zandvoort', file: 'nl-1948', name: 'Circuit Zandvoort', short: 'ZANDVOORT', country: 'Netherlands', aliases: ['zandvoort'] },
  { key: 'monza', file: 'it-1922', name: 'Autodromo Nazionale Monza', short: 'MONZA', country: 'Italy', aliases: ['monza'] },
  { key: 'madring', file: 'es-2026', name: 'Madring', short: 'MADRID', country: 'Spain', aliases: ['madring', 'madrid'] },
  { key: 'baku', file: 'az-2016', name: 'Baku City Circuit', short: 'BAKU', country: 'Azerbaijan', aliases: ['baku'] },
  { key: 'sepang', file: 'my-1999', name: 'Sepang International Circuit', short: 'SEPANG', country: 'Malaysia', aliases: ['sepang', 'kuala lumpur'] },
  { key: 'marina_bay', file: 'sg-2008', name: 'Marina Bay Street Circuit', short: 'MARINA BAY', country: 'Singapore', aliases: ['marina bay', 'singapore'] },
  { key: 'americas', file: 'us-2012', name: 'Circuit of the Americas', short: 'COTA', country: 'United States', aliases: ['cota', 'circuit of the americas', 'austin'] },
  { key: 'rodriguez', file: 'mx-1962', name: 'Autódromo Hermanos Rodríguez', short: 'MEXICO CITY', country: 'Mexico', aliases: ['rodriguez', 'rodríguez', 'mexico city', 'mexico'] },
  { key: 'interlagos', file: 'br-1977', name: 'Autódromo José Carlos Pace', short: 'INTERLAGOS', country: 'Brazil', aliases: ['interlagos', 'sao paulo', 'são paulo', 'pace'] },
  { key: 'vegas', file: 'us-2023', name: 'Las Vegas Strip Circuit', short: 'LAS VEGAS', country: 'United States', aliases: ['vegas', 'las vegas'] },
  { key: 'losail', file: 'qa-2004', name: 'Lusail International Circuit', short: 'LUSAIL', country: 'Qatar', aliases: ['losail', 'lusail', 'qatar'] },
  { key: 'yas_marina', file: 'ae-2009', name: 'Yas Marina Circuit', short: 'YAS MARINA', country: 'UAE', aliases: ['yas marina', 'abu dhabi'] },
];

const SIZE = 100;
const PAD = 6;

function project(coords) {
  const lat0 = (coords.reduce((sum, [, lat]) => sum + lat, 0) / coords.length) * (Math.PI / 180);
  const k = Math.cos(lat0);
  return coords.map(([lon, lat]) => [lon * k, -lat]);
}

function fit(points, size = SIZE, pad = PAD) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const scale = Math.min((size - 2 * pad) / w, (size - 2 * pad) / h);
  const ox = (size - w * scale) / 2;
  const oy = (size - h * scale) / 2;
  return points.map(([x, y]) => [(x - minX) * scale + ox, (y - minY) * scale + oy]);
}

function distanceToSegment(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Ramer-Douglas-Peucker, in normalised units. */
function simplify(points, epsilon = 0.16) {
  if (points.length < 3) return points;
  let index = -1;
  let max = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const d = distanceToSegment(points[i], points[0], points[points.length - 1]);
    if (d > max) {
      max = d;
      index = i;
    }
  }
  if (max <= epsilon || index === -1) return [points[0], points[points.length - 1]];
  return [
    ...simplify(points.slice(0, index + 1), epsilon).slice(0, -1),
    ...simplify(points.slice(index), epsilon),
  ];
}

function toPath(points) {
  return points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ');
}

/** Slice with the highest total heading change: the circuit's tightest corner. */
function tightestCorner(points) {
  const n = points.length;
  if (n < 10) return points;

  const headings = points.map((p, i) => {
    const q = points[(i + 1) % n];
    return Math.atan2(q[1] - p[1], q[0] - p[0]);
  });

  const window = Math.max(5, Math.round(n * 0.1));
  let bestStart = 0;
  let bestScore = -1;

  for (let start = 0; start < n; start += 1) {
    let score = 0;
    for (let k = 0; k < window; k += 1) {
      const a = headings[(start + k) % n];
      const b = headings[(start + k + 1) % n];
      let diff = Math.abs(b - a);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      score += diff;
    }
    if (score > bestScore) {
      bestScore = score;
      bestStart = start;
    }
  }

  const slice = [];
  for (let k = -1; k <= window + 1; k += 1) slice.push(points[(bestStart + k + n) % n]);
  return slice;
}

async function load(file) {
  const response = await fetch(`${BASE}/${file}.geojson`);
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
  const data = await response.json();
  const geometry = data.features ? data.features[0].geometry : data.geometry;
  if (!geometry || geometry.type !== 'LineString') throw new Error(`${file}: no LineString`);
  return geometry.coordinates;
}

const output = {};

for (const circuit of CIRCUITS) {
  try {
    const coords = await load(circuit.file);
    const points = fit(project(coords));
    const simplified = simplify(points);
    const corner = fit(tightestCorner(simplified), SIZE, 10);

    output[circuit.key] = {
      key: circuit.key,
      name: circuit.name,
      short: circuit.short,
      country: circuit.country,
      aliases: circuit.aliases,
      viewBox: `0 0 ${SIZE} ${SIZE}`,
      path: toPath(simplified),
      corner: toPath(corner),
      points: simplified.length,
    };
    console.log(`${circuit.key.padEnd(14)} ${String(simplified.length).padStart(4)} pts  ${circuit.name}`);
  } catch (error) {
    console.error(`SKIP ${circuit.key}: ${error.message}`);
  }
}

const body = `/**
 * Circuit layouts — generated, do not edit by hand.
 *
 *   node tools/build-circuits.mjs
 *
 * Source: https://github.com/bacinger/f1-circuits (MIT), geometry derived from
 * OpenStreetMap contributors (ODbL). Each entry is normalised into a 100x100
 * viewBox: \`path\` is the full layout, \`corner\` a zoomed trace of the circuit's
 * tightest corner used as translucent background art.
 *
 * Generated ${new Date().toISOString().slice(0, 10)}.
 */
(function () {
  'use strict';

  var CIRCUITS = ${JSON.stringify(output, null, 2)};

  window.APEX_CIRCUITS = CIRCUITS;

  /** Resolves a circuit from any of the names the API/UI may hand over. */
  window.apexCircuitFor = function () {
    var needles = [];
    for (var i = 0; i < arguments.length; i += 1) {
      var value = arguments[i];
      if (value) needles.push(String(value).toLowerCase().trim());
    }
    if (!needles.length) return null;

    var keys = Object.keys(CIRCUITS);
    for (var k = 0; k < keys.length; k += 1) {
      var circuit = CIRCUITS[keys[k]];
      var pool = [keys[k], circuit.name, circuit.short]
        .concat(circuit.aliases || [])
        .map(function (entry) { return String(entry).toLowerCase(); });

      for (var n = 0; n < needles.length; n += 1) {
        for (var p = 0; p < pool.length; p += 1) {
          if (pool[p] === needles[n]) return circuit;
        }
        for (var q = 0; q < pool.length; q += 1) {
          if (pool[q].indexOf(needles[n]) !== -1 || needles[n].indexOf(pool[q]) !== -1) {
            return circuit;
          }
        }
      }
    }
    return null;
  };
})();
`;

writeFileSync(new URL('../circuits.js', import.meta.url), body, 'utf8');
console.log(`\nWrote circuits.js (${Object.keys(output).length} circuits, ${(body.length / 1024).toFixed(1)} KB)`);
