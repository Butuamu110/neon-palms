// The Palmera PD Interdiction unit: a heat meter that crimes feed and hiding drains, five
// stars of response, and a dispatcher who talks the whole time. Units pursue by intercept
// (they aim where the player is going, not where he is), lose the trail when the player
// breaks line of sight, set roadblocks on the avenues ahead at three stars, and at four
// the OSPREY-1 helicopter takes the search over from above. Every unit carries a callsign,
// a role and a live distance — the dispatch panel on the HUD is fed from here.

import { WANTED } from './config.js';
import { avenueX, streetY } from './city.js';
import { createCar, forwardSpeed, stepCar } from './vehicles.js';

export const CRIME_HEAT = {
  shot: 26,
  shotAtCop: 60,
  pedDown: 55,
  copDown: 130,
  carjack: 34,
  hitCar: 10,
  hitCopCar: 42,
  reckless: 6,
  theft: 30,
  explosion: 90,
};

const PURSUIT_SIGNS = ['FALCON-3', 'COYOTE-7', 'JACKAL-5', 'BARRACUDA-2', 'FALCON-8', 'COYOTE-2', 'JACKAL-9'];
const BLOCK_SIGNS = ['GATOR-6', 'GATOR-9'];
const CHATTER = {
  engage: [
    'Dispatch: all units, suspect is hot in {district}.',
    'Dispatch: be advised, suspect vehicle matches the Solstice crew.',
    'Dispatch: do not lose that car. Repeat, do not lose it.',
  ],
  lost: [
    'Dispatch: we lost eyes. Grid search, people, grid search.',
    'Dispatch: suspect went dark around {district}. Hold the avenues.',
    'Dispatch: air unit, talk to me. Anybody got eyes?',
  ],
  found: [
    'Dispatch: eyes back on. All units converge.',
    'Dispatch: there he is — {district}. Move, move.',
  ],
  block: [
    'Dispatch: GATOR units, cork the avenue ahead of him.',
    'Dispatch: roadblock up. He is not leaving {district} standing.',
  ],
  air: [
    'Dispatch: OSPREY-1 is wheels-up. Light him up.',
    'OSPREY-1: I have the roof in the light. He is mine now.',
  ],
  bust: [
    'Dispatch: suspect in custody. Nice work, Palmera.',
  ],
};

export function createPolice(rng) {
  return {
    heat: 0,
    stars: 0,
    seen: false,
    seenAgo: 99,
    lastSeenX: 0,
    lastSeenY: 0,
    bust: 0,
    units: [],
    blocks: [],
    heli: null,
    feed: [],
    chatterLine: '',
    chatterTimer: 0,
    signIndex: 0,

    reset() {
      this.heat = 0;
      this.stars = 0;
      this.seen = false;
      this.seenAgo = 99;
      this.bust = 0;
      this.units.length = 0;
      this.blocks.length = 0;
      this.heli = null;
      this.feed.length = 0;
      this.chatterLine = '';
    },

    report(kind, game, x, y) {
      const add = CRIME_HEAT[kind] || 10;
      const before = this.stars;
      this.heat = Math.min(WANTED.maxHeat, this.heat + add);
      this.stars = starsFor(this.heat);
      // A crime near a unit or a watching ped is seen the moment it happens.
      if (this.witnessed(game, x, y)) {
        this.seen = true;
        this.seenAgo = 0;
        this.lastSeenX = game.player.x;
        this.lastSeenY = game.player.y;
      }
      if (this.stars > before) this.onStarsUp(game);
    },

    witnessed(game, x, y) {
      for (const unit of this.units) {
        if (Math.hypot(unit.car.x - x, unit.car.y - y) < WANTED.sightRange) return true;
      }
      if (this.heli && Math.hypot(this.heli.x - x, this.heli.y - y) < 900) return true;
      for (const ped of game.crowds.peds) {
        if (!ped.dead && Math.hypot(ped.x - x, ped.y - y) < 190) return true;
      }
      return false;
    },

    onStarsUp(game) {
      const district = game.city.districtAt(game.player.x, game.player.y).name;
      if (this.stars >= 4 && !this.heli) this.say(game.rngPolice.pick(CHATTER.air), district);
      else if (this.stars === 3) this.say(game.rngPolice.pick(CHATTER.block), district);
      else this.say(game.rngPolice.pick(CHATTER.engage), district);
    },

    say(template, district) {
      this.chatterLine = template.replace('{district}', district || 'the Mile');
      this.chatterTimer = 6;
    },

    update(dt, game) {
      const p = game.player;
      // Sight: any unit (or the heli) with a clear-ish line keeps the trail warm.
      let anySight = false;
      for (const unit of this.units) {
        const d = Math.hypot(unit.car.x - p.x, unit.car.y - p.y);
        if (d < WANTED.sightRange && !unit.car.wreck) anySight = true;
      }
      if (this.heli && Math.hypot(this.heli.x - p.x, this.heli.y - p.y) < 980) anySight = true;
      if (anySight) {
        if (!this.seen && this.heat > 0) this.say(game.rngPolice.pick(CHATTER.found), game.city.districtAt(p.x, p.y).name);
        this.seen = true;
        this.seenAgo = 0;
        this.lastSeenX = p.x;
        this.lastSeenY = p.y;
      } else if (this.seen) {
        this.seenAgo += dt;
        if (this.seenAgo > 2.5) {
          this.seen = false;
          if (this.heat > 0) this.say(game.rngPolice.pick(CHATTER.lost), game.city.districtAt(p.x, p.y).name);
        }
      }
      // Heat decay: fast when unseen, slow while they watch.
      const decay = this.seen ? WANTED.decayPerSecond * 0.25 : this.seenAgo > 4 ? WANTED.decayHiddenPerSecond : WANTED.decayPerSecond;
      if (this.heat > 0) {
        this.heat = Math.max(0, this.heat - decay * dt);
        this.stars = starsFor(this.heat);
        if (this.heat === 0) this.standDown();
      }
      if (this.chatterTimer > 0) this.chatterTimer -= dt;

      this.maintainUnits(dt, game);
      this.updateUnits(dt, game);
      this.updateHeli(dt, game);
      this.updateFeed(game);
      this.updateBust(dt, game);
    },

    standDown() {
      for (const unit of this.units) unit.mode = 'leave';
      this.blocks.length = 0;
      this.heli = null;
      this.bust = 0;
    },

    targetUnits() {
      return [0, 2, 3, 4, 5, 7][this.stars] || 0;
    },

    maintainUnits(dt, game) {
      const want = this.targetUnits();
      const alive = this.units.filter((u) => !u.car.wreck && u.mode !== 'leave');
      if (alive.length < want && this.heat > 0) {
        this.spawnTimer = (this.spawnTimer || 0) - dt;
        if (this.spawnTimer <= 0) {
          this.spawnTimer = 1.1;
          this.spawnUnit(game);
        }
      }
      // Roadblocks at three stars and up: one corked avenue ahead of the player.
      if (this.stars >= 3 && this.blocks.length === 0 && this.seen) this.setRoadblock(game);
      for (let i = this.blocks.length - 1; i >= 0; i -= 1) {
        if (Math.hypot(this.blocks[i].x - game.player.x, this.blocks[i].y - game.player.y) > 1500) this.blocks.splice(i, 1);
      }
      // The helicopter joins at four stars.
      if (this.stars >= 4 && !this.heli) {
        this.heli = { x: game.player.x + 500, y: game.player.y - 500, angle: 0, rotor: 0, spotX: game.player.x, spotY: game.player.y };
      }
      if (this.stars < 4) this.heli = null;
      // Retire leaving/wrecked units far away.
      for (let i = this.units.length - 1; i >= 0; i -= 1) {
        const u = this.units[i];
        const d = Math.hypot(u.car.x - game.player.x, u.car.y - game.player.y);
        if ((u.mode === 'leave' && d > 800) || d > 2600) this.units.splice(i, 1);
      }
    },

    spawnUnit(game) {
      const p = game.player;
      // Come from a road point off-screen, ahead of the player's travel if possible.
      const angle = game.rngPolice.range(0, Math.PI * 2);
      let x = p.x + Math.cos(angle) * 980;
      let y = p.y + Math.sin(angle) * 980;
      x = Math.max(80, Math.min(4360, x));
      y = Math.max(80, Math.min(2960, y));
      // Snap to the nearest road crossing so they arrive on tarmac.
      const i = Math.round((x - 75) / 710);
      const j = Math.round((y - 75) / 570);
      if (game.rngPolice.chance(0.5)) x = avenueX(Math.max(0, Math.min(6, i)));
      else y = streetY(Math.max(0, Math.min(5, j)));
      const car = createCar('cruiser', x, y, Math.atan2(p.y - y, p.x - x), '#f2f2f2');
      car.driver = 'cop';
      car.callsign = PURSUIT_SIGNS[this.signIndex % PURSUIT_SIGNS.length];
      car.role = 'PURSUIT';
      this.signIndex += 1;
      this.units.push({ car, mode: 'pursue', stuck: 0, searchT: 0, wx: x, wy: y });
      return car;
    },

    setRoadblock(game) {
      const p = game.player;
      const target = p.car || p;
      const heading = target.angle || 0;
      const aheadX = p.x + Math.cos(heading) * 620;
      const aheadY = p.y + Math.sin(heading) * 620;
      // Cork the nearest avenue or street crossing ahead.
      const i = Math.max(0, Math.min(6, Math.round((aheadX - 75) / 710)));
      const j = Math.max(0, Math.min(5, Math.round((aheadY - 75) / 570)));
      const onAvenue = Math.abs(Math.cos(heading)) < 0.6;
      const bx = onAvenue ? avenueX(i) : aheadX;
      const by = onAvenue ? aheadY : streetY(j);
      if (bx > 4400 || by > 3000 || bx < 60 || by < 60) return;
      const sign = BLOCK_SIGNS[this.blocks.length % BLOCK_SIGNS.length];
      for (let k = -1; k <= 1; k += 1) {
        const car = createCar('cruiser', bx + (onAvenue ? k * 52 : 0), by + (onAvenue ? 0 : k * 52), onAvenue ? 0 : Math.PI / 2, '#f2f2f2');
        car.driver = 'cop';
        car.parked = true;
        car.callsign = sign;
        car.role = 'ROADBLOCK';
        this.blocks.push({ car, x: bx, y: by });
        this.units.push({ car, mode: 'block', stuck: 0, searchT: 0, wx: bx, wy: by });
      }
    },

    updateUnits(dt, game) {
      const p = game.player;
      for (const unit of this.units) {
        const car = unit.car;
        if (car.wreck) continue;
        if (unit.mode === 'block') continue; // parked cork: lights on, going nowhere
        let tx;
        let ty;
        let cruise = 1;
        if (unit.mode === 'leave') {
          tx = car.x + Math.cos(car.angle) * 400;
          ty = car.y + Math.sin(car.angle) * 400;
          cruise = 0.55;
        } else if (this.seen || unit.mode === 'pursue' && this.seenAgo < 6) {
          // Intercept: lead the target by its velocity.
          const tvx = p.car ? p.car.vx : 0;
          const tvy = p.car ? p.car.vy : 0;
          const d = Math.hypot(p.x - car.x, p.y - car.y);
          const lead = Math.min(0.9, d / 420);
          tx = p.x + tvx * lead;
          ty = p.y + tvy * lead;
          unit.wx = tx;
          unit.wy = ty;
        } else {
          // Search: sweep around the last place the trail was warm.
          unit.searchT -= dt;
          if (unit.searchT <= 0) {
            unit.searchT = game.rngPolice.range(3, 6);
            unit.wx = this.lastSeenX + game.rngPolice.range(-420, 420);
            unit.wy = this.lastSeenY + game.rngPolice.range(-420, 420);
          }
          tx = unit.wx;
          ty = unit.wy;
          cruise = 0.7;
        }
        driveUnit(dt, game, unit, tx, ty, cruise);
      }
    },

    updateHeli(dt, game) {
      if (!this.heli) return;
      const p = game.player;
      const heli = this.heli;
      // Orbit the player's neighbourhood; the light hunts when the trail is cold.
      const orbit = game.time * 0.35;
      const tx = (this.seen ? p.x : this.lastSeenX) + Math.cos(orbit) * 190;
      const ty = (this.seen ? p.y : this.lastSeenY) + Math.sin(orbit) * 190;
      heli.x += (tx - heli.x) * Math.min(1, dt * 1.6);
      heli.y += (ty - heli.y) * Math.min(1, dt * 1.6);
      heli.angle = Math.atan2(p.y - heli.y, p.x - heli.x);
      heli.rotor += dt * 40;
      const sx = this.seen ? p.x : this.lastSeenX + Math.sin(game.time * 0.7) * 160;
      const sy = this.seen ? p.y : this.lastSeenY + Math.cos(game.time * 0.55) * 160;
      heli.spotX += (sx - heli.spotX) * Math.min(1, dt * 3);
      heli.spotY += (sy - heli.spotY) * Math.min(1, dt * 3);
    },

    updateBust(dt, game) {
      const p = game.player;
      if (this.stars === 0 || game.screen !== 'play') {
        this.bust = 0;
        return;
      }
      const pSpeed = p.car ? Math.abs(forwardSpeed(p.car)) : Math.hypot(p.vx || 0, p.vy || 0);
      let near = false;
      for (const unit of this.units) {
        if (unit.car.wreck) continue;
        const d = Math.hypot(unit.car.x - p.x, unit.car.y - p.y);
        if (d < 120 && pSpeed < 26) near = true;
      }
      if (near) {
        this.bust += dt;
        if (this.bust >= WANTED.bustSeconds) game.onBusted();
      } else {
        this.bust = Math.max(0, this.bust - dt * 1.6);
      }
    },

    /** The dispatch panel's rows: callsign, role, live distance, status. */
    updateFeed(game) {
      const p = game.player;
      this.feed.length = 0;
      const rows = [];
      for (const unit of this.units) {
        if (unit.car.wreck) continue;
        const d = Math.round(Math.hypot(unit.car.x - p.x, unit.car.y - p.y));
        rows.push({
          sign: unit.car.callsign,
          role: unit.car.role,
          dist: d,
          status: unit.mode === 'block' ? 'HOLDING' : this.seen ? (d < WANTED.sightRange ? 'IN SIGHT' : 'EN ROUTE') : 'SEARCHING',
        });
      }
      if (this.heli) {
        rows.push({ sign: 'OSPREY-1', role: 'AIR UNIT', dist: Math.round(Math.hypot(this.heli.x - p.x, this.heli.y - p.y)), status: this.seen ? 'IN SIGHT' : 'SEARCHING' });
      }
      rows.sort((a, b) => a.dist - b.dist);
      for (const row of rows.slice(0, 5)) this.feed.push(row);
    },
  };
}

export function starsFor(heat) {
  return Math.max(0, Math.min(5, Math.ceil(heat / WANTED.starWidth)));
}

/** Steer a police car at a point with the shared arcade physics; unstick by reversing. */
function driveUnit(dt, game, unit, tx, ty, cruise) {
  const car = unit.car;
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.6));
  const speed = forwardSpeed(car);
  const dist = Math.hypot(tx - car.x, ty - car.y);
  let throttle = 1;
  if (Math.abs(diff) > 2.2 && dist < 200) throttle = -0.6;
  else if (dist < 90 && !game.player.car) throttle = speed > 30 ? -0.5 : 0.15;
  else throttle = speed < car.def.top * cruise ? 1 : 0.2;
  // Stuck detection: barely moving with the throttle down means a wall; back out.
  if (Math.abs(speed) < 9 && throttle > 0) unit.stuck += dt;
  else unit.stuck = 0;
  if (unit.stuck > 0.7) {
    throttle = -1;
    if (unit.stuck > 1.3) unit.stuck = 0;
  }
  const impact = stepCar(car, { throttle, steer: unit.stuck > 0.7 ? -steer : steer, handbrake: Math.abs(diff) > 1.4 && speed > 200 }, dt, game.city);
  if (impact > 130) game.onCopCrashed(car, impact);
}
