// Ambient traffic for NEON PALMS: Palmera drives on the right. Each traffic car owns a
// heading along the avenue/street grid, holds its lane offset, and at every intersection
// decides — mostly straight, sometimes a turn — so the flow never repeats. Cars brake for
// whatever is ahead of them, honk when blocked, and are culled and respawned around the
// player so the streets near the camera are always alive. A second population just parks:
// kerbs and lots full of stealable metal.

import { GRID, WORLD } from './config.js';
import { avenueX, streetY } from './city.js';
import { createCar, forwardSpeed, PAINTS, stepCar } from './vehicles.js';

const CRUISE = { min: 130, max: 210 };
const ACTIVE_TARGET = 13;
const SPAWN_MIN = 850;
const SPAWN_MAX = 1500;
const CULL = 1750;

const HEADINGS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

function lanePoint(heading, x, y) {
  // The point on the correct lane nearest to (x, y) for a car travelling `heading`.
  if (heading === 0) { // east: south half of the street
    const j = Math.round((y - GRID.road / 2) / GRID.pitchY);
    return { x, y: streetY(clampJ(j)) + 21 };
  }
  if (heading === Math.PI) { // west: north half
    const j = Math.round((y - GRID.road / 2) / GRID.pitchY);
    return { x, y: streetY(clampJ(j)) - 21 };
  }
  if (heading === Math.PI / 2) { // south: west half of the avenue
    const i = Math.round((x - GRID.road / 2) / GRID.pitchX);
    return { x: avenueX(clampI(i)) - 21, y };
  }
  const i = Math.round((x - GRID.road / 2) / GRID.pitchX);
  return { x: avenueX(clampI(i)) + 21, y }; // north: east half
}

function clampI(i) { return Math.max(0, Math.min(GRID.cols, i)); }
function clampJ(j) { return Math.max(0, Math.min(GRID.rows, j)); }

function nearIntersection(x, y) {
  const i = Math.round((x - GRID.road / 2) / GRID.pitchX);
  const j = Math.round((y - GRID.road / 2) / GRID.pitchY);
  return Math.abs(x - avenueX(clampI(i))) < 46 && Math.abs(y - streetY(clampJ(j))) < 46;
}

export function createTraffic(rng, city) {
  const cars = [];
  const parked = [];

  function spawnParked() {
    // Kerbside rows on the quieter streets plus the parking-lot blocks.
    for (let n = 0; n < 84; n += 1) {
      const horizontal = rng.chance(0.5);
      let x;
      let y;
      let angle;
      if (horizontal) {
        const j = rng.int(0, GRID.rows);
        x = rng.range(240, 4300);
        y = streetY(j) + rng.pick([-52, 52]);
        angle = y > streetY(j) ? Math.PI : 0;
        if (rng.chance(0.5)) angle += Math.PI;
      } else {
        const i = rng.int(0, GRID.cols);
        x = avenueX(i) + rng.pick([-52, 52]);
        y = rng.range(240, 2900);
        angle = x > avenueX(i) ? -Math.PI / 2 : Math.PI / 2;
        if (rng.chance(0.5)) angle += Math.PI;
      }
      if (city.collide(x, y, 40)) continue;
      const model = rng.pick(['sedan', 'compact', 'taxa', 'van', 'vader', 'lux', 'lowrider', 'comet']);
      const car = createCar(model, x, y, angle, rng.pick(PAINTS));
      car.parked = true;
      car.lightsOn = false;
      parked.push(car);
    }
    for (const blockRow of city.blocks) {
      for (const block of blockRow) {
        if (block.kind !== 'lot') continue;
        for (let n = 0; n < 7; n += 1) {
          const x = block.x + 60 + (n % 4) * 120;
          const y = block.y + 90 + Math.floor(n / 4) * 130;
          const car = createCar(rng.pick(['sedan', 'compact', 'van', 'vader']), x, y, Math.PI / 2, rng.pick(PAINTS));
          car.parked = true;
          car.lightsOn = false;
          parked.push(car);
        }
      }
    }
  }

  function spawnActive(px, py) {
    for (let tries = 0; tries < 8; tries += 1) {
      const heading = rng.pick(HEADINGS);
      const along = rng.range(0, 1);
      let x;
      let y;
      if (heading === 0 || heading === Math.PI) {
        const j = rng.int(0, GRID.rows);
        y = streetY(j);
        x = px + (rng.chance(0.5) ? -1 : 1) * rng.range(SPAWN_MIN, SPAWN_MAX);
        if (x < 120 || x > 4360) continue;
        y += rng.range(-6, 6);
        void along;
      } else {
        const i = rng.int(0, GRID.cols);
        x = avenueX(i);
        y = py + (rng.chance(0.5) ? -1 : 1) * rng.range(SPAWN_MIN, SPAWN_MAX);
        if (y < 120 || y > 2960) continue;
        x += rng.range(-6, 6);
      }
      const lane = lanePoint(heading, x, y);
      const model = rng.pick(['sedan', 'sedan', 'compact', 'taxa', 'van', 'vader', 'lux', 'comet', 'lowrider', 'truck']);
      const car = createCar(model, lane.x, lane.y, heading, rng.pick(PAINTS));
      car.driver = 'traffic';
      car.nav = { heading, cruise: rng.range(CRUISE.min, CRUISE.max), decided: false, honk: 0 };
      cars.push(car);
      return;
    }
  }

  spawnParked();

  return {
    cars,
    parked,
    update(dt, game) {
      const p = game.player;
      // Keep the neighbourhood populated.
      let active = 0;
      for (const car of cars) if (!car.dead) active += 1;
      if (active < ACTIVE_TARGET) spawnActive(p.x, p.y);

      for (let i = cars.length - 1; i >= 0; i -= 1) {
        const car = cars[i];
        const dist = Math.hypot(car.x - p.x, car.y - p.y);
        if (dist > CULL || car.wreck) {
          if (dist > CULL) cars.splice(i, 1);
          continue;
        }
        driveTraffic(dt, game, car);
      }
      // Traffic respects traffic (and the player's car) at least a little.
      for (let i = 0; i < cars.length; i += 1) {
        for (let j = i + 1; j < cars.length; j += 1) {
          const a = cars[i];
          const b = cars[j];
          if (Math.abs(a.x - b.x) < 150 && Math.abs(a.y - b.y) < 150) game.collidePair(a, b);
        }
      }
    },
  };
}

function driveTraffic(dt, game, car) {
  const nav = car.nav;
  const fx = Math.cos(nav.heading);
  const fy = Math.sin(nav.heading);
  // Look ahead: brake for anything in the lane corridor.
  let blocked = 0;
  const check = (other) => {
    if (!other || other === car) return;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * fx + dy * fy;
    const side = Math.abs(-dx * fy + dy * fx);
    if (ahead > 0 && ahead < 120 && side < 30) blocked = Math.max(blocked, 1 - ahead / 120);
  };
  for (const other of game.allCars()) check(other);
  check(game.player.car);

  // Intersection decisions.
  if (nearIntersection(car.x, car.y)) {
    if (!nav.decided) {
      nav.decided = true;
      const roll = game.rngTraffic.next();
      if (roll < 0.24) nav.heading = wrapHeading(nav.heading + Math.PI / 2);
      else if (roll < 0.42) nav.heading = wrapHeading(nav.heading - Math.PI / 2);
      // Keep inside the city: bounce off the edges.
      if (car.x < 260 && nav.heading === Math.PI) nav.heading = 0;
      if (car.x > 4180 && nav.heading === 0) nav.heading = Math.PI;
      if (car.y < 260 && nav.heading === -Math.PI / 2) nav.heading = Math.PI / 2;
      if (car.y > 2820 && nav.heading === Math.PI / 2) nav.heading = -Math.PI / 2;
    }
  } else {
    nav.decided = false;
  }

  const lane = lanePoint(nav.heading, car.x + fx * 60, car.y + fy * 60);
  const tx = car.x + fx * 150 + (lane.x - car.x) * 0.6;
  const ty = car.y + fy * 150 + (lane.y - car.y) * 0.6;
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.4));
  const speed = forwardSpeed(car);
  let throttle = speed < nav.cruise ? 0.75 : 0;
  if (blocked > 0) {
    throttle = speed > 8 ? -0.9 : 0;
    nav.honk -= dt;
    if (blocked > 0.5 && nav.honk <= 0) {
      nav.honk = 2.5;
      game.audio.horn();
    }
  }
  stepCar(car, { throttle, steer, handbrake: false }, dt, game.city);
  void WORLD;
}

function wrapHeading(h) {
  const list = HEADINGS;
  let idx = list.indexOf(h);
  if (idx < 0) idx = 0;
  return list[(idx + list.length) % list.length];
}
