/**
 * Builds `teamLogos.js`: the official constructor marks used by the
 * CONSTRUCTORS standings table.
 *
 *   node tools/build-team-logos.mjs
 *
 * Logos are the official team marks (Wikimedia-hosted files, hot-linked — no
 * keys, no API), resolved once here so the dashboard does no discovery at
 * runtime. Each entry also carries a generated crest (inline SVG data URI) that
 * is used if the remote file ever fails to load, so the table never shows a
 * broken image.
 *
 * Trademarks belong to their respective teams; they are used here for
 * identification only.
 */

import { writeFileSync } from 'node:fs';

const thumb = (path) => `https://thumb.wikimedia.org/wikipedia/${path}`;

const TEAMS = [
  {
    key: 'mclaren',
    code: 'MCL',
    color: '#FF8000',
    names: ['McLaren Mastercard F1 Team', 'McLaren'],
    logo: thumb('commons/thumb/b/bb/Mclaren_Logo_2021.svg/250px-Mclaren_Logo_2021.svg.png'),
    file: 'File:Mclaren Logo 2021.svg',
  },
  {
    key: 'mercedes',
    code: 'MER',
    color: '#27F4D2',
    names: ['Mercedes-AMG PETRONAS Formula One Team', 'Mercedes'],
    logo: thumb(
      'commons/thumb/f/fc/Mercedes-AMG_Petronas_F1_Team_logo_%282026%29.svg/250px-Mercedes-AMG_Petronas_F1_Team_logo_%282026%29.svg.png',
    ),
    file: 'File:Mercedes-AMG Petronas F1 Team logo (2026).svg',
  },
  {
    key: 'redbull',
    code: 'RBR',
    color: '#3671C6',
    names: ['Oracle Red Bull Racing', 'Red Bull Racing', 'Red Bull'],
    logo: thumb('en/thumb/f/fa/Red_Bull_Racing_Logo_2026.svg/250px-Red_Bull_Racing_Logo_2026.svg.png'),
    file: 'File:Red Bull Racing Logo 2026.svg',
  },
  {
    key: 'ferrari',
    code: 'FER',
    color: '#E8002D',
    names: ['Scuderia Ferrari HP', 'Ferrari'],
    logo: thumb('en/thumb/d/df/Scuderia_Ferrari_HP_logo_24.svg/250px-Scuderia_Ferrari_HP_logo_24.svg.png'),
    file: 'File:Scuderia Ferrari HP logo 24.svg',
  },
  {
    key: 'williams',
    code: 'WIL',
    color: '#64C4FF',
    names: ['Atlassian Williams F1 Team', 'Williams'],
    logo: thumb(
      'commons/thumb/1/12/Atlassian_Williams_F1_Team_logo.svg/250px-Atlassian_Williams_F1_Team_logo.svg.png',
    ),
    file: 'File:Atlassian Williams F1 Team logo.svg',
  },
  {
    key: 'racingbulls',
    code: 'VRB',
    color: '#6692FF',
    names: ['Visa Cash App Racing Bulls F1 Team', 'Racing Bulls'],
    logo: thumb('en/thumb/2/2b/VCARB_F1_logo.svg/250px-VCARB_F1_logo.svg.png'),
    file: 'File:VCARB F1 logo.svg',
  },
  {
    key: 'aston',
    code: 'AMR',
    color: '#229971',
    names: ['Aston Martin Aramco Formula One Team', 'Aston Martin'],
    logo: thumb('en/thumb/1/15/Aston_Martin_Aramco_2024_logo.png/250px-Aston_Martin_Aramco_2024_logo.png'),
    file: 'File:Aston Martin Aramco 2024 logo.png',
  },
  {
    key: 'haas',
    code: 'HAA',
    color: '#B6BABD',
    names: ['TGR Haas F1 Team', 'Haas'],
    logo: thumb('commons/thumb/1/18/TGR_Haas_F1_Team_Logo_%282026%29.svg/250px-TGR_Haas_F1_Team_Logo_%282026%29.svg.png'),
    file: 'File:TGR Haas F1 Team Logo (2026).svg',
  },
  {
    key: 'audi',
    code: 'AUD',
    color: '#BB0A30',
    names: ['Audi Revolut F1 Team', 'Audi', 'Kick Sauber', 'Sauber'],
    logo: thumb('commons/thumb/3/30/Audif1.com_logo17.svg/250px-Audif1.com_logo17.svg.png'),
    file: 'File:Audif1.com logo17.svg',
  },
  {
    key: 'alpine',
    code: 'ALP',
    color: '#FF87BC',
    names: ['BWT Alpine Formula One Team', 'Alpine'],
    logo: thumb('commons/thumb/4/4a/BWT_Alpine_F1_Team_Logo.png/250px-BWT_Alpine_F1_Team_Logo.png'),
    file: 'File:BWT Alpine F1 Team Logo.png',
  },
  {
    key: 'cadillac',
    code: 'CAD',
    color: '#C8A24A',
    names: ['Cadillac Formula 1 Team', 'Cadillac'],
    logo: thumb(
      'en/thumb/b/bc/Cadillac_Formula_1_Team_Logo_%282025%29.svg/250px-Cadillac_Formula_1_Team_Logo_%282025%29.svg.png',
    ),
    file: 'File:Cadillac Formula 1 Team Logo (2025).svg',
  },

  // MotoGP
  {
    key: 'ducati',
    code: 'DUC',
    color: '#CC0000',
    names: ['Ducati Lenovo Team', 'Ducati'],
    logo: thumb('commons/thumb/3/3f/Ducati_Lenovo_Team_-_2024_logo.png/250px-Ducati_Lenovo_Team_-_2024_logo.png'),
    file: 'File:Ducati Lenovo Team - 2024 logo.png',
  },
  {
    key: 'aprilia',
    code: 'APR',
    color: '#00A0DE',
    names: ['Aprilia Racing'],
    logo: thumb('commons/thumb/8/82/Aprilia_Racing_Logo.svg/250px-Aprilia_Racing_Logo.svg.png'),
    file: 'File:Aprilia Racing Logo.svg',
  },
  {
    key: 'ktm',
    code: 'KTM',
    color: '#FF6600',
    names: ['Red Bull KTM Factory Racing', 'KTM Factory Racing'],
    logo: thumb('en/thumb/a/a8/Red_Bull_KTM_Factory_Racing_logo.jpg/250px-Red_Bull_KTM_Factory_Racing_logo.jpg'),
    file: 'File:Red Bull KTM Factory Racing logo.jpg',
  },
  {
    key: 'tech3',
    code: 'T3',
    color: '#FF6600',
    names: ['Red Bull KTM Tech3'],
    logo: thumb('en/thumb/2/26/Tech_3_logo.png/250px-Tech_3_logo.png'),
    file: 'File:Tech 3 logo.png',
  },
  {
    key: 'yamaha',
    code: 'YAM',
    color: '#0033A0',
    names: ['Monster Energy Yamaha', 'Monster Energy Yamaha MotoGP Team', 'Yamaha'],
    logo: thumb('en/thumb/d/d7/Monster_Energy_Yamaha_Factoty_Logo.png/250px-Monster_Energy_Yamaha_Factoty_Logo.png'),
    file: 'File:Monster Energy Yamaha Factoty Logo.png',
  },
  {
    key: 'honda',
    code: 'HRC',
    color: '#E10600',
    names: ['Honda HRC', 'Honda HRC Castrol'],
    logo: thumb('en/thumb/1/14/Honda_HRC_Castrol_logo.png/250px-Honda_HRC_Castrol_logo.png'),
    file: 'File:Honda HRC Castrol logo.png',
  },
  {
    key: 'trackhouse',
    code: 'TRK',
    color: '#00A19C',
    names: ['Trackhouse Racing', 'SuperFile Trackhouse MotoGP Team'],
    logo: thumb('en/thumb/a/a7/Trackhouse_Racing_MotoGP_logo.jpg/250px-Trackhouse_Racing_MotoGP_logo.jpg'),
    file: 'File:Trackhouse Racing MotoGP logo.jpg',
  },
  {
    key: 'lcr',
    code: 'LCR',
    color: '#F5A623',
    names: ['LCR Honda', 'Castrol Honda LCR', 'Pro Honda LCR'],
    logo: thumb('en/thumb/1/13/LCR_logo_2021.png/250px-LCR_logo_2021.png'),
    file: 'File:LCR logo 2021.png',
  },
  {
    key: 'pramac',
    code: 'PRM',
    color: '#1E4FFF',
    names: ['Pramac Yamaha', 'Prima Pramac Yamaha MotoGP', 'Pramac Racing'],
    logo: thumb('en/thumb/1/1d/Prima_Pramac_Racing_logo.jpg/250px-Prima_Pramac_Racing_logo.jpg'),
    file: 'File:Prima Pramac Racing logo.jpg',
  },
  {
    key: 'gresini',
    code: 'GRN',
    color: '#7B2D8E',
    names: ['Gresini Racing', 'BK8 Gresini Racing MotoGP'],
    logo: thumb('en/thumb/f/f9/Gresini_Racing_Logo_2017.png/250px-Gresini_Racing_Logo_2017.png'),
    file: 'File:Gresini Racing Logo 2017.png',
  },
  {
    key: 'vr46',
    code: 'VR4',
    color: '#FFD400',
    names: ['VR46 Racing Team', 'Pertamina Enduro VR46 Racing Team'],
    logo: thumb(
      'commons/thumb/8/8f/Pertamina_Enduro_VR46_Racing_Team_-_Logo_2024.jpg/250px-Pertamina_Enduro_VR46_Racing_Team_-_Logo_2024.jpg',
    ),
    file: 'File:Pertamina Enduro VR46 Racing Team - Logo 2024.jpg',
  },
];

/** Keyword → team key, tried in order (most specific first). */
const MATCHERS = [
  ['lcr', 'lcr'],
  ['trackhouse', 'trackhouse'],
  ['tech3', 'tech3'],
  ['gresini', 'gresini'],
  ['vr46', 'vr46'],
  ['pramac', 'pramac'],
  ['hrc', 'honda'],
  ['ducati', 'ducati'],
  ['aprilia', 'aprilia'],
  ['ktm', 'ktm'],
  ['yamaha', 'yamaha'],
  ['mclaren', 'mclaren'],
  ['mercedes', 'mercedes'],
  ['red bull', 'redbull'],
  ['ferrari', 'ferrari'],
  ['williams', 'williams'],
  ['racing bulls', 'racingbulls'],
  ['aston martin', 'aston'],
  ['haas', 'haas'],
  ['sauber', 'audi'],
  ['audi', 'audi'],
  ['alpine', 'alpine'],
  ['cadillac', 'cadillac'],
  ['honda', 'honda'],
];

function crest(code, color) {
  const size = code.length >= 3 ? 9 : 11;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<rect x="1" y="1" width="30" height="30" rx="6" fill="#0b0b0b" stroke="${color}" stroke-width="1.6"/>` +
    `<text x="16" y="20.6" text-anchor="middle" font-family="Arial Narrow,Arial,sans-serif" ` +
    `font-weight="700" font-size="${size}" letter-spacing=".3" fill="${color}">${code}</text>` +
    `</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const entries = {};
const names = {};

for (const team of TEAMS) {
  entries[team.key] = {
    key: team.key,
    code: team.code,
    color: team.color,
    logo: team.logo,
    fallback: crest(team.code, team.color),
    credit: team.file,
  };

  for (const name of team.names) {
    names[name.toLowerCase()] = team.key;
  }
}

const body = `/**
 * Constructor marks — generated, do not edit by hand.
 *
 *   node tools/build-team-logos.mjs
 *
 * Official team logos, hot-linked from Wikimedia (no API key). Every entry has
 * an inline SVG crest as \`fallback\` so a missing/blocked file never leaves a
 * broken image in the standings table.
 *
 * Trademarks belong to their respective teams; used for identification only.
 *
 * Generated ${new Date().toISOString().slice(0, 10)}.
 */
(function () {
  'use strict';

  var TEAMS = ${JSON.stringify(entries, null, 2)};

  var NAMES = ${JSON.stringify(names, null, 2)};

  var MATCHERS = ${JSON.stringify(MATCHERS)};

  window.APEX_TEAM_LOGOS = TEAMS;

  /**
   * Mark for a team name. Exact official/short name first, then the most
   * specific keyword, so live sponsor prefixes still resolve:
   *   "Castrol Honda LCR" -> LCR, "Honda HRC Castrol" -> HRC.
   */
  window.apexTeamLogo = function (name) {
    if (!name) return null;

    var raw = String(name).trim().toLowerCase();
    if (NAMES[raw]) return TEAMS[NAMES[raw]];

    for (var i = 0; i < MATCHERS.length; i += 1) {
      if (raw.indexOf(MATCHERS[i][0]) !== -1) return TEAMS[MATCHERS[i][1]];
    }

    return null;
  };
})();
`;

writeFileSync(new URL('../teamLogos.js', import.meta.url), body, 'utf8');
console.log(
  `Wrote teamLogos.js (${TEAMS.length} teams, ${Object.keys(names).length} names, ${(body.length / 1024).toFixed(1)} KB)`,
);
