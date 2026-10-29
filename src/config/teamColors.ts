/** Canonical team colours used by the REST API and the WebSocket feed. */
export const TEAM_COLORS: Record<string, string> = {
  'Red Bull Racing': '#3671C6',
  McLaren: '#FF8000',
  Ferrari: '#E8002D',
  Mercedes: '#27F4D2',
  'Aston Martin': '#229971',
  Alpine: '#FF87BC',
  Williams: '#64C4FF',
  'Racing Bulls': '#6692FF',
  'Kick Sauber': '#52E252',
  Haas: '#B6BABD',

  'Invicta Racing': '#00A19C',
  'Campos Racing': '#F2A900',
  'Hitech TGR': '#0033A0',
  'PREMA Racing': '#E4002B',
  'ART Grand Prix': '#1B1B1B',
  'MP Motorsport': '#FF6A00',
  'Rodin Motorsport': '#00B4D8',
  'AIX Racing': '#E10600',
  'DAMS Lucas Oil': '#0057B8',
  'Trident': '#0A0A0A',
  'Van Amersfoort Racing': '#F26522',

  'Ducati Lenovo Team': '#CC0000',
  'Aprilia Racing': '#00A0DE',
  'Red Bull KTM Factory Racing': '#FF6600',
  'Monster Energy Yamaha': '#0033A0',
  'Honda HRC': '#E10600',
  'Trackhouse Racing': '#00A19C',
  'LCR Honda': '#F5A623',
  'Pramac Yamaha': '#1E4FFF',
  'Gresini Racing': '#7B2D8E',
  'VR46 Racing Team': '#FFD400',
};

export function teamColor(name: string): string {
  return TEAM_COLORS[name] ?? '#8A8F98';
}
