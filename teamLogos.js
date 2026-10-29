/**
 * Constructor marks — generated, do not edit by hand.
 *
 *   node tools/build-team-logos.mjs
 *
 * Official team logos, hot-linked from Wikimedia (no API key). Every entry has
 * an inline SVG crest as `fallback` so a missing/blocked file never leaves a
 * broken image in the standings table.
 *
 * Trademarks belong to their respective teams; used for identification only.
 *
 * Generated 2026-10-29.
 */
(function () {
  'use strict';

  var TEAMS = {
  "mclaren": {
    "key": "mclaren",
    "code": "MCL",
    "color": "#FF8000",
    "logo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bb/Mclaren_Logo_2021.svg/250px-Mclaren_Logo_2021.svg.png",
    "fallback": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20x%3D%221%22%20y%3D%221%22%20width%3D%2230%22%20height%3D%2230%22%20rx%3D%226%22%20fill%3D%22%230b0b0b%22%20stroke%3D%22%23FF8000%22%20stroke-width%3D%221.6%22%2F%3E%3Ctext%20x%3D%2216%22%20y%3D%2220.6%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%20Narrow%2CArial%2Csans-serif%22%20font-weight%3D%22700%22%20font-size%3D%229%22%20letter-spacing%3D%22.3%22%20fill%3D%22%23FF8000%22%3EMCL%3C%2Ftext%3E%3C%2Fsvg%3E",
    "credit": "File:Mclaren Logo 2021.svg"
  },
  "mercedes": {
    "key": "mercedes",
    "code": "MER",
    "color": "#27F4D2",
    "logo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fc/Mercedes-AMG_Petronas_F1_Team_logo_%282026%29.svg/250px-Mercedes-AMG_Petronas_F1_Team_logo_%282026%29.svg.png",
    "fallback": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20x%3D%221%22%20y%3D%221%22%20width%3D%2230%22%20height%3D%2230%22%20rx%3D%226%22%20fill%3D%22%230b0b0b%22%20stroke%3D%22%2327F4D2%22%20stroke-width%3D%221.6%22%2F%3E%3Ctext%20x%3D%2216%22%20y%3D%2220.6%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%20Narrow%2CArial%2Csans-serif%22%20font-weight%3D%22700%22%20font-size%3D%229%22%20letter-spacing%3D%22.3%22%20fill%3D%22%2327F4D2%22%3EMER%3C%2Ftext%3E%3C%2Fsvg%3E",
    "credit": "File:Mercedes-AMG Petronas F1 Team logo (2026).svg"
  },
  "redbull": {
    "key": "redbull",
    "code": "RBR",
    "color": "#3671C6",
    "logo": "https://thumb.wikimedia.org/wikipedia/en/thumb/f/fa/Red_Bull_Racing_Logo_2026.svg/250px-Red_Bull_Racing_Logo_2026.svg.png",
    "fallback": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20x%3D%221%22%20y%3D%221%22%20width%3D%2230%22%20height%3D%2230%22%20rx%3D%226%22%20fill%3D%22%230b0b0b%22%20stroke%3D%22%233671C6%22%20stroke-width%3D%221.6%22%2F%3E%3Ctext%20x%3D%2216%22%20y%3D%2220.6%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%20Narrow%2CArial%2Csans-serif%22%20font-weight%3D%22700%22%20font-size%3D%229%22%20letter-spacing%3D%22.3%22%20fill%3D%22%233671C6%22%3ERBR%3C%2Ftext%3E%3C%2Fsvg%3E",
    "credit": "File:Red Bull Racing Logo 2026.svg"
  },
  "ferrari": {
    "key": "ferrari",
    "code": "FER",
    "color": "#E8002D",
    "logo": "https://thumb.wikimedia.org/wikipedia/en/thumb/d/df/Scuderia_Ferrari_HP_logo_24.svg/250px-Scuderia_Ferrari_HP_logo_24.svg.png",
    "fallback": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20x%3D%221%22%20y%3D%221%22%20width%3D%2230%22%20height%3D%2230%22%20rx%3D%226%22%20fill%3D%22%230b0b0b%22%20stroke%3D%22%23E8002D%22%20stroke-width%3D%221.6%22%2F%3E%3Ctext%20x%3D%2216%22%20y%3D%2220.6%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%20Narrow%2CArial%2Csans-serif%22%20font-weight%3D%22700%22%20font-size%3D%229%22%20letter-spacing%3D%22.3%22%20fill%3D%22%23E8002D%22%3EFER%3C%2Ftext%3E%3C%2Fsvg%3E",
    "credit": "File:Scuderia Ferrari HP logo 24.svg"
  },
  "williams": {
    "key": "williams",
    "code": "WIL",
    "color": "#64C4FF",
    "logo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/12/Atlassian_Williams_F1_Team_logo.svg/250px-Atlassian_Williams_F1_Team_logo.svg.png",
    "fallback": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20x%3D%221%22%20y%3D%221%22%20width%3D%2230%22%20height%3D%2230%22%20rx%3D%226%22%20fill%3D%22%230b0b0b%22%20stroke%3D%22%2364C4FF%22%20stroke-width%3D%221.6%22%2F%3E%3Ctext%20x%3D%2216%22%20y%3D%2220.6%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%20Narrow%2CArial%2Csans-serif%22%20font-weight%3D%22700%22%20font-size%3D%229%22%20letter-spacing%3D%22.3%22%20fill%3D%22%2364C4FF%22%3EWIL%3C%2Ftext%3E%3C%2Fsvg%3E",
    "credit": "File:Atlassian Williams F1 Team logo.svg"
  },
  "racingbulls": {
    "key": "racingbulls",
    "code": "VRB",
    "color": "#6692FF",
    "logo": "https://thumb.wikimedia.org/wikipedia/en/thumb/2/2b/VCARB_F1_logo.svg/250px-VCARB_F1_logo.svg.png",
    "fallback": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20x%3D%221%22%20y%3D%221%22%20width%3D%2230%22%20height%3D%2230%22%20rx%3D%226%22%20fill%3D%22%230b0b0b%22%20stroke%3D%22%236692FF%22%20stroke-width%3D%221.6%22%2F%3E%3Ctext%20x%3D%2216%22%20y%3D%2220.6%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%20Narrow%2CArial%2Csans-serif%22%20font-weight%3D%22700%22%20font-size%3D%229%22%20letter-spacing%3D%22.3%22%20fill%3D%22%236692FF%22%3EVRB%3C%2Ftext%3E%3C%2Fsvg%3E",
    "credit": "File:VCARB F1 logo.svg"
  },
  "aston": {
    "key": "aston",
    "code": "AMR",
    "color": "#229971",
    "logo": "https://thumb.wikimedia.org/wikipedia/en/thumb/1/15/Aston_Martin_Aramco_2024_logo.png/250px-Aston_Martin_Aramco_2024_logo.png",
    "fallback": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20x%3D%221%22%20y%3D%221%22%20width%3D%2230%22%20height%3D%2230%22%20rx%3D%226%22%20fill%3D%22%230b0b0b%22%20stroke%3D%22%23229971%22%20stroke-width%3D%221.6%22%2F%3E%3Ctext%20x%3D%2216%22%20y%3D%2220.6%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%20Narrow%2CArial%2Csans-serif%22%20font-weight%3D%22700%22%20font-size%3D%229%22%20letter-spacing%3D%22.3%22%20fill%3D%22%23229971%22%3EAMR%3C%2Ftext%3E%3C%2Fsvg%3E",
    "credit": "File:Aston Martin Aramco 2024 logo.png"
  },
  "haas": {
    "key": "haas",
    "code": "HAA",
    "color": "#B6BABD",
    "logo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/18/TGR_Haas_F1_Team_Logo_%282026%29.svg/250px-TGR_Haas_F1_Team_Logo_%282026%29.svg.png",
    "fallback": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20x%3D%221%22%20y%3D%221%22%20width%3D%2230%22%20height%3D%2230%22%20rx%3D%226%22%20fill%3D%22%230b0b0b%22%20stroke%3D%22%23B6BABD%22%20stroke-width%3D%221.6%22%2F%3E%3Ctext%20x%3D%2216%22%20y%3D%2220.6%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%20Narrow%2CArial%2Csans-serif%22%20font-weight%3D%22700%22%20font-size%3D%229%22%20letter-spacing%3D%22.3%22%20fill%3D%22%23B6BABD%22%3EHAA%3C%2Ftext%3E%3C%2Fsvg%3E",
    "credit": "File:TGR Haas F1 Team Logo (2026).svg"
  },
  "audi": {
    "key": "audi",
    "code": "AUD",
    "color": "#BB0A30",
    "logo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/30/Audif1.com_logo17.svg/250px-Audif1.com_logo17.svg.png",
    "fallback": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20x%3D%221%22%20y%3D%221%22%20width%3D%2230%22%20height%3D%2230%22%20rx%3D%226%22%20fill%3D%22%230b0b0b%22%20stroke%3D%22%23BB0A30%22%20stroke-width%3D%221.6%22%2F%3E%3Ctext%20x%3D%2216%22%20y%3D%2220.6%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%20Narrow%2CArial%2Csans-serif%22%20font-weight%3D%22700%22%20font-size%3D%229%22%20letter-spacing%3D%22.3%22%20fill%3D%22%23BB0A30%22%3EAUD%3C%2Ftext%3E%3C%2Fsvg%3E",
    "credit": "File:Audif1.com logo17.svg"
  },
  "alpine": {
    "key": "alpine",
    "code": "ALP",
    "color": "#FF87BC",
    "logo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/BWT_Alpine_F1_Team_Logo.png/250px-BWT_Alpine_F1_Team_Logo.png",
    "fallback": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20x%3D%221%22%20y%3D%221%22%20width%3D%2230%22%20height%3D%2230%22%20rx%3D%226%22%20fill%3D%22%230b0b0b%22%20stroke%3D%22%23FF87BC%22%20stroke-width%3D%221.6%22%2F%3E%3Ctext%20x%3D%2216%22%20y%3D%2220.6%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%20Narrow%2CArial%2Csans-serif%22%20font-weight%3D%22700%22%20font-size%3D%229%22%20letter-spacing%3D%22.3%22%20fill%3D%22%23FF87BC%22%3EALP%3C%2Ftext%3E%3C%2Fsvg%3E",
    "credit": "File:BWT Alpine F1 Team Logo.png"
  },
  "cadillac": {
    "key": "cadillac",
    "code": "CAD",
    "color": "#C8A24A",
    "logo": "https://thumb.wikimedia.org/wikipedia/en/thumb/b/bc/Cadillac_Formula_1_Team_Logo_%282025%29.svg/250px-Cadillac_Formula_1_Team_Logo_%282025%29.svg.png",
    "fallback": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20x%3D%221%22%20y%3D%221%22%20width%3D%2230%22%20height%3D%2230%22%20rx%3D%226%22%20fill%3D%22%230b0b0b%22%20stroke%3D%22%23C8A24A%22%20stroke-width%3D%221.6%22%2F%3E%3Ctext%20x%3D%2216%22%20y%3D%2220.6%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%20Narrow%2CArial%2Csans-serif%22%20font-weight%3D%22700%22%20font-size%3D%229%22%20letter-spacing%3D%22.3%22%20fill%3D%22%23C8A24A%22%3ECAD%3C%2Ftext%3E%3C%2Fsvg%3E",
    "credit": "File:Cadillac Formula 1 Team Logo (2025).svg"
  },
  "ducati": {
    "key": "ducati",
    "code": "DUC",
    "color": "#CC0000",
    "logo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3f/Ducati_Lenovo_Team_-_2024_logo.png/250px-Ducati_Lenovo_Team_-_2024_logo.png",
    "fallback": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20x%3D%221%22%20y%3D%221%22%20width%3D%2230%22%20height%3D%2230%22%20rx%3D%226%22%20fill%3D%22%230b0b0b%22%20stroke%3D%22%23CC0000%22%20stroke-width%3D%221.6%22%2F%3E%3Ctext%20x%3D%2216%22%20y%3D%2220.6%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%20Narrow%2CArial%2Csans-serif%22%20font-weight%3D%22700%22%20font-size%3D%229%22%20letter-spacing%3D%22.3%22%20fill%3D%22%23CC0000%22%3EDUC%3C%2Ftext%3E%3C%2Fsvg%3E",
    "credit": "File:Ducati Lenovo Team - 2024 logo.png"
  },
  "aprilia": {
    "key": "aprilia",
    "code": "APR",
    "color": "#00A0DE",
    "logo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/82/Aprilia_Racing_Logo.svg/250px-Aprilia_Racing_Logo.svg.png",
    "fallback": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20x%3D%221%22%20y%3D%221%22%20width%3D%2230%22%20height%3D%2230%22%20rx%3D%226%22%20fill%3D%22%230b0b0b%22%20stroke%3D%22%2300A0DE%22%20stroke-width%3D%221.6%22%2F%3E%3Ctext%20x%3D%2216%22%20y%3D%2220.6%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%20Narrow%2CArial%2Csans-serif%22%20font-weight%3D%22700%22%20font-size%3D%229%22%20letter-spacing%3D%22.3%22%20fill%3D%22%2300A0DE%22%3EAPR%3C%2Ftext%3E%3C%2Fsvg%3E",
    "credit": "File:Aprilia Racing Logo.svg"
  },
  "ktm": {
    "key": "ktm",
    "code": "KTM",
    "color": "#FF6600",
    "logo": "https://thumb.wikimedia.org/wikipedia/en/thumb/a/a8/Red_Bull_KTM_Factory_Racing_logo.jpg/250px-Red_Bull_KTM_Factory_Racing_logo.jpg",
    "fallback": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20x%3D%221%22%20y%3D%221%22%20width%3D%2230%22%20height%3D%2230%22%20rx%3D%226%22%20fill%3D%22%230b0b0b%22%20stroke%3D%22%23FF6600%22%20stroke-width%3D%221.6%22%2F%3E%3Ctext%20x%3D%2216%22%20y%3D%2220.6%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%20Narrow%2CArial%2Csans-serif%22%20font-weight%3D%22700%22%20font-size%3D%229%22%20letter-spacing%3D%22.3%22%20fill%3D%22%23FF6600%22%3EKTM%3C%2Ftext%3E%3C%2Fsvg%3E",
    "credit": "File:Red Bull KTM Factory Racing logo.jpg"
  },
  "tech3": {
    "key": "tech3",
    "code": "T3",
    "color": "#FF6600",
    "logo": "https://thumb.wikimedia.org/wikipedia/en/thumb/2/26/Tech_3_logo.png/250px-Tech_3_logo.png",
    "fallback": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20x%3D%221%22%20y%3D%221%22%20width%3D%2230%22%20height%3D%2230%22%20rx%3D%226%22%20fill%3D%22%230b0b0b%22%20stroke%3D%22%23FF6600%22%20stroke-width%3D%221.6%22%2F%3E%3Ctext%20x%3D%2216%22%20y%3D%2220.6%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%20Narrow%2CArial%2Csans-serif%22%20font-weight%3D%22700%22%20font-size%3D%2211%22%20letter-spacing%3D%22.3%22%20fill%3D%22%23FF6600%22%3ET3%3C%2Ftext%3E%3C%2Fsvg%3E",
    "credit": "File:Tech 3 logo.png"
  },
  "yamaha": {
    "key": "yamaha",
    "code": "YAM",
    "color": "#0033A0",
    "logo": "https://thumb.wikimedia.org/wikipedia/en/thumb/d/d7/Monster_Energy_Yamaha_Factoty_Logo.png/250px-Monster_Energy_Yamaha_Factoty_Logo.png",
    "fallback": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20x%3D%221%22%20y%3D%221%22%20width%3D%2230%22%20height%3D%2230%22%20rx%3D%226%22%20fill%3D%22%230b0b0b%22%20stroke%3D%22%230033A0%22%20stroke-width%3D%221.6%22%2F%3E%3Ctext%20x%3D%2216%22%20y%3D%2220.6%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%20Narrow%2CArial%2Csans-serif%22%20font-weight%3D%22700%22%20font-size%3D%229%22%20letter-spacing%3D%22.3%22%20fill%3D%22%230033A0%22%3EYAM%3C%2Ftext%3E%3C%2Fsvg%3E",
    "credit": "File:Monster Energy Yamaha Factoty Logo.png"
  },
  "honda": {
    "key": "honda",
    "code": "HRC",
    "color": "#E10600",
    "logo": "https://thumb.wikimedia.org/wikipedia/en/thumb/1/14/Honda_HRC_Castrol_logo.png/250px-Honda_HRC_Castrol_logo.png",
    "fallback": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20x%3D%221%22%20y%3D%221%22%20width%3D%2230%22%20height%3D%2230%22%20rx%3D%226%22%20fill%3D%22%230b0b0b%22%20stroke%3D%22%23E10600%22%20stroke-width%3D%221.6%22%2F%3E%3Ctext%20x%3D%2216%22%20y%3D%2220.6%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%20Narrow%2CArial%2Csans-serif%22%20font-weight%3D%22700%22%20font-size%3D%229%22%20letter-spacing%3D%22.3%22%20fill%3D%22%23E10600%22%3EHRC%3C%2Ftext%3E%3C%2Fsvg%3E",
    "credit": "File:Honda HRC Castrol logo.png"
  },
  "trackhouse": {
    "key": "trackhouse",
    "code": "TRK",
    "color": "#00A19C",
    "logo": "https://thumb.wikimedia.org/wikipedia/en/thumb/a/a7/Trackhouse_Racing_MotoGP_logo.jpg/250px-Trackhouse_Racing_MotoGP_logo.jpg",
    "fallback": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20x%3D%221%22%20y%3D%221%22%20width%3D%2230%22%20height%3D%2230%22%20rx%3D%226%22%20fill%3D%22%230b0b0b%22%20stroke%3D%22%2300A19C%22%20stroke-width%3D%221.6%22%2F%3E%3Ctext%20x%3D%2216%22%20y%3D%2220.6%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%20Narrow%2CArial%2Csans-serif%22%20font-weight%3D%22700%22%20font-size%3D%229%22%20letter-spacing%3D%22.3%22%20fill%3D%22%2300A19C%22%3ETRK%3C%2Ftext%3E%3C%2Fsvg%3E",
    "credit": "File:Trackhouse Racing MotoGP logo.jpg"
  },
  "lcr": {
    "key": "lcr",
    "code": "LCR",
    "color": "#F5A623",
    "logo": "https://thumb.wikimedia.org/wikipedia/en/thumb/1/13/LCR_logo_2021.png/250px-LCR_logo_2021.png",
    "fallback": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20x%3D%221%22%20y%3D%221%22%20width%3D%2230%22%20height%3D%2230%22%20rx%3D%226%22%20fill%3D%22%230b0b0b%22%20stroke%3D%22%23F5A623%22%20stroke-width%3D%221.6%22%2F%3E%3Ctext%20x%3D%2216%22%20y%3D%2220.6%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%20Narrow%2CArial%2Csans-serif%22%20font-weight%3D%22700%22%20font-size%3D%229%22%20letter-spacing%3D%22.3%22%20fill%3D%22%23F5A623%22%3ELCR%3C%2Ftext%3E%3C%2Fsvg%3E",
    "credit": "File:LCR logo 2021.png"
  },
  "pramac": {
    "key": "pramac",
    "code": "PRM",
    "color": "#1E4FFF",
    "logo": "https://thumb.wikimedia.org/wikipedia/en/thumb/1/1d/Prima_Pramac_Racing_logo.jpg/250px-Prima_Pramac_Racing_logo.jpg",
    "fallback": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20x%3D%221%22%20y%3D%221%22%20width%3D%2230%22%20height%3D%2230%22%20rx%3D%226%22%20fill%3D%22%230b0b0b%22%20stroke%3D%22%231E4FFF%22%20stroke-width%3D%221.6%22%2F%3E%3Ctext%20x%3D%2216%22%20y%3D%2220.6%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%20Narrow%2CArial%2Csans-serif%22%20font-weight%3D%22700%22%20font-size%3D%229%22%20letter-spacing%3D%22.3%22%20fill%3D%22%231E4FFF%22%3EPRM%3C%2Ftext%3E%3C%2Fsvg%3E",
    "credit": "File:Prima Pramac Racing logo.jpg"
  },
  "gresini": {
    "key": "gresini",
    "code": "GRN",
    "color": "#7B2D8E",
    "logo": "https://thumb.wikimedia.org/wikipedia/en/thumb/f/f9/Gresini_Racing_Logo_2017.png/250px-Gresini_Racing_Logo_2017.png",
    "fallback": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20x%3D%221%22%20y%3D%221%22%20width%3D%2230%22%20height%3D%2230%22%20rx%3D%226%22%20fill%3D%22%230b0b0b%22%20stroke%3D%22%237B2D8E%22%20stroke-width%3D%221.6%22%2F%3E%3Ctext%20x%3D%2216%22%20y%3D%2220.6%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%20Narrow%2CArial%2Csans-serif%22%20font-weight%3D%22700%22%20font-size%3D%229%22%20letter-spacing%3D%22.3%22%20fill%3D%22%237B2D8E%22%3EGRN%3C%2Ftext%3E%3C%2Fsvg%3E",
    "credit": "File:Gresini Racing Logo 2017.png"
  },
  "vr46": {
    "key": "vr46",
    "code": "VR4",
    "color": "#FFD400",
    "logo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8f/Pertamina_Enduro_VR46_Racing_Team_-_Logo_2024.jpg/250px-Pertamina_Enduro_VR46_Racing_Team_-_Logo_2024.jpg",
    "fallback": "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20x%3D%221%22%20y%3D%221%22%20width%3D%2230%22%20height%3D%2230%22%20rx%3D%226%22%20fill%3D%22%230b0b0b%22%20stroke%3D%22%23FFD400%22%20stroke-width%3D%221.6%22%2F%3E%3Ctext%20x%3D%2216%22%20y%3D%2220.6%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%20Narrow%2CArial%2Csans-serif%22%20font-weight%3D%22700%22%20font-size%3D%229%22%20letter-spacing%3D%22.3%22%20fill%3D%22%23FFD400%22%3EVR4%3C%2Ftext%3E%3C%2Fsvg%3E",
    "credit": "File:Pertamina Enduro VR46 Racing Team - Logo 2024.jpg"
  }
};

  var NAMES = {
  "mclaren mastercard f1 team": "mclaren",
  "mclaren": "mclaren",
  "mercedes-amg petronas formula one team": "mercedes",
  "mercedes": "mercedes",
  "oracle red bull racing": "redbull",
  "red bull racing": "redbull",
  "red bull": "redbull",
  "scuderia ferrari hp": "ferrari",
  "ferrari": "ferrari",
  "atlassian williams f1 team": "williams",
  "williams": "williams",
  "visa cash app racing bulls f1 team": "racingbulls",
  "racing bulls": "racingbulls",
  "aston martin aramco formula one team": "aston",
  "aston martin": "aston",
  "tgr haas f1 team": "haas",
  "haas": "haas",
  "audi revolut f1 team": "audi",
  "audi": "audi",
  "kick sauber": "audi",
  "sauber": "audi",
  "bwt alpine formula one team": "alpine",
  "alpine": "alpine",
  "cadillac formula 1 team": "cadillac",
  "cadillac": "cadillac",
  "ducati lenovo team": "ducati",
  "ducati": "ducati",
  "aprilia racing": "aprilia",
  "red bull ktm factory racing": "ktm",
  "ktm factory racing": "ktm",
  "red bull ktm tech3": "tech3",
  "monster energy yamaha": "yamaha",
  "monster energy yamaha motogp team": "yamaha",
  "yamaha": "yamaha",
  "honda hrc": "honda",
  "honda hrc castrol": "honda",
  "trackhouse racing": "trackhouse",
  "superfile trackhouse motogp team": "trackhouse",
  "lcr honda": "lcr",
  "castrol honda lcr": "lcr",
  "pro honda lcr": "lcr",
  "pramac yamaha": "pramac",
  "prima pramac yamaha motogp": "pramac",
  "pramac racing": "pramac",
  "gresini racing": "gresini",
  "bk8 gresini racing motogp": "gresini",
  "vr46 racing team": "vr46",
  "pertamina enduro vr46 racing team": "vr46"
};

  var MATCHERS = [["lcr","lcr"],["trackhouse","trackhouse"],["tech3","tech3"],["gresini","gresini"],["vr46","vr46"],["pramac","pramac"],["hrc","honda"],["ducati","ducati"],["aprilia","aprilia"],["ktm","ktm"],["yamaha","yamaha"],["mclaren","mclaren"],["mercedes","mercedes"],["red bull","redbull"],["ferrari","ferrari"],["williams","williams"],["racing bulls","racingbulls"],["aston martin","aston"],["haas","haas"],["sauber","audi"],["audi","audi"],["alpine","alpine"],["cadillac","cadillac"],["honda","honda"]];

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
