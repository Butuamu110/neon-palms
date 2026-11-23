// The minimap and the full city map for NEON PALMS. The minimap is a living slice of the
// street grid around Rio — roads, blocks tinted by district, the sea to the east — with
// the gold story marker, the PD's blue blink and shop glyphs riding on top. The full map
// (M) is the poster version: every district named, every POI lettered, the GPS route drawn
// down the avenues to the job, and the career ledger down the right side — story progress,
// completion, the respect ladder and the garage.

import { BEACH, DISTRICTS, FONT, GRID, PALETTE, RANKS, WORLD, rankFor } from './config.js';
import { avenueX, streetY } from './city.js';

const RANGE = 760; // world units from Rio to the minimap edge

export function drawMinimap(ctx, game, x, y, size) {
  const p = game.player;
  const scale = size / (RANGE * 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size * 0.78);
  ctx.clip();
  ctx.fillStyle = '#141126';
  ctx.fillRect(x, y, size, size * 0.78);
  const toMap = (wx, wy) => [x + size / 2 + (wx - p.x) * scale, y + size * 0.39 + (wy - p.y) * scale];

  // District ground tints, sampled coarsely.
  const step = 120;
  for (let wy = p.y - RANGE; wy < p.y + RANGE; wy += step) {
    for (let wx = p.x - RANGE; wx < p.x + RANGE; wx += step) {
      const [sx, sy] = toMap(wx, wy);
      const ground = game.city.groundAt(wx + step / 2, wy + step / 2);
      ctx.fillStyle = ground === 'water' ? PALETTE.water : ground === 'sand' ? PALETTE.sand : ground === 'road' ? '#3d3a4d' : game.city.districtAt(wx + step / 2, wy + step / 2).tone;
      ctx.fillRect(sx, sy, step * scale + 1, step * scale + 1);
    }
  }
  // Roads on top, crisp.
  ctx.strokeStyle = '#55506e';
  ctx.lineWidth = Math.max(2, GRID.road * scale * 0.8);
  ctx.beginPath();
  for (let i = 0; i <= GRID.cols; i += 1) {
    const [sx] = toMap(avenueX(i), 0);
    if (sx < x - 20 || sx > x + size + 20) continue;
    ctx.moveTo(sx, y);
    ctx.lineTo(sx, y + size * 0.78);
  }
  for (let j = 0; j <= GRID.rows; j += 1) {
    const [, sy] = toMap(0, streetY(j));
    if (sy < y - 20 || sy > y + size) continue;
    ctx.moveTo(x, sy);
    ctx.lineTo(x + size, sy);
  }
  ctx.stroke();

  // Blips.
  const target = game.missions.target();
  if (target) {
    const [tx, ty] = toMap(target.x, target.y);
    const pulse = 3 + Math.sin(game.time * 5) * 1.2;
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.arc(tx, ty, 5 + pulse * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff3c4';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  for (const poi of game.city.pois) {
    if (!['gunshop', 'spray', 'food', 'garage', 'safehouse'].includes(poi.kind)) continue;
    const [sx, sy] = toMap(poi.x, poi.y);
    if (sx < x || sx > x + size || sy < y || sy > y + size * 0.78) continue;
    ctx.fillStyle = PALETTE.neonTeal;
    ctx.fillRect(sx - 2.4, sy - 2.4, 4.8, 4.8);
  }
  for (const unit of game.police.units) {
    const [sx, sy] = toMap(unit.car.x, unit.car.y);
    if (sx < x || sx > x + size || sy < y || sy > y + size * 0.78) continue;
    ctx.fillStyle = Math.floor(game.time * 3) % 2 === 0 ? PALETTE.policeRed : PALETTE.policeBlue;
    ctx.beginPath();
    ctx.arc(sx, sy, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Rio: a white arrow that turns with him.
  ctx.save();
  ctx.translate(x + size / 2, y + size * 0.39);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();

  // Frame and the district name beneath.
  ctx.strokeStyle = PALETTE.neonPink;
  ctx.lineWidth = 1.6;
  ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size * 0.78 - 1);
  const district = game.city.districtAt(p.x, p.y);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `800 14px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(district.name, x + 2, y + size * 0.78 + 6);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 10.5px ${FONT}`;
  ctx.fillText(district.blurb, x + 2, y + size * 0.78 + 23);
}

/** Manhattan route down the avenues from (x0,y0) to (x1,y1): across, then along. */
export function gpsRoute(x0, y0, x1, y1) {
  const i = Math.max(0, Math.min(GRID.cols, Math.round((x1 - GRID.road / 2) / GRID.pitchX)));
  const avenue = avenueX(i);
  return [[x0, y0], [x0, y1], [avenue, y1], [x1, y1]];
}

export function drawBigMap(ctx, game) {
  const view = game.view;
  ctx.fillStyle = 'rgba(7,4,16,0.93)';
  ctx.fillRect(0, 0, view.w, view.h);
  const mapW = Math.min(880, view.w - 400);
  const mapH = mapW * (WORLD.height / WORLD.width);
  const mx = 36;
  const my = (view.h - mapH) / 2;
  const sx = (wx) => mx + (wx / WORLD.width) * mapW;
  const sy = (wy) => my + (wy / WORLD.height) * mapH;
  const k = mapW / WORLD.width;

  // Sea and land.
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(mx, my, mapW, mapH);
  ctx.fillStyle = '#241d3d';
  ctx.fillRect(mx, my, BEACH.sandX * k, mapH);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(mx + BEACH.sandX * k, my, (BEACH.waterX - BEACH.sandX) * k, mapH);
  // District tints.
  for (let r = 0; r < GRID.rows; r += 1) {
    for (let c = 0; c < GRID.cols; c += 1) {
      const d = DISTRICTS[game.city.blocks[r][c].district === undefined ? 0 : districtIndex(game, c, r)];
      ctx.fillStyle = hexA2(d.tone, 0.55);
      ctx.fillRect(sx(c * GRID.pitchX + GRID.road), sy(r * GRID.pitchY + GRID.road), GRID.blockW * k, GRID.blockH * k);
    }
  }
  // Roads.
  ctx.strokeStyle = '#6a6484';
  ctx.lineWidth = Math.max(2, GRID.road * k * 0.75);
  ctx.beginPath();
  for (let i = 0; i <= GRID.cols; i += 1) {
    ctx.moveTo(sx(avenueX(i)), my);
    ctx.lineTo(sx(avenueX(i)), sy(3020));
  }
  for (let j = 0; j <= GRID.rows; j += 1) {
    ctx.moveTo(mx, sy(streetY(j)));
    ctx.lineTo(sx(BEACH.sandX), sy(streetY(j)));
  }
  ctx.stroke();
  // Building footprints and port clutter: the city's grain at poster scale.
  for (const b of game.city.buildings) {
    ctx.fillStyle = b.neon ? hexA2(b.neon.color, 0.5) : 'rgba(240,238,252,0.13)';
    ctx.fillRect(sx(b.x), sy(b.y), Math.max(2, b.w * k), Math.max(2, b.h * k));
  }
  ctx.fillStyle = 'rgba(255,210,87,0.35)';
  for (const prop of game.city.props) {
    if (prop.kind !== 'container' && prop.kind !== 'crane') continue;
    ctx.fillRect(sx(prop.x) - 2, sy(prop.y) - 2, 4, 4);
  }
  // Palm speckle along the coast.
  ctx.fillStyle = 'rgba(92,255,157,0.3)';
  for (const palm of game.city.palms) {
    if (palm.x < BEACH.sandX - 200) continue;
    ctx.fillRect(sx(palm.x) - 1.4, sy(palm.y) - 1.4, 2.8, 2.8);
  }

  // GPS route to the job.
  const target = game.missions.target();
  const p = game.player;
  if (target) {
    const route = gpsRoute(p.x, p.y, target.x, target.y);
    ctx.strokeStyle = PALETTE.neonPink;
    ctx.lineWidth = 3.4;
    ctx.setLineDash([10, 7]);
    ctx.beginPath();
    route.forEach(([wx, wy], i) => {
      if (i === 0) ctx.moveTo(sx(wx), sy(wy));
      else ctx.lineTo(sx(wx), sy(wy));
    });
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.arc(sx(target.x), sy(target.y), 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#141126';
    ctx.font = `900 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', sx(target.x), sy(target.y) + 0.5);
  }

  // POIs with letters.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const poi of game.city.pois) {
    if (poi.kind === 'giver') continue;
    ctx.fillStyle = PALETTE.neonTeal;
    ctx.beginPath();
    ctx.arc(sx(poi.x), sy(poi.y), 6.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b0714';
    ctx.font = `900 9.5px ${FONT}`;
    ctx.fillText(poi.name[0], sx(poi.x), sy(poi.y) + 0.5);
    // The garage sits on the club's doorstep: its name would print over the club's.
    if (poi.id === 'garage') continue;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 10px ${FONT}`;
    ctx.fillText(poi.name, sx(poi.x), sy(poi.y) + 15);
  }
  // Player.
  ctx.save();
  ctx.translate(sx(p.x), sy(p.y));
  ctx.rotate(p.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-7, -6);
  ctx.lineTo(-7, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // District names.
  ctx.textAlign = 'center';
  const labels = [
    ['CIELO HEIGHTS', 1, 0.6], ['OLD QUARTER', 2.6, 0.6], ['CORAL BEACH', 4.6, 0.8],
    ['THE FLATS', 1, 3.2], ['NEON MILE', 2.6, 2.6], ['PORT AZURE', 3.6, 4.55],
  ];
  ctx.font = `800 15px ${FONT}`;
  for (const [name, cx, cy] of labels) {
    ctx.fillStyle = 'rgba(245,238,252,0.85)';
    ctx.fillText(name, sx(cx * GRID.pitchX), sy(cy * GRID.pitchY));
  }
  ctx.strokeStyle = PALETTE.neonPink;
  ctx.lineWidth = 1.6;
  ctx.strokeRect(mx + 0.5, my + 0.5, mapW - 1, mapH - 1);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `800 17px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('PALMERA — CITY MAP', mx, my - 16);

  drawCareerPanel(ctx, game, mx + mapW + 26, my, view.w - (mx + mapW + 26) - 24, mapH);
}

function districtIndex(game, c, r) {
  const d = game.city.blocks[r][c].district;
  return DISTRICTS.findIndex((entry) => entry.id === d.id);
}

function drawCareerPanel(ctx, game, x, y, w, h) {
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 1.4;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  const done = game.missions.index;
  const pct = Math.round((done / 15) * 100);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let cy = y + 16;
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `800 16px ${FONT}`;
  ctx.fillText('THE LEDGER — RIO C\u00c1RDENAS', x + 16, cy);
  cy += 30;
  const rows = [
    ['STORY', `${done}/15 — ${game.missions.done ? 'NEON CROWN' : game.missions.current().title}`],
    ['COMPLETE', `${pct}%`],
    ['CASH', `$${game.cash.toLocaleString('en-US')}`],
    ['REP', `${game.rep} — ${rankFor(game.rep).name}`],
    ['TIME IN PALMERA', fmtTime(game.stats.timePlayed)],
    ['DISTANCE DRIVEN', `${(game.stats.distance / 1000).toFixed(1)} km`],
    ['JOBS DONE', String(game.stats.jobsDone)],
    ['CARS TAKEN', String(game.stats.carsTaken)],
    ['BUSTED', String(game.stats.busts)],
    ['WASTED', String(game.stats.wasteds)],
  ];
  ctx.font = `600 13px ${FONT}`;
  for (const [label, value] of rows) {
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(label, x + 16, cy);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText(value, x + 150, cy);
    ctx.font = `600 13px ${FONT}`;
    cy += 22;
  }
  cy += 8;
  // Completion bar.
  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  ctx.fillRect(x + 16, cy, w - 32, 9);
  ctx.fillStyle = PALETTE.neonPink;
  ctx.fillRect(x + 16, cy, (w - 32) * (pct / 100), 9);
  cy += 24;
  // Respect ladder.
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `800 13px ${FONT}`;
  ctx.fillText('RESPECT LADDER', x + 16, cy);
  cy += 20;
  ctx.font = `600 12px ${FONT}`;
  for (const rank of RANKS) {
    const reached = game.rep >= rank.at;
    const current = rankFor(game.rep) === rank;
    ctx.fillStyle = current ? PALETTE.neonPink : reached ? PALETTE.text : 'rgba(255,255,255,0.3)';
    ctx.fillText(`${reached ? '\u2605' : '\u2606'} ${rank.name} — ${rank.at} REP`, x + 16, cy);
    cy += 17;
  }
  cy += 10;
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `800 13px ${FONT}`;
  ctx.fillText('GARAGE', x + 16, cy);
  cy += 20;
  ctx.fillStyle = PALETTE.text;
  ctx.font = `600 12px ${FONT}`;
  const garage = game.garage.length ? game.garage.join('  ·  ') : 'Nothing stored yet.';
  for (const line of wrapSimple(garage, 34)) {
    ctx.fillText(line, x + 16, cy);
    cy += 17;
  }
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `italic 600 11.5px ${FONT}`;
  ctx.fillText('M / ESC — back to the street', x + 16, y + h - 24);
}

function wrapSimple(text, chars) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > chars && line) {
      lines.push(line);
      line = word;
    } else line = line ? line + ' ' + word : word;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function hexA2(hex, alpha) {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
