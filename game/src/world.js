// NEON PALMS' world: the object every system shares. createGame builds the city and its
// people from the seed, wires the crime reports to the dispatcher, the mission director to
// its stage entities (gunmen, a car to steal, a tail to shake, Dante's Vader), and steps
// the whole simulation one fixed tick at a time. Screens live here too — the loop in
// main.js asks the world to update and the renderer to draw whatever screen is current.

import { DAY, RADIO, ZOOM } from './config.js';
import { createRng, deriveSeed } from './rng.js';
import { createCity } from './city.js';
import { createPlayer, nearestStealable } from './player.js';
import { createTraffic } from './traffic.js';
import { createCrowds, createPed } from './peds.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createCar, stepCar, collideCars, forwardSpeed } from './vehicles.js';
import { catalogFor, nearestShop } from './economy.js';
import { saveSlot } from './save.js';

export function createGame(seed, input, audio) {
  const rngCity = createRng(deriveSeed(seed, 'city'));
  const city = createCity(rngCity);
  const club = city.poi('club');
  const garagePoi = city.poi('garage');

  const game = {
    seed,
    input,
    audio,
    city,
    rngTraffic: createRng(deriveSeed(seed, 'traffic')),
    rngPeds: createRng(deriveSeed(seed, 'peds')),
    rngCombat: createRng(deriveSeed(seed, 'combat')),
    rngPolice: createRng(deriveSeed(seed, 'police')),
    rngMission: createRng(deriveSeed(seed, 'mission')),
    time: 0,
    tod: DAY.start,
    screen: 'title',
    menuIndex: 0,
    titleItems: [],
    camera: { x: club.x, y: club.y, zoom: 1.02 },
    camLock: false,
    view: { w: 1280, h: 960 },
    cash: 1250,
    rep: 0,
    garage: [],
    radioIndex: 0,
    particles: [],
    danger: null,
    dialogue: null,
    dialogueQueue: [],
    banner: null,
    prompt: null,
    shop: null,
    shopIndex: 0,
    overKind: null,
    hurtFlash: 0,
    frozen: false,
    extraCars: [],
    stats: {
      timePlayed: 0, distance: 0, distanceFoot: 0, earned: 0,
      jobsTaken: 0, jobsDone: 0, carsTaken: 0, shotsFired: 0,
      pedsDown: 0, copsDown: 0, busts: 0, wasteds: 0,
    },
  };

  game.player = createPlayer(club.x, club.y + 92);
  game.traffic = createTraffic(game.rngTraffic, city);
  game.crowds = createCrowds(game.rngPeds, city);
  game.police = createPolice(game.rngPolice);
  game.combat = createCombat();
  game.missions = createMissions();

  // The gold Comet S that Paz keeps for runners: mission 1 starts at its door. It parks
  // on the street in front of the garage — the first version sat in the 26-unit slot
  // between the club and shop buildings, spawning overlapped with both walls, so every
  // start began with collision shoves and crash reports before the car ever moved.
  const starter = createCar('comet', garagePoi.x, 1752, 0, '#ffd257');
  starter.underglow = '#39e6ff';
  game.extraCars.push(starter);
  game.starterCar = starter;

  game.radioStation = RADIO[0];

  game.allCars = function allCars() {
    const out = [];
    for (const car of game.traffic.cars) out.push(car);
    for (const car of game.traffic.parked) out.push(car);
    for (const car of game.extraCars) out.push(car);
    for (const unit of game.police.units) out.push(unit.car);
    return out;
  };

  game.collidePair = function collidePair(a, b) {
    const impact = collideCars(a, b);
    if (impact > 55 && (a === game.player.car || b === game.player.car)) {
      const other = a === game.player.car ? b : a;
      const isCop = game.police.units.some((u) => u.car === other);
      game.police.report(isCop ? 'hitCopCar' : 'hitCar', game, other.x, other.y);
      game.audio.hit();
    }
    return impact;
  };

  game.setDanger = function setDanger(x, y, radius) {
    game.danger = { x, y, radius, t: 0.7 };
  };

  game.spawnSparks = function spawnSparks(x, y, n) {
    for (let i = 0; i < n; i += 1) {
      const a = game.rngCombat.range(0, Math.PI * 2);
      const sp = game.rngCombat.range(40, 220);
      game.particles.push({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: game.rngCombat.range(0.15, 0.4), max: 0.4 });
    }
  };

  game.confettiBurst = function confettiBurst(x, y, n) {
    const colors = ['#ff4fd8', '#39e6ff', '#ffd257', '#5cff9d', '#ff8a5c'];
    for (let i = 0; i < n; i += 1) {
      game.particles.push({
        kind: 'confetti', x: x + game.rngCombat.range(-90, 90), y: y + game.rngCombat.range(-70, 30),
        vx: game.rngCombat.range(-26, 26), vy: game.rngCombat.range(14, 60),
        rot: game.rngCombat.range(0, 6), life: game.rngCombat.range(1.4, 2.6), max: 2.6,
        color: colors[i % colors.length],
      });
    }
  };

  game.showDialogue = function showDialogue(lines) {
    for (const line of lines || []) game.dialogueQueue.push(line);
  };

  game.showBanner = function showBanner(title, sub, pay, rep) {
    game.banner = { title, sub, pay, rep, t: 0, dur: 4.4 };
    if (title === 'MISSION PASSED') game.confettiBurst(game.player.x, game.player.y - 40, 42);
  };

  game.earn = function earn(amount) {
    game.cash += amount;
    game.stats.earned += amount;
  };

  game.saveTo = function saveTo(slot) {
    return saveSlot(game, slot);
  };

  game.spawnGarageCar = function spawnGarageCar(modelId) {
    for (let i = game.extraCars.length - 1; i >= 0; i -= 1) {
      if (game.extraCars[i].garageSpawn) game.extraCars.splice(i, 1);
    }
    const car = createCar(modelId, garagePoi.x, garagePoi.y - 46, 0, '#e8e4da');
    car.garageSpawn = true;
    game.extraCars.push(car);
    return `${car.def.name} is out front. E to drive.`;
  };

  game.ejectDriver = function ejectDriver(car, angry) {
    if (car.driver !== 'traffic') return;
    car.driver = null;
    car.parked = true;
    const ped = createPed(game.rngPeds, car.x + 30, car.y + 20, angry && game.rngPeds.chance(0.2) ? 'shooter' : 'walker');
    if (ped.kind === 'shooter') ped.weaponId = 'pistol';
    else {
      ped.state = 'flee';
      ped.wait = 2.4;
    }
    game.crowds.add(ped);
  };

  game.onPedDown = function onPedDown(ped) {
    game.spawnSparks(ped.x, ped.y, 3);
  };

  game.onCopCrashed = function onCopCrashed() {
    game.audio.glass();
  };

  game.onCopDown = function onCopDown(car) {
    game.stats.copsDown += 1;
    game.police.report('copDown', game, car.x, car.y);
  };

  game.onBusted = function onBusted() {
    if (game.screen !== 'play') return;
    game.stats.busts += 1;
    game.cash = Math.max(0, game.cash - 400);
    game.overKind = 'busted';
    game.screen = 'over';
    game.missions.onPlayerDown(game);
    game.audio.fail();
  };

  game.onWasted = function onWasted() {
    if (game.screen !== 'play') return;
    game.stats.wasteds += 1;
    game.cash = Math.max(0, game.cash - 350);
    game.overKind = 'wasted';
    game.screen = 'over';
    game.missions.onPlayerDown(game);
    game.audio.fail();
  };

  game.respawn = function respawn() {
    const p = game.player;
    if (p.car) {
      p.car.driver = null;
      p.car.parked = true;
      p.car = null;
    }
    const poi = game.overKind === 'busted' ? city.poi('precinct') : city.poi('hospital');
    p.x = poi.x;
    p.y = poi.y + 60;
    p.hp = 100;
    p.armor = 0;
    p.dead = false;
    game.police.reset();
    game.overKind = null;
    game.screen = 'play';
  };

  game.spawnStageEntities = function spawnStageEntities(stage, active) {
    const entities = [];
    if (stage.kind === 'shoot') {
      for (const [x, y] of stage.spots) {
        const ped = createPed(game.rngMission, x, y, 'shooter');
        ped.weaponId = stage.weapon || 'smg';
        ped.hp = 120;
        ped.angle = Math.atan2(game.player.y - y, game.player.x - x);
        game.crowds.add(ped);
        entities.push({ kind: 'shooter', ref: ped });
      }
    }
    if (stage.kind === 'steal') {
      const car = createCar(stage.model, stage.x + (active.stageIdx % 2 === 0 ? -60 : 70), stage.y + 52, Math.PI, stage.color);
      car.parked = true;
      game.extraCars.push(car);
      entities.push({ kind: 'targetCar', ref: car });
    }
    if (stage.kind === 'chase') {
      const car = createCar(stage.model, stage.x, stage.y, 0, stage.color);
      car.driver = 'target';
      game.extraCars.push(car);
      entities.push({ kind: 'targetCar', ref: car });
    }
    if (stage.passenger && !active.passenger) {
      const ped = createPed(game.rngMission, game.player.x + 24, game.player.y + 10, 'passenger');
      ped.name = 'Passenger';
      game.crowds.add(ped);
      active.passenger = ped;
    }
    if (stage.tail) {
      const car = createCar('vader', game.player.x - 320, game.player.y + 160, 0, '#3a3a44');
      car.driver = 'tail';
      game.extraCars.push(car);
      entities.push({ kind: 'tailCar', ref: car });
    }
    return entities;
  };

  game.tryInteract = function tryInteract() {
    const p = game.player;
    if (p.car) {
      p.leaveCar();
      game.audio.radio(game.radioIndex, false);
      return;
    }
    const offer = game.missions.offerPoint();
    if (offer && Math.hypot(p.x - offer.x, p.y - offer.y) < 92) {
      game.missions.accept(game);
      game.audio.uiPick();
      return;
    }
    const car = nearestStealable(game, 84);
    if (car) {
      const wasTraffic = car.driver === 'traffic';
      const wasCop = game.police.units.some((u) => u.car === car);
      if (wasTraffic) game.ejectDriver(car, false);
      p.enterCar(car);
      game.stats.carsTaken += wasTraffic || car.parked ? 1 : 0;
      if (wasTraffic || wasCop) {
        game.police.report(wasCop ? 'theft' : 'carjack', game, car.x, car.y);
        if (wasCop) game.police.heat = Math.min(500, game.police.heat + 60);
      }
      game.audio.radio(game.radioIndex, true);
      game.audio.uiPick();
    }
  };

  game.tryShop = function tryShop() {
    const poi = nearestShop(game, 110);
    if (!poi) return false;
    game.shop = { poi, items: catalogFor(poi, game), message: '' };
    game.shopIndex = 0;
    game.screen = 'shop';
    game.audio.uiPick();
    return true;
  };

  game.update = function update(dt) {
    if (game.frozen) return;
    if (game.screen === 'play') updatePlay(dt, game);
    else if (game.screen === 'title' || game.screen === 'over') updateAmbient(dt, game);
    updateTimers(dt, game);
  };

  return game;
}

function updateTimers(dt, game) {
  // Dialogue queue.
  if (game.dialogue) {
    game.dialogue.timer -= dt;
    if (game.dialogue.timer <= 0) game.dialogue = null;
  }
  if (!game.dialogue && game.dialogueQueue.length > 0) {
    const line = game.dialogueQueue.shift();
    game.dialogue = { who: line.who, text: line.text, timer: 3.8 };
  }
  if (game.banner) {
    game.banner.t += dt;
    if (game.banner.t > game.banner.dur) game.banner = null;
  }
  if (game.danger) {
    game.danger.t -= dt;
    if (game.danger.t <= 0) game.danger = null;
  }
  if (game.hurtFlash > 0) game.hurtFlash = Math.max(0, game.hurtFlash - dt * 1.4);
  // Particles.
  for (let i = game.particles.length - 1; i >= 0; i -= 1) {
    const pt = game.particles[i];
    pt.life -= dt;
    if (pt.life <= 0) {
      game.particles.splice(i, 1);
      continue;
    }
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    if (pt.kind === 'spark') pt.vy += 340 * dt;
    if (pt.kind === 'confetti') pt.rot += dt * 5;
  }
  if (game.particles.length > 420) game.particles.splice(0, game.particles.length - 420);
}

function updateAmbient(dt, game) {
  // Behind the title and the endings, the city keeps its own hours.
  game.traffic.update(dt, game);
  game.crowds.update(dt, game);
  const t = game.time;
  game.camera.x = game.city.poi('club').x + Math.cos(t * 0.06) * 430;
  game.camera.y = game.city.poi('club').y + Math.sin(t * 0.045) * 240;
  game.camera.zoom = 1.04;
}

function updatePlay(dt, game) {
  const p = game.player;
  game.stats.timePlayed += dt;
  game.tod += dt / DAY.length;
  if (game.tod >= 1) game.tod -= 1;

  // Driving or walking.
  if (p.car) {
    const car = p.car;
    const before = Math.hypot(car.vx, car.vy);
    const control = game.scriptControl
      ? game.scriptControl(car, game.time)
      : { throttle: game.input.throttle(), steer: game.input.steer(), handbrake: game.input.held.handbrake };
    const impact = stepCar(car, control, dt, game.city);
    if (impact > 120) {
      game.audio.glass();
      p.takeDamage((impact - 120) * 0.05, game);
      game.spawnSparks(car.x, car.y, 8);
    }
    game.stats.distance += Math.abs(before) * dt;
    // Car vs car.
    for (const other of game.allCars()) {
      if (other !== car && Math.abs(other.x - car.x) < 170 && Math.abs(other.y - car.y) < 170) game.collidePair(car, other);
    }
    game.audio.engine(Math.abs(forwardSpeed(car)) / car.def.top, true);
    // Rio IS the car while he drives: every system that reads the player's position —
    // police sight and pursuit, the bust radius, mission radii, the camera, the
    // minimap — must see the car's position, not the doorstep where he got in.
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
  } else {
    p.update(dt, game);
    game.stats.distanceFoot += p.speed * dt;
    game.audio.engine(0, false);
  }

  game.traffic.update(dt, game);
  game.crowds.update(dt, game);
  updateMissionCars(dt, game);
  game.combat.update(dt, game);
  game.police.update(dt, game);
  game.missions.update(dt, game);
  game.audio.siren(game.police.feed.length > 0 ? game.police.stars : 0);

  // Camera follows Rio.
  if (!game.camLock) {
    const target = p.car || p;
    const k = 1 - Math.pow(0.0015, dt);
    game.camera.x += (target.x - game.camera.x) * k;
    game.camera.y += (target.y - game.camera.y) * k;
    const wantZoom = p.car ? ZOOM.drive : ZOOM.foot;
    game.camera.zoom += (wantZoom - game.camera.zoom) * Math.min(1, dt * 2.2);
  }

  // The prompt line: what E or B would do right now.
  game.prompt = null;
  if (!p.car) {
    const offer = game.missions.offerPoint();
    if (offer && Math.hypot(p.x - offer.x, p.y - offer.y) < 92) {
      game.prompt = `E — Talk to ${game.missions.current().giver}`;
    } else {
      const shop = nearestShop(game, 110);
      const car = nearestStealable(game, 84);
      if (shop) game.prompt = `B — ${shop.name}`;
      else if (car) game.prompt = `E — ${car.driver === 'traffic' ? 'Steal' : 'Enter'} the ${car.def.name}`;
    }
  }
}

/** Mission cars with drivers of their own: Dante fleeing, the Vesper tail following. */
function updateMissionCars(dt, game) {
  const p = game.player;
  for (const car of game.extraCars) {
    if (car.driver !== 'target' && car.driver !== 'tail') continue;
    let tx;
    let ty;
    let cruise = 1;
    if (car.driver === 'target') {
      // Away from Rio, pulled toward the nearest crossing so the chase stays on streets.
      const away = Math.atan2(car.y - p.y, car.x - p.x);
      tx = car.x + Math.cos(away) * 320;
      ty = car.y + Math.sin(away) * 320;
      const i = Math.max(0, Math.min(6, Math.round((tx - 75) / 710)));
      const j = Math.max(0, Math.min(5, Math.round((ty - 75) / 570)));
      tx = tx * 0.6 + (i * 710 + 75) * 0.4;
      ty = ty * 0.6 + (j * 570 + 75) * 0.4;
      cruise = 0.97;
    } else {
      // The tail: sit two car-lengths behind Rio and match his pace.
      const back = p.car ? p.car.angle : p.angle;
      tx = p.x - Math.cos(back) * 170;
      ty = p.y - Math.sin(back) * 170;
      cruise = 0.9;
    }
    const want = Math.atan2(ty - car.y, tx - car.x);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.5));
    const speed = forwardSpeed(car);
    const dist = Math.hypot(tx - car.x, ty - car.y);
    let throttle = speed < car.def.top * cruise ? 1 : 0;
    if (car.driver === 'tail' && dist < 60) throttle = speed > 10 ? -0.6 : 0;
    if (Math.abs(diff) > 2.4 && dist < 160) throttle = -0.7;
    stepCar(car, { throttle, steer, handbrake: false }, dt, game.city);
    for (const other of game.allCars()) {
      if (other !== car && Math.abs(other.x - car.x) < 150 && Math.abs(other.y - car.y) < 150) game.collidePair(car, other);
    }
  }
}
