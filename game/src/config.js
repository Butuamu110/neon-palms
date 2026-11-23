// NEON PALMS — every tuning number, colour and name in one place. The world is a fixed
// 5200x3800 sheet of city; the camera picks a window into it, so nothing below depends on
// the size of the player's screen. Districts, the respect ladder and the radio dial live
// here because missions, the HUD and the map all read the same tables.

export const STEP = 1 / 60;

/** World sheet, in world units (roughly metres at city scale). */
export const WORLD = { width: 5200, height: 3800 };

/** Street grid: blocks of BLOCK_W x BLOCK_H separated by ROAD-wide avenues and streets. */
export const GRID = {
  cols: 6,
  rows: 5,
  blockW: 560,
  blockH: 420,
  road: 150,
  get pitchX() { return this.blockW + this.road; },
  get pitchY() { return this.blockH + this.road; },
  /** West edge of the built city; east of it lie the sand and the sea. */
  get cityEast() { return this.cols * this.blockW + (this.cols + 1) * this.road; },
};

/** x where the sand starts and where the sand meets the water. */
export const BEACH = { sandX: 4560, waterX: 4840 };

export const DISTRICTS = [
  { id: 'cielo', name: 'CIELO HEIGHTS', short: 'CIELO', tone: '#3d5a80', neon: '#9fd8ff', wealth: 3, blurb: 'Gated palms, hill money, quiet streets.' },
  { id: 'quarter', name: 'OLD QUARTER', short: 'QUARTER', tone: '#7a4a3a', neon: '#ffb35c', wealth: 1, blurb: 'Bodegas, murals and grandmothers who see everything.' },
  { id: 'flats', name: 'THE FLATS', short: 'FLATS', tone: '#4a4a55', neon: '#c0c8ff', wealth: 0, blurb: 'Lowriders, warehouses, Vesper country.' },
  { id: 'neon', name: 'NEON MILE', short: 'NEON MILE', tone: '#23304d', neon: '#ff4fd8', wealth: 2, blurb: 'Clubs, marquees and the Solstice Crew\u2019s front door.' },
  { id: 'port', name: 'PORT AZURE', short: 'PORT', tone: '#2e4a4f', neon: '#4fe3c1', wealth: 1, blurb: 'Cranes, containers and things that fall off boats.' },
  { id: 'coral', name: 'CORAL BEACH', short: 'CORAL', tone: '#6b4a63', neon: '#ff8a5c', wealth: 3, blurb: 'Resorts, beach clubs and rented sunshine.' },
];

/** District per grid block, [row][col], indexes into DISTRICTS. */
export const DISTRICT_GRID = [
  [0, 0, 1, 1, 5, 5],
  [0, 0, 1, 1, 5, 5],
  [2, 2, 3, 3, 5, 5],
  [2, 2, 3, 3, 4, 4],
  [2, 2, 4, 4, 4, 4],
];

export const PALETTE = {
  backdrop: '#0b0714',
  asphalt: '#23222b',
  asphaltEdge: '#191820',
  lane: '#d8c98a',
  sidewalk: '#3a3742',
  curb: '#55505f',
  sand: '#cfa96f',
  sandWet: '#b28c55',
  water: '#0d3b56',
  waterDeep: '#082a40',
  waterFoam: '#bfeaff',
  grass: '#2c4a2e',
  park: '#33542f',
  buildingShadow: 'rgba(10,4,20,0.42)',
  panel: 'rgba(12,8,24,0.82)',
  panelEdge: '#ff4fd8',
  text: '#f5eefc',
  muted: '#a79fc0',
  gold: '#ffd257',
  neonPink: '#ff4fd8',
  neonCyan: '#39e6ff',
  neonTeal: '#4fe3c1',
  neonOrange: '#ff8a5c',
  danger: '#ff4f5e',
  good: '#5cff9d',
  policeBlue: '#3f7bff',
  policeRed: '#ff3b4e',
};

export const FONT = '"Avenir Next", "Segoe UI", system-ui, sans-serif';
export const FONT_DISPLAY = '"Arial Black", "Avenir Next Heavy", "Segoe UI", sans-serif';

/** Respect ladder: name and the REP total that earns it. */
export const RANKS = [
  { name: 'NOBODY', at: 0 },
  { name: 'RUNNER', at: 100 },
  { name: 'WHEELMAN', at: 250 },
  { name: 'STREET NAME', at: 450 },
  { name: 'BLOCK ROYALTY', at: 700 },
  { name: 'CREW CAPTAIN', at: 1000 },
  { name: 'PALMS ROYALTY', at: 1400 },
  { name: 'NEON CROWN', at: 2000 },
];

export function rankFor(rep) {
  let rank = RANKS[0];
  for (const entry of RANKS) if (rep >= entry.at) rank = entry;
  return rank;
}

export function nextRank(rep) {
  for (const entry of RANKS) if (rep < entry.at) return entry;
  return null;
}

/** Radio dial: name, frequency and the flavour line the HUD ticker shows. */
export const RADIO = [
  { name: 'OLA 101.5', tag: 'Salsa brava y reguet\u00f3n viejo', bpm: 96 },
  { name: 'MIDNIGHT 92.3', tag: 'Synthwave para manejar de noche', bpm: 104 },
  { name: 'PALMS TALK 770', tag: 'Tr\u00e1fico, clima y chisme', bpm: 0 },
  { name: 'BRISA 88.9', tag: 'Boleros al atardecer', bpm: 72 },
];

/** Heat (0..500) maps to stars; crimes add heat, hiding bleeds it away. */
export const WANTED = {
  maxHeat: 500,
  starWidth: 100,
  decayPerSecond: 3.2,
  decayHiddenPerSecond: 11,
  sightRange: 620,
  bustSeconds: 2.4,
};

export const SAVE_KEY = 'neon-palms.save.v1';
export const BEST_KEY = 'neon-palms.best.v1';

/** Camera zooms: on foot tight, driving wider, the staged cover tighter still. */
export const ZOOM = { foot: 1.15, drive: 0.82, chase: 1.9, map: 0 };

/** Golden hour is where the game lives: 0 = dawn, 0.5 = noon, 0.72 = golden, 1 = midnight. */
export const DAY = { start: 0.7, length: 1500 };
