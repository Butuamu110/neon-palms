// NEON PALMS — central configuration and shared game state (single source of truth).
// Every other module imports G from here; G is the one mutable world state object.

export const CFG = {
  world: 340,                 // half-extent of the playable city in metres
  roadLines: [-300, -180, -60, 60, 180, 300],
  fixedDt: 1 / 60,
  startCash: 1250,
  gravity: 0,
};

export const DISTRICTS = [
  { name: 'Palms Strip',        x0: -180, z0: 180,  x1: 180,  z1: 340,  color: '#ff5fa2', tint: '#3a1e33' },
  { name: 'Club Mile',          x0: -340, z0: -60,  x1: -60,  z1: 180,  color: '#c44dff', tint: '#241433' },
  { name: 'The Underpass',      x0: -340, z0: -340, x1: -60,  z1: -60,  color: '#37c8ff', tint: '#12242e' },
  { name: 'Puerto Alba',        x0: 60,   z0: 60,   x1: 340,  z1: 340,  color: '#ffb347', tint: '#33241a' },
  { name: 'Heights of San Verde', x0: 60, z0: -340, x1: 340,  z1: -60,  color: '#7dff9a', tint: '#1c2e1e' },
  { name: 'Old Town Grid',      x0: -60,  z0: -340, x1: 60,   z1: 340,  color: '#ffe066', tint: '#2e2a18' },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  return DISTRICTS[5];
}

// RESPECT ladder — named ranks, each with a named unlock.
export const RANKS = [
  { name: 'NOBODY',        need: 0,    unlock: 'Palms Runner (starter coupe)' },
  { name: 'CURB CRAWLER',  need: 50,   unlock: 'Neón Comet hatchback' },
  { name: 'STREET NAME',   need: 120,  unlock: 'Marea Lowrider + Club Mile garage' },
  { name: 'BLOCK BURNER',  need: 220,  unlock: 'Válvula GT sports coupe' },
  { name: 'CREW REGULAR',  need: 350,  unlock: 'Alba Interceptor bait car' },
  { name: 'PALMS ROYALTY', need: 520,  unlock: 'Comet S widebody kit' },
  { name: 'MIDNIGHT ROYALTY', need: 750, unlock: 'Ríos Special — pink-slip flagship' },
  { name: 'PALMS LEGEND',  need: 1000, unlock: 'Golden Neón livery + crew crown' },
];

export const CAR_MODELS = [
  { name: 'Palms Runner',   top: 34, accel: 15, color: 0xff5fa2, price: 0 },
  { name: 'Neón Comet',     top: 40, accel: 18, color: 0x37c8ff, price: 4200 },
  { name: 'Marea Lowrider', top: 38, accel: 16, color: 0xc44dff, price: 6800 },
  { name: 'Válvula GT',     top: 50, accel: 24, color: 0xffb347, price: 14500 },
  { name: 'Alba Interceptor', top: 54, accel: 26, color: 0xf2f2f2, price: 21000 },
  { name: 'Ríos Special',   top: 60, accel: 30, color: 0xffe066, price: 40000 },
];

export const WEAPONS = [
  { name: 'Fists',    icon: '✊', ammo: Infinity, price: 0,     dmg: 8,  rate: 0.35, locked: false },
  { name: 'Pistol',   icon: '🔫', ammo: 48,       price: 650,   dmg: 22, rate: 0.28, locked: false },
  { name: 'SMG',      icon: '💥', ammo: 120,      price: 1900,  dmg: 14, rate: 0.09, locked: false },
  { name: 'Shotgun',  icon: '🧨', ammo: 24,       price: 3200,  dmg: 46, rate: 0.8,  locked: false },
  { name: 'Rifle',    icon: '🎯', ammo: 90,       price: 5400,  dmg: 30, rate: 0.14, locked: false },
  { name: 'Marksman', icon: '🔭', ammo: 20,       price: 9800,  dmg: 85, rate: 1.1,  locked: true },
];

export const RADIO = [
  { name: 'Neón 99.9',        tracks: ['Válvula — "Bomba de Neón"', 'DJ Palma — "Avenida Lights"', 'Los Faros — "Gasolina Rosa"'] },
  { name: 'Palms Classics 88.1', tracks: ['Orquesta Alba — "Bolero del Puerto"', 'Marina Sol — "Brisa del 78"', 'The Verde Trio — "San Verde Nights"'] },
];

export const CREW = [
  { name: 'Dario', role: 'Wheelman',   key: 'Z', label: 'NITRO CACHE', cd: 20, color: '#37c8ff' },
  { name: 'Paz',   role: 'Wrench',     key: 'X', label: 'QUICK FIX',   cd: 25, color: '#7dff9a' },
  { name: 'Ivo',   role: 'Lookout',    key: 'C', label: 'EYES OUT',    cd: 30, color: '#ffe066' },
];

export const BOSS = { name: "Valentina 'Válvula' Ríos", role: 'Crew Boss — Ríos Racing Family', initials: 'VR', color: '#ff5fa2' };

// The one shared mutable state object.
export const G = {
  mode: 'title',            // title | play
  paused: false,
  mapOpen: false,
  statsOpen: false,
  time: 0,                  // simulated seconds (never wall-clock)
  tod: 17.7,                // time of day in hours — starts at golden hour
  clockMin: 17 * 60 + 42,
  cash: CFG.startCash,
  respect: 0,
  health: 100, armor: 50,
  wanted: 0, sight: 'SEARCHING', sightTimer: 0, heatTimer: 0,
  weapon: 1, fireCd: 0,
  radio: 0, radioTrack: 0, radioTimer: 0,
  player: { x: -120, z: 250, a: 0, speed: 0, inCar: null, mesh: null, walkPhase: 0 },
  cars: [], peds: [], cops: [], heli: null,
  feed: [],               // dispatch / event feed lines {t, text}
  dialogue: null,         // {who, role, line, color, initials, until}
  banner: null,           // mission passed banner {title, lines, until}
  prompt: '',             // contextual E prompt
  crewCd: [0, 0, 0],
  eyesOut: 0,
  stats: {
    missionsDone: 0, racesWon: 0, racesRun: 0, duelsWon: 0, duelsRun: 0,
    collectibles: 0, collectTotal: 12, shotsFired: 0, carsStolen: 0,
    topSpeed: 0, distanceKm: 0, earned: 0,
    medals: {},           // missionId -> 'GOLD'|'SILVER'|'BRONZE'
  },
  mission: null,          // active mission runtime
  missionIdx: 0,          // next story mission index
  race: null,             // active race runtime
  duel: null,
  collectibles: [],
  districtStanding: {},   // district name -> respect earned there
  saveSlot: 1,
  camShake: 0,
  night: false,
  msg: '', msgUntil: 0,
};

export function feed(text) {
  G.feed.unshift({ t: G.time, text });
  if (G.feed.length > 6) G.feed.pop();
}
export function say(who, line, secs = 6) {
  G.dialogue = { who: who.name, role: who.role, line, color: who.color, initials: who.initials || who.name.slice(0, 2).toUpperCase(), until: G.time + secs };
}
export function rankIdx() {
  let i = 0;
  for (let k = 0; k < RANKS.length; k++) if (G.respect >= RANKS[k].need) i = k;
  return i;
}
export function rankProgress() {
  const i = rankIdx();
  if (i >= RANKS.length - 1) return { i, frac: 1, cur: RANKS[i].need, next: RANKS[i].need };
  const cur = RANKS[i].need, next = RANKS[i + 1].need;
  return { i, frac: (G.respect - cur) / (next - cur), cur, next };
}
export function addRespect(n, districtName) {
  G.respect += n;
  if (districtName) G.districtStanding[districtName] = (G.districtStanding[districtName] || 0) + n;
}
export function addCash(n) { G.cash += n; if (n > 0) G.stats.earned += n; }
