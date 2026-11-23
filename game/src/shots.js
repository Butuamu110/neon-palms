// The four NEON PALMS screenshot scenes behind ?shot=chase|action|map|passed. Each one
// builds a real moment out of the real systems — the career is set mid-story, the mission
// director accepts the actual job, the police hold the actual heat — then the simulation
// runs a fixed number of steps under a scripted hand so traffic, crowds and pursuers settle
// into the frame, and freezes. Same seed, same frame, every machine.

import { STEP } from './config.js';
import { createCar } from './vehicles.js';
import { weaponById } from './combat.js';

function runSteps(game, steps) {
  for (let i = 0; i < steps; i += 1) game.update(STEP);
}

function setCareer(game, { cash, rep, jobsDone, distance, timePlayed }) {
  game.cash = cash;
  game.rep = rep;
  game.stats.jobsDone = jobsDone;
  game.stats.jobsTaken = jobsDone + 1;
  game.stats.distance = distance;
  game.stats.timePlayed = timePlayed;
  game.stats.earned = cash + 4200;
  game.stats.carsTaken = 17;
  game.stats.shotsFired = 264;
}

function heroCar(game, x, y, angle, color) {
  const car = createCar('solstice', x, y, angle, color || '#ff2e88');
  car.underglow = '#ff4fd8';
  game.extraCars.push(car);
  game.player.enterCar(car);
  return car;
}

function teleportCop(game, dx, dy, angle) {
  const car = game.police.spawnUnit(game);
  const p = game.player;
  car.x = p.x + dx;
  car.y = p.y + dy;
  car.angle = angle;
  car.vx = Math.cos(angle) * 300;
  car.vy = Math.sin(angle) * 300;
  return car;
}

/** Clear ambient traffic out of a staged scene so the frame holds only its actors. */
function purgeTraffic(game, x, y, radius) {
  const traffic = game.traffic.cars;
  for (let i = traffic.length - 1; i >= 0; i -= 1) {
    if (Math.hypot(traffic[i].x - x, traffic[i].y - y) < radius) traffic.splice(i, 1);
  }
  const parked = game.traffic.parked;
  for (let i = parked.length - 1; i >= 0; i -= 1) {
    if (Math.hypot(parked[i].x - x, parked[i].y - y) < radius * 0.45) parked.splice(i, 1);
  }
}

/** Light the club signs along the street a scene plays on. */
function dressSigns(game, cx, cy, names) {
  const near = game.city.buildings
    .filter((b) => Math.abs(b.x + b.w / 2 - cx) < 460 && Math.abs(b.y + b.h - cy) < 300)
    .slice(0, names.length);
  near.forEach((b, i) => {
    b.neon = { text: names[i][0], color: names[i][1] };
  });
}

/** Shot 1 — the cover: a golden-hour chase down the Neon Mile at four stars. */
function stageChase(game) {
  setCareer(game, { cash: 14280, rep: 1010, jobsDone: 11, distance: 79200, timePlayed: 6930 });
  game.missions.index = 11;
  game.tod = 0.7;
  // Rio is mid-"Heat Signature": the job is live and the PD already has his face.
  const hero = heroCar(game, 2300, 1785, 0);
  hero.vx = 352;
  game.missions.accept(game);
  game.dialogueQueue.length = 0;
  game.dialogue = null;
  purgeTraffic(game, 2300, 1785, 950);
  dressSigns(game, 2300, 1710, [['CLUB SOLSTICE', '#ff4fd8'], ['BAR OLA', '#39e6ff'], ['NOCHE BRAVA', '#ffd257']]);
  game.police.heat = 385;
  game.police.stars = 4;
  game.police.seen = true;
  game.police.lastSeenX = hero.x;
  game.police.lastSeenY = hero.y;
  // The pack, close behind and already rolling, spaced for the tighter cover framing:
  // near bumper, mid bumper, and a third nose just entering frame left. GATOR's cork
  // waits up the street for the dispatch panel to name; OSPREY overhead, light on.
  teleportCop(game, -150, -50, 0.05);
  teleportCop(game, -222, 58, -0.04);
  teleportCop(game, -308, -104, 0.09);
  const blockA = game.police.spawnUnit(game);
  blockA.x = hero.x + 610;
  blockA.y = hero.y - 30;
  blockA.angle = Math.PI / 2;
  blockA.parked = true;
  blockA.role = 'ROADBLOCK';
  blockA.callsign = 'GATOR-6';
  const blockB = game.police.spawnUnit(game);
  blockB.x = hero.x + 610;
  blockB.y = hero.y + 34;
  blockB.angle = Math.PI / 2;
  blockB.parked = true;
  blockB.role = 'ROADBLOCK';
  blockB.callsign = 'GATOR-6';
  for (const unit of game.police.units) if (unit.car === blockA || unit.car === blockB) unit.mode = 'block';
  game.police.heli = { x: hero.x - 20, y: hero.y - 122, angle: 1.2, rotor: 2, spotX: hero.x, spotY: hero.y };
  game.scriptControl = () => ({ throttle: 1, steer: 0, handbrake: false });
  runSteps(game, 8);
  game.scriptControl = null;
  game.police.say('OSPREY-1: I have the roof in the light. He is mine now.', 'NEON MILE');
  game.police.chatterTimer = 6;
  game.police.updateFeed(game);
  // The cover framing, rebuilt rather than forced: at zoom 3.2 the hero's 124-unit
  // length covers ~31% of the frame width on its own merits, and the re-spaced pack
  // (above) still fits the tighter window — nothing is cropped into or out of the shot.
  game.camera.x = game.player.x - 42;
  game.camera.y = game.player.y + 14;
  game.camera.zoom = 3.2;
  game.frozen = true;
  return 'play';
}

/** Shot 2 — the proof of action: a night shootout on the Mile's club-row street. */
function stageAction(game) {
  setCareer(game, { cash: 3910, rep: 320, jobsDone: 3, distance: 21400, timePlayed: 2310 });
  game.missions.index = 3;
  game.tod = 0.885;
  // Dress the backdrop: the club row across the street gets its neon lit.
  dressSigns(game, 2560, 1710, [['BAR OLA', '#39e6ff'], ['NOCHE BRAVA', '#ff4fd8'], ['EL FARO ROSA', '#ffd257']]);
  // The job itself spawns the three Vesper scouts at their street spots.
  game.missions.accept(game);
  game.dialogueQueue.length = 0;
  game.dialogue = null;
  const p = game.player;
  p.x = 2380;
  p.y = 1792;
  p.giveWeapon('smg', 260);
  p.selectWeapon(2);
  p.angle = Math.atan2(1748 - p.y, 2500 - p.x);
  // A cab mid-carjack beside him, door open, driver running.
  const cab = createCar('taxa', 2296, 1856, 0.42, '#ffd257');
  cab.doorOpen = 1;
  game.extraCars.push(cab);
  game.setDanger(p.x, p.y, 380);
  runSteps(game, 40);
  // Whatever the scouts did to him, the frame we keep has him standing and hurt, not down.
  p.dead = false;
  p.hp = 76;
  p.armor = 42;
  game.screen = 'play';
  game.overKind = null;
  // Rio fires the frame we keep: a fresh burst, flash lit — quietly, so the dispatch
  // numbers below stay exactly the ones the panel prints.
  game.combat.crimeClock = 9;
  p.angle = Math.atan2(1748 - p.y, 2500 - p.x);
  game.combat.fireRay(game, p, weaponById('smg'), true);
  game.combat.fireRay(game, p, weaponById('smg'), true);
  // Interdiction has eyes on the Mile: two units close, a third rolling in.
  const u1 = game.police.spawnUnit(game);
  u1.x = p.x - 480;
  u1.y = p.y - 260;
  const u2 = game.police.spawnUnit(game);
  u2.x = p.x + 560;
  u2.y = p.y + 300;
  game.police.heat = 240;
  game.police.stars = 3;
  game.police.seen = true;
  game.police.seenAgo = 0;
  game.police.lastSeenX = p.x;
  game.police.lastSeenY = p.y;
  game.police.updateFeed(game);
  game.police.say('Dispatch: shots fired, Neon Mile. All units respond.', 'NEON MILE');
  game.police.chatterTimer = 6;
  game.camera.x = 2548;
  game.camera.y = 1752;
  game.camera.zoom = 1.58;
  game.frozen = true;
  return 'play';
}

/** Shot 3 — the map and the ledger: the whole city, the route, the career. */
function stageMap(game) {
  setCareer(game, { cash: 18450, rep: 1240, jobsDone: 11, distance: 86400, timePlayed: 7540 });
  game.stats.busts = 2;
  game.stats.wasteds = 1;
  game.garage = ['comet', 'vader', 'lux'];
  game.missions.index = 11;
  game.tod = 0.72;
  const p = game.player;
  p.x = 2205;
  p.y = 1215;
  p.angle = -Math.PI / 2;
  // Job 12 is live: the GPS route runs from the Quarter to Safehouse Brisa.
  game.missions.accept(game);
  game.dialogueQueue.length = 0;
  game.dialogue = null;
  game.police.reset();
  game.frozen = true;
  return 'map';
}

/** Shot 4 — the payoff: MISSION PASSED outside Club Solstice at dusk. */
function stagePassed(game) {
  setCareer(game, { cash: 21300, rep: 1180, jobsDone: 11, distance: 83100, timePlayed: 7280 });
  game.missions.index = 11;
  game.tod = 0.765;
  const club = game.city.poi('club');
  // The identical starter Comet would twin the hero car in frame; park it across town.
  game.starterCar.x = 1500;
  game.starterCar.y = 2500;
  const car = createCar('comet', club.x + 110, club.y + 142, -0.35, '#ffd257');
  car.underglow = '#39e6ff';
  car.doorOpen = 0.7;
  game.extraCars.push(car);
  const p = game.player;
  p.x = club.x + 54;
  p.y = club.y + 118;
  p.angle = 0.5;
  runSteps(game, 26);
  game.showBanner('MISSION PASSED', 'Grand Theft Marina', 2200, 120);
  game.banner.t = 0.7;
  game.showDialogue([{ who: 'PAZ', text: 'My garage has never looked this expensive. Neither have I.' }]);
  game.dialogue = game.dialogueQueue.shift() || null;
  if (game.dialogue) game.dialogue.timer = 99;
  game.dialogueQueue.length = 0;
  game.confettiBurst(p.x + 44, p.y - 16, 60);
  game.camera.x = club.x + 70;
  game.camera.y = club.y + 84;
  game.camera.zoom = 1.45;
  game.frozen = true;
  return 'play';
}

export function stageShot(name, game) {
  game.screen = 'play';
  game.camLock = true;
  if (name === 'action') return stageAction(game);
  if (name === 'map') return stageMap(game);
  if (name === 'passed') return stagePassed(game);
  return stageChase(game);
}
