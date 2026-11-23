// NEON PALMS' city: Palmera, generated once from a seed. A grid of avenues and streets cuts
// the sheet into blocks; each block belongs to a district and is laid out from a template
// the district's wealth suggests — towers and rooftop pools in Cielo, bodega rows in the Old
// Quarter, warehouses in the Flats, the club strip on Neon Mile, cranes over Port Azure and
// resort slabs facing Coral Beach. East of the last avenue the city gives up: boardwalk,
// sand, then the sea. Everything the other systems need is here: buildings to collide with,
// palms and props to look at, POIs to drive to, and the road graph to drive on.

import { BEACH, DISTRICTS, DISTRICT_GRID, GRID, WORLD } from './config.js';

const CLUB_NAMES = ['Club Solstice', 'Velvet Anana', 'El Faro Rosa', 'Casa Neon', 'Marea Alta', 'The Pink Flamingo', 'Bar Ola', 'Noche Brava'];
const SHOP_NAMES = ['Bodega La Fe', 'Farmacia Coral', 'Taller Bravo', 'Licores El Puerto', 'Panader\u00eda Sol', 'Ferreter\u00eda Mar', 'Joyer\u00eda Brisa', 'Mercado Central', 'Caf\u00e9 Aroma', 'Pescader\u00eda Azul'];
const TOWER_NAMES = ['Torre Brisa', 'The Palmera', 'Hotel Cielo', 'Mirador del Mar', 'Torre Coral', 'The Solstice Grand', 'Villa Palma', 'Hotel Marea'];
const BLOCK_BLURBS = ['SE RENTA', 'ABIERTO 24H', 'NO HAY PASO', 'VIVA PALMERA', 'OLA 101.5', 'MIDNIGHT 92.3', 'SE VENDE', 'TALLER BRAVO'];

const ROOF_STYLES = ['flat', 'tank', 'pool', 'garden', 'helipad', 'sign', 'machines'];
const PALETTES = {
  cielo: ['#cfe3ee', '#b8d2e0', '#e8e2d2', '#a9c6d8', '#dfe9e4'],
  quarter: ['#d9a05b', '#c97e4f', '#e0b184', '#b56a4a', '#d98f6a'],
  flats: ['#8d8d99', '#7a7f8c', '#9a8f7d', '#6f7683', '#8c7f72'],
  neon: ['#4a3a6b', '#5b2a5e', '#2e3a5e', '#6b2a4a', '#3a2a55'],
  port: ['#5e6e6a', '#4f6158', '#6a7568', '#556270', '#61705e'],
  coral: ['#e8c8b8', '#f0d8c8', '#dcb8a8', '#e8d0b0', '#f2e0cc'],
};

export function avenueX(i) { return i * GRID.pitchX + GRID.road / 2; }
export function streetY(j) { return j * GRID.pitchY + GRID.road / 2; }
export function blockX(c) { return c * GRID.pitchX + GRID.road; }
export function blockY(r) { return r * GRID.pitchY + GRID.road; }

export function createCity(rng) {
  const buildings = [];
  const palms = [];
  const lights = [];
  const props = [];
  const blocks = [];

  function addBuilding(block, x, y, w, h, district) {
    const palette = PALETTES[district.id];
    const b = {
      x, y, w, h,
      floors: 1 + Math.floor(rng.next() * (district.wealth >= 3 ? 14 : district.wealth === 2 ? 9 : 5)),
      color: palette[Math.floor(rng.next() * palette.length)],
      roof: ROOF_STYLES[Math.floor(rng.next() * ROOF_STYLES.length)],
      district: district.id,
      neon: null,
      name: null,
      wear: rng.next(),
      block,
    };
    buildings.push(b);
    block.buildings.push(b);
    return b;
  }

  function neonSign(building, text, color) {
    building.neon = { text, color };
    building.name = text;
  }

  function palmsAlong(x0, y0, x1, y1, step, jitter) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const count = Math.max(1, Math.floor(len / step));
    for (let i = 0; i <= count; i += 1) {
      const t = count === 0 ? 0 : i / count;
      palms.push({
        x: x0 + dx * t + rng.range(-jitter, jitter),
        y: y0 + dy * t + rng.range(-jitter, jitter),
        s: rng.range(0.8, 1.25),
        lean: rng.range(-0.16, 0.16),
        phase: rng.range(0, Math.PI * 2),
      });
    }
  }

  // ---- blocks -------------------------------------------------------------
  for (let r = 0; r < GRID.rows; r += 1) {
    blocks.push([]);
    for (let c = 0; c < GRID.cols; c += 1) {
      const district = DISTRICTS[DISTRICT_GRID[r][c]];
      const bx = blockX(c);
      const by = blockY(r);
      const block = {
        c, r, x: bx, y: by, w: GRID.blockW, h: GRID.blockH,
        district, buildings: [], kind: 'built',
      };
      blocks[r].push(block);
      layoutBlock(rng, block, addBuilding, neonSign, palms, props);
    }
  }

  // The Solstice block: Neon Mile, col 2, row 2 — the club and its garage get named signs.
  const solstice = blocks[2][2];
  const clubBuilding = solstice.buildings[0];
  if (clubBuilding) neonSign(clubBuilding, 'CLUB SOLSTICE', '#ff4fd8');

  // ---- palms on the promenade and the beach --------------------------------
  palmsAlong(BEACH.sandX - 60, 120, BEACH.sandX - 60, WORLD.height - 420, 130, 14);
  palmsAlong(BEACH.sandX + 40, 200, BEACH.sandX + 40, WORLD.height - 500, 210, 30);
  for (let i = 0; i < 46; i += 1) {
    palms.push({
      x: rng.range(BEACH.sandX + 20, BEACH.waterX - 30),
      y: rng.range(80, WORLD.height - 460),
      s: rng.range(0.9, 1.4), lean: rng.range(-0.2, 0.2), phase: rng.range(0, Math.PI * 2),
    });
  }
  // Beach umbrellas and towels.
  for (let i = 0; i < 60; i += 1) {
    props.push({
      kind: 'umbrella',
      x: rng.range(BEACH.sandX + 30, BEACH.waterX - 60),
      y: rng.range(120, WORLD.height - 520),
      angle: rng.range(0, Math.PI * 2),
      color: ['#ff5c7a', '#39e6ff', '#ffd257', '#ff8a5c', '#5cff9d'][i % 5],
    });
  }
  // Buoys and boats in the bay.
  for (let i = 0; i < 9; i += 1) {
    props.push({ kind: 'boat', x: rng.range(BEACH.waterX + 120, WORLD.width - 160), y: rng.range(240, WORLD.height - 300), angle: rng.range(-0.5, 0.5), color: ['#f2f2f2', '#39e6ff', '#ff5c7a', '#ffd257'][i % 4], s: rng.range(0.8, 1.5) });
  }
  for (let i = 0; i < 14; i += 1) {
    props.push({ kind: 'buoy', x: rng.range(BEACH.waterX + 40, WORLD.width - 60), y: rng.range(60, WORLD.height - 80), angle: 0, color: '#ff4f5e' });
  }
  // Port Azure: cranes, containers, crates along the south apron.
  for (let i = 0; i < 5; i += 1) {
    props.push({ kind: 'crane', x: 500 + i * 780 + rng.range(-60, 60), y: 3180, angle: 0, color: '#e07b39' });
  }
  for (let i = 0; i < 90; i += 1) {
    props.push({
      kind: 'container',
      x: rng.range(240, 4200), y: rng.range(3060, 3300),
      angle: rng.chance(0.5) ? 0 : Math.PI / 2,
      color: ['#b84a39', '#39618f', '#3f7a52', '#8f6a39', '#5e5e8f'][i % 5],
      solid: true,
    });
  }
  for (let i = 0; i < 70; i += 1) {
    props.push({ kind: 'crate', x: rng.range(200, 4300), y: rng.range(3040, 3360), angle: rng.range(0, 3), color: '#9a7d4f', solid: true });
  }
  // Streetlights down every avenue and street, alternating sides.
  for (let i = 0; i <= GRID.cols; i += 1) {
    for (let y = 90; y < 3060; y += 190) lights.push({ x: avenueX(i) + ((y / 190) % 2 === 0 ? -62 : 62), y });
  }
  for (let j = 0; j <= GRID.rows; j += 1) {
    for (let x = 120; x < 4400; x += 210) lights.push({ x, y: streetY(j) + ((x / 210) % 2 === 0 ? -62 : 62) });
  }

  const pois = buildPois();
  const colliders = [];
  for (const b of buildings) colliders.push(b);
  for (const p of props) if (p.solid) colliders.push({ x: p.x - 26, y: p.y - 14, w: 52, h: 28 });

  return {
    buildings, palms, lights, props, blocks, pois, colliders,
    districtAt(x, y) {
      if (x >= BEACH.sandX) return DISTRICTS[5];
      if (y >= 3020) return DISTRICTS[4];
      const c = Math.max(0, Math.min(GRID.cols - 1, Math.floor(x / GRID.pitchX)));
      const r = Math.max(0, Math.min(GRID.rows - 1, Math.floor(y / GRID.pitchY)));
      return DISTRICTS[DISTRICT_GRID[r][c]];
    },
    groundAt(x, y) {
      if (x >= BEACH.waterX || y >= 3420) return 'water';
      if (x >= BEACH.sandX) return 'sand';
      if (y >= 3020) return 'concrete';
      const mx = x % GRID.pitchX;
      const my = y % GRID.pitchY;
      if (mx < GRID.road || my < GRID.road) return 'road';
      if (mx < GRID.road + 26 || my < GRID.road + 26 || mx > GRID.pitchX - 26 || my > GRID.pitchY - 26) return 'sidewalk';
      return 'block';
    },
    isRoad(x, y) {
      if (y >= 3020 && y < 3420 && x < BEACH.sandX) return true;
      if (x >= GRID.cityEast && x < BEACH.sandX) return true;
      const mx = x % GRID.pitchX;
      const my = y % GRID.pitchY;
      return mx < GRID.road || my < GRID.road;
    },
    /** Buildings and solid props overlapping the circle; used by every mover. */
    collide(x, y, radius) {
      let hit = null;
      for (const b of colliders) {
        if (x + radius < b.x || x - radius > b.x + b.w || y + radius < b.y || y - radius > b.y + b.h) continue;
        const nx = Math.max(b.x, Math.min(x, b.x + b.w));
        const ny = Math.max(b.y, Math.min(y, b.y + b.h));
        const dx = x - nx;
        const dy = y - ny;
        const d2 = dx * dx + dy * dy;
        if (d2 < radius * radius) {
          const d = Math.sqrt(d2) || 0.001;
          hit = { nx: dx / d, ny: dy / d, depth: radius - d, building: b };
          break;
        }
      }
      return hit;
    },
    poi(id) {
      return pois.find((p) => p.id === id);
    },
  };
}

/** Lay out one block from a template its district suggests. */
function layoutBlock(rng, block, addBuilding, neonSign, palms, props) {
  const { district } = block;
  const bx = block.x;
  const by = block.y;
  const bw = block.w;
  const bh = block.h;
  const roll = rng.next();
  const inset = 34;

  if (district.id === 'neon' && roll < 0.55) {
    // Club row: one long low building with a marquee, signs along the street.
    const club = addBuilding(block, bx + inset, by + 90, bw - inset * 2, 190, district);
    neonSign(club, rng.pick(CLUB_NAMES), rng.pick(['#ff4fd8', '#39e6ff', '#ffd257', '#ff8a5c']));
    const shop = addBuilding(block, bx + inset, by + 306, bw - inset * 2, 74, district);
    neonSign(shop, rng.pick(SHOP_NAMES), '#4fe3c1');
    block.kind = 'club';
    return;
  }
  if (roll < 0.12) {
    // Park: grass, palm clusters, benches, a fountain plaza in the middle.
    block.kind = 'park';
    for (let i = 0; i < 16; i += 1) {
      palms.push({ x: bx + rng.range(30, bw - 30), y: by + rng.range(30, bh - 30), s: rng.range(0.9, 1.4), lean: rng.range(-0.2, 0.2), phase: rng.range(0, 6) });
    }
    for (let i = 0; i < 6; i += 1) props.push({ kind: 'bench', x: bx + rng.range(60, bw - 60), y: by + rng.range(60, bh - 60), angle: rng.range(0, 3), color: '#6a4a2f' });
    props.push({ kind: 'fountain', x: bx + bw / 2, y: by + bh / 2, angle: 0, color: '#39e6ff' });
    return;
  }
  if (roll < 0.2) {
    // Parking lot: painted bays, a small kiosk.
    block.kind = 'lot';
    addBuilding(block, bx + bw - 130, by + 26, 96, 64, district);
    return;
  }
  if (district.id === 'port' || district.id === 'flats') {
    // Warehouses: two or three long sheds.
    const n = rng.int(2, 3);
    for (let i = 0; i < n; i += 1) {
      const w = (bw - inset * 2 - (n - 1) * 22) / n;
      const b = addBuilding(block, bx + inset + i * (w + 22), by + rng.range(50, 110), w, rng.range(180, 260), district);
      if (rng.chance(0.4)) neonSign(b, rng.pick(BLOCK_BLURBS), '#c0c8ff');
    }
    block.kind = 'warehouse';
    return;
  }
  if (district.wealth >= 3) {
    // Towers with plazas and the odd rooftop pool slab.
    const n = rng.int(1, 2);
    for (let i = 0; i < n; i += 1) {
      const w = rng.range(190, 260);
      const h = rng.range(180, 250);
      const b = addBuilding(block, bx + inset + i * (bw / n) + rng.range(0, 30), by + inset + rng.range(0, 60), w, h, district);
      b.floors = rng.int(12, 22);
      if (rng.chance(0.5)) b.name = rng.pick(TOWER_NAMES);
      if (rng.chance(0.35)) b.roof = 'pool';
    }
    block.kind = 'towers';
    return;
  }
  // Default: a row of shops on the street edge, flats behind.
  const shops = rng.int(3, 4);
  for (let i = 0; i < shops; i += 1) {
    const w = (bw - inset * 2 - (shops - 1) * 14) / shops;
    const b = addBuilding(block, bx + inset + i * (w + 14), by + bh - 118, w, 84, district);
    if (rng.chance(0.75)) neonSign(b, rng.pick(SHOP_NAMES), rng.pick(['#ffb35c', '#4fe3c1', '#ff8a5c', '#9fd8ff']));
  }
  const flats = rng.int(2, 3);
  for (let i = 0; i < flats; i += 1) {
    const w = (bw - inset * 2 - (flats - 1) * 18) / flats;
    addBuilding(block, bx + inset + i * (w + 18), by + inset, w, rng.range(120, 170), district);
  }
  block.kind = 'shops';
}

/** Fixed points of interest: the story and the economy hang off these. */
function buildPois() {
  const at = (c, r, dx, dy) => ({ x: blockX(c) + dx, y: blockY(r) + dy });
  return [
    { id: 'club', kind: 'club', name: 'Club Solstice', ...at(2, 2, 280, 330), district: 'neon' },
    { id: 'garage', kind: 'garage', name: 'Garage Solstice', ...at(2, 2, 470, 330), district: 'neon' },
    { id: 'zora', kind: 'giver', name: 'Madame Zora Vane', ...at(2, 2, 280, 386), district: 'neon' },
    { id: 'gunshop', kind: 'gunshop', name: 'Ammu-Palmera', ...at(2, 0, 280, 380), district: 'quarter' },
    { id: 'spray', kind: 'spray', name: 'Spray & Pay', ...at(0, 3, 280, 380), district: 'flats' },
    { id: 'food', kind: 'food', name: 'Burger Palms', ...at(4, 2, 280, 380), district: 'coral' },
    { id: 'safehouse', kind: 'safehouse', name: 'Safehouse Brisa', ...at(0, 0, 280, 380), district: 'cielo' },
    { id: 'precinct', kind: 'precinct', name: 'Palmera PD HQ', ...at(3, 1, 280, 40), district: 'quarter' },
    { id: 'hospital', kind: 'hospital', name: 'Hospital Coral', ...at(5, 0, 280, 380), district: 'coral' },
    { id: 'marina', kind: 'marina', name: 'Port Azure Marina', x: 3900, y: 3220, district: 'port' },
    { id: 'meet', kind: 'meet', name: 'Midnight Meet', ...at(1, 4, 280, 200), district: 'flats' },
    { id: 'vesper', kind: 'clubhouse', name: 'Vesper Clubhouse', ...at(1, 3, 280, 200), district: 'flats' },
  ];
}
