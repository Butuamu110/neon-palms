// Pedestrians for NEON PALMS: Palmera walks. Shoppers drift along the shop rows, clubbers
// queue outside the marquees, joggers work the promenade, sunbathers colonise the sand and
// the crew holds court outside Club Solstice. Peds stroll between waypoints on the
// sidewalks, scatter when the shooting starts or a car mounts the kerb, and the brave ones
// (mission shooters, angry drivers) stand their ground — combat.js runs those.

import { BEACH, GRID } from './config.js';
import { blockX, blockY } from './city.js';

const SKIN = ['#f2c79b', '#d99e63', '#a66a3f', '#7a4a28', '#5b3420'];
const CLOTH = ['#ff5c7a', '#39e6ff', '#ffd257', '#5cff9d', '#f2f2f2', '#ff8a5c', '#93248f', '#2456c8', '#e8e4da', '#c2274b'];

let nextPedId = 1;

export function createPed(rng, x, y, kind) {
  return {
    id: nextPedId++,
    x, y,
    angle: rng.range(0, Math.PI * 2),
    speed: 0,
    walkSpeed: rng.range(52, 86),
    kind: kind || 'walker', // walker | crew | shooter | victim | sunbather | jogger
    state: 'walk', // walk | stand | flee | cower | fight | down
    tx: x, ty: y,
    wait: rng.range(0, 2),
    hp: 100,
    skin: rng.pick(SKIN),
    shirt: rng.pick(CLOTH),
    pants: rng.pick(CLOTH),
    hat: rng.chance(0.3),
    phase: rng.range(0, Math.PI * 2),
    fireTimer: rng.range(0.4, 1.4),
    name: null,
    dead: false,
  };
}

export function createCrowds(rng, city) {
  const peds = [];

  function scatter(cx, cy, count, kind, spread) {
    for (let i = 0; i < count; i += 1) {
      const x = cx + rng.range(-spread, spread);
      const y = cy + rng.range(-spread, spread);
      if (city.collide(x, y, 12)) continue;
      peds.push(createPed(rng, x, y, kind));
    }
  }

  // Shop-row strollers and block wanderers across every district.
  for (let r = 0; r < GRID.rows; r += 1) {
    for (let c = 0; c < GRID.cols; c += 1) {
      const bx = blockX(c);
      const by = blockY(r);
      const block = city.blocks[r][c];
      const density = block.district.id === 'neon' ? 9 : block.district.id === 'quarter' ? 8 : 5;
      for (let i = 0; i < density; i += 1) {
        const edge = rng.int(0, 3);
        let x;
        let y;
        if (edge === 0) { x = bx + rng.range(10, GRID.blockW - 10); y = by + GRID.blockH - 12; }
        else if (edge === 1) { x = bx + rng.range(10, GRID.blockW - 10); y = by + 12; }
        else if (edge === 2) { x = bx + 12; y = by + rng.range(10, GRID.blockH - 10); }
        else { x = bx + GRID.blockW - 12; y = by + rng.range(10, GRID.blockH - 10); }
        peds.push(createPed(rng, x, y, 'walker'));
      }
      if (block.kind === 'park') scatter(bx + GRID.blockW / 2, by + GRID.blockH / 2, 4, 'walker', 150);
    }
  }
  // The Solstice crew holding court, and a queue for the club door.
  const club = city.poi('club');
  scatter(club.x - 60, club.y + 66, 5, 'crew', 46);
  scatter(club.x + 90, club.y + 70, 7, 'walker', 60);
  // Promenade joggers and beach life.
  for (let i = 0; i < 10; i += 1) peds.push(createPed(rng, BEACH.sandX - 60 + rng.range(-16, 16), rng.range(200, 3000), 'jogger'));
  for (let i = 0; i < 22; i += 1) {
    const ped = createPed(rng, rng.range(BEACH.sandX + 40, BEACH.waterX - 50), rng.range(160, 3100), 'sunbather');
    ped.state = 'stand';
    peds.push(ped);
  }
  // Port hands near the marina.
  scatter(3900, 3180, 6, 'walker', 200);

  return {
    peds,
    add(ped) { peds.push(ped); return ped; },
    update(dt, game) {
      const danger = game.danger;
      for (let i = peds.length - 1; i >= 0; i -= 1) {
        const ped = peds[i];
        if (ped.dead) continue;
        if (ped.hp <= 0) {
          ped.state = 'down';
          ped.dead = true;
          game.onPedDown(ped);
          continue;
        }
        updatePed(dt, game, ped, danger);
        if (ped.x < 20 || ped.y < 20 || ped.x > 5180 || ped.y > 3780) peds.splice(i, 1);
      }
    },
  };
}

function updatePed(dt, game, ped, danger) {
  const city = game.city;
  if (ped.state === 'down' || ped.kind === 'shooter') return; // combat.js drives shooters
  if (ped.kind === 'passenger') return; // the mission director walks the passenger

  // Fear: gunfire or a fast car close by sends walkers running, then cowering.
  if (danger && ped.state !== 'flee') {
    const d = Math.hypot(ped.x - danger.x, ped.y - danger.y);
    if (d < danger.radius) {
      ped.state = 'flee';
      ped.wait = game.rngPeds.range(1.2, 2.6);
      ped.angle = Math.atan2(ped.y - danger.y, ped.x - danger.x) + game.rngPeds.range(-0.5, 0.5);
    }
  }
  if (ped.state === 'flee') {
    ped.wait -= dt;
    movePed(dt, game, ped, ped.walkSpeed * 2.1, ped.angle);
    if (ped.wait <= 0) {
      ped.state = game.rngPeds.chance(0.4) ? 'cower' : 'walk';
      ped.wait = game.rngPeds.range(1, 3);
    }
    return;
  }
  if (ped.state === 'cower') {
    ped.wait -= dt;
    ped.speed = 0;
    if (ped.wait <= 0) ped.state = 'walk';
    return;
  }
  if (ped.kind === 'sunbather' || ped.state === 'stand') {
    ped.speed = 0;
    return;
  }
  if (ped.kind === 'crew') {
    // Crew drift a few steps, smoke, drift back: they own this pavement.
    ped.wait -= dt;
    if (ped.wait <= 0) {
      ped.wait = game.rngPeds.range(2, 5);
      ped.tx = ped.x + game.rngPeds.range(-50, 50);
      ped.ty = ped.y + game.rngPeds.range(-24, 24);
    }
    walkToward(dt, game, ped, 0.5);
    return;
  }
  if (ped.kind === 'jogger') {
    ped.ty += 120 * dt * (ped.id % 2 === 0 ? 1 : -1);
    if (ped.ty > 3200) ped.ty = 200;
    if (ped.ty < 160) ped.ty = 3100;
    ped.tx = BEACH.sandX - 60;
    walkToward(dt, game, ped, 1.7);
    return;
  }
  // Ordinary walker: pick a point along the block edge, amble to it, repeat.
  ped.wait -= dt;
  const dx = ped.tx - ped.x;
  const dy = ped.ty - ped.y;
  if (Math.hypot(dx, dy) < 14 || ped.wait <= 0) {
    ped.wait = game.rngPeds.range(4, 9);
    const hop = game.rngPeds.range(120, 420);
    const dir = game.rngPeds.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    let nx = ped.x + Math.cos(dir) * hop;
    let ny = ped.y + Math.sin(dir) * hop;
    // Stay off the water and out of the sea of traffic where possible.
    nx = Math.max(40, Math.min(BEACH.waterX - 30, nx));
    ny = Math.max(40, Math.min(3380, ny));
    ped.tx = nx;
    ped.ty = ny;
  }
  walkToward(dt, game, ped, 1);
  void city;
}

function walkToward(dt, game, ped, pace) {
  const dx = ped.tx - ped.x;
  const dy = ped.ty - ped.y;
  const d = Math.hypot(dx, dy);
  if (d < 6) {
    ped.speed = 0;
    return;
  }
  const want = Math.atan2(dy, dx);
  movePed(dt, game, ped, ped.walkSpeed * pace, want);
}

function movePed(dt, game, ped, speed, angle) {
  ped.angle = angle;
  ped.speed = speed;
  let nx = ped.x + Math.cos(angle) * speed * dt;
  let ny = ped.y + Math.sin(angle) * speed * dt;
  const hit = game.city.collide(nx, ny, 11);
  if (hit) {
    nx += hit.nx * hit.depth;
    ny += hit.ny * hit.depth;
  }
  ped.x = nx;
  ped.y = ny;
  ped.phase += dt * (4 + speed * 0.05);
}

/** Paint one pedestrian, top-down: shadow, legs in stride, torso, head, hat. */
export function drawPed(ctx, ped, time) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.state === 'down') {
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(17, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const stride = ped.speed > 4 ? Math.sin(ped.phase * 6) * 5 : 0;
  ctx.rotate(ped.angle);
  // Legs.
  ctx.fillStyle = ped.pants;
  ctx.fillRect(-3, -6 + stride * 0.4, 11, 4.4);
  ctx.fillRect(-3, 1.6 - stride * 0.4, 11, 4.4);
  // Arms at the sides, swinging against the stride.
  ctx.fillStyle = ped.skin;
  ctx.fillRect(0, -11.5 + stride * 0.3, 9, 3.6);
  ctx.fillRect(0, 7.9 - stride * 0.3, 9, 3.6);
  // Torso with a hint of shoulders and a dark seam so it reads at any zoom.
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.ellipse(0, 0, 10.5, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  if (ped.state === 'cower') {
    ctx.fillStyle = ped.skin;
    ctx.fillRect(6, -8, 5, 4);
    ctx.fillRect(6, 4, 5, 4);
  }
  // Head and hat.
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(2.5, 0, 5.6, 0, Math.PI * 2);
  ctx.fill();
  if (ped.hat) {
    ctx.fillStyle = ped.pants;
    ctx.beginPath();
    ctx.arc(2.5, 0, 6.4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (ped.kind === 'crew') {
    ctx.strokeStyle = '#ff4fd8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 12.5, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (ped.kind === 'shooter') {
    ctx.fillStyle = '#15151c';
    ctx.fillRect(8, 5, 15, 4);
  }
  ctx.restore();
  void time;
}
