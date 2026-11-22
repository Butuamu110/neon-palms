// NEON PALMS — structured street races + pink-slip duels: countdown, checkpoint
// rings, live position tracking against 5 AI rivals, prize tables, RESPECT payouts.
import { G, addCash, addRespect, feed, say, BOSS } from './config.js';
import { markers } from './city.js';
import { rng, rr, clamp } from './rng.js';
import { spawnCar, syncCarMesh } from './vehicles.js';
import { sfx } from './audio.js';

export const RACES = [
  { id: 'r1', name: 'STRIP SPRINT', district: 'Palms Strip', start: [-60, 246], laps: 1, entry: 100, prizes: [900, 450, 200], respect: 40,
    cps: [[60, 246], [180, 186], [186, 66], [66, 60], [-54, 120], [-60, 246]] },
  { id: 'r2', name: 'CLUB MILE DASH', district: 'Club Mile', start: [-186, 126], laps: 1, entry: 200, prizes: [1500, 700, 320], respect: 55,
    cps: [[-186, 66], [-246, -54], [-126, -60], [-66, 54], [-120, 174], [-186, 126]] },
  { id: 'r3', name: 'UNDERPASS RUN', district: 'The Underpass', start: [-294, -186], laps: 1, entry: 300, prizes: [2200, 1000, 450], respect: 70,
    cps: [[-186, -294], [-66, -186], [-174, -66], [-294, -174], [-294, -186]] },
  { id: 'r4', name: 'MARINA LOOP', district: 'Puerto Alba', start: [66, 126], laps: 1, entry: 400, prizes: [3000, 1400, 600], respect: 85,
    cps: [[186, 66], [294, 186], [186, 294], [66, 186], [66, 126]] },
  { id: 'r5', name: 'HEIGHTS CLIMB', district: 'Heights of San Verde', start: [126, -66], laps: 1, entry: 600, prizes: [4200, 2000, 900], respect: 110,
    cps: [[294, -174], [186, -294], [66, -186], [174, -66], [126, -66]] },
  { id: 'r6', name: 'MIDNIGHT GRAND PRIX', district: 'Palms Strip', start: [-60, 246], laps: 1, entry: 1000, prizes: [9000, 4000, 1800], respect: 200,
    cps: [[60, 126], [186, 66], [294, -66], [186, -186], [66, -294], [-66, -186], [-186, -66], [-294, 66], [-186, 186], [-60, 246]] },
];

export const DUEL = { rival: "Kenji 'Kingslip' Aoki", car: 'Ríos Special', start: [-240, 240], cps: [[-66, 186], [66, 126], [186, 186], [246, 294]] };

export function raceAt(x, z) {
  for (const r of RACES) { const dx = r.start[0] - x, dz = r.start[1] - z; if (dx * dx + dz * dz < 100) return r; }
  return null;
}
export function duelAt(x, z) {
  const dx = DUEL.start[0] - x, dz = DUEL.start[1] - z;
  return dx * dx + dz * dz < 100;
}

function makeRivals(cps, n, baseSpeed) {
  const rivals = [];
  for (let i = 0; i < n; i++) {
    const car = spawnCar(cps[0][0] + rr(-6, 6), cps[0][1] + rr(-6, 6), 0, 1 + (i % 4), {});
    car.top = baseSpeed + rr(-2.5, 2.5); car.accel = 20;
    rivals.push({ car, cp: 0, prog: 0, speedF: rr(0.9, 1.0), finished: false });
  }
  return rivals;
}
function rivalStep(rv, cps, dt) {
  if (rv.finished) return;
  const [tx, tz] = cps[Math.min(rv.cp, cps.length - 1)];
  const car = rv.car;
  const dx = tx - car.x, dz = tz - car.z, d = Math.hypot(dx, dz);
  const ta = Math.atan2(dx, dz);
  let da = ta - car.a; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
  car.a += clamp(da, -2.4 * dt, 2.4 * dt);
  const sp = car.top * rv.speedF * clamp(1 - Math.abs(da) * 0.4, 0.4, 1);
  car.speed += clamp(sp - car.speed, -20 * dt, 14 * dt);
  car.x += Math.sin(car.a) * car.speed * dt;
  car.z += Math.cos(car.a) * car.speed * dt;
  rv.prog = rv.cp * 1000 - d;
  if (d < 11) { rv.cp++; if (rv.cp >= cps.length) { rv.finished = true; rv.prog = 1e9 - (G.time); } }
  syncCarMesh(car);
}

export function startRace(def) {
  if (!G.player.inCar) { G.msg = 'You need a car to enter ' + def.name; G.msgUntil = G.time + 2.5; return; }
  if (G.cash < def.entry) { G.msg = `Entry fee $${def.entry} — you are short.`; G.msgUntil = G.time + 2.5; return; }
  G.cash -= def.entry;
  G.stats.racesRun++;
  G.race = {
    def, cp: 0, countdown: 3.99, started: false, elapsed: 0,
    rivals: makeRivals(def.cps, 5, G.player.inCar.top * 0.94),
    finished: false, pos: 6, lastBeep: 4,
  };
  say(BOSS, `${def.name}. Entry $${def.entry}. Prizes: 1st $${def.prizes[0]} · 2nd $${def.prizes[1]} · 3rd $${def.prizes[2]}. Hit every ring, mi vida.`, 7);
  feed(`RACE — ${def.name} grid locked: 6 cars, ${def.cps.length} checkpoints`);
}

export function startDuel() {
  if (!G.player.inCar) { G.msg = 'Pink-slip duels are car-to-car. Get wheels.'; G.msgUntil = G.time + 2.5; return; }
  G.stats.duelsRun++;
  G.duel = {
    cp: 0, countdown: 3.99, started: false, elapsed: 0,
    rival: makeRivals(DUEL.cps, 1, G.player.inCar.top * 1.0)[0],
    finished: false,
  };
  say({ name: DUEL.rival, role: 'Rival — Kingslip Crew', initials: 'KA', color: '#ff4040' },
    `Your ${G.player.inCar.modelName} against my ${DUEL.car}. Loser hands over the keys. No tears.`, 7);
  feed(`PINK-SLIP DUEL — vs ${DUEL.rival} for the ${DUEL.car}`);
}

function playerProgress(rt, cps) {
  const p = G.player;
  const [tx, tz] = cps[Math.min(rt.cp, cps.length - 1)];
  return rt.cp * 1000 - Math.hypot(tx - p.x, tz - p.z);
}

function stepEvent(rt, cps, isDuel) {
  const p = G.player;
  if (!rt.started) {
    rt.countdown -= 1 / 60;
    const c = Math.ceil(rt.countdown);
    if (c < rt.lastBeep && c > 0) { rt.lastBeep = c; sfx('beepLow'); }
    if (rt.countdown <= 0) { rt.started = true; sfx('beepGo'); feed('GO GO GO!'); }
    if (G.player.inCar) G.player.inCar.speed = 0;
    return;
  }
  rt.elapsed += 1 / 60;
  const [tx, tz] = cps[Math.min(rt.cp, cps.length - 1)];
  markers.checkpoint.visible = true;
  markers.checkpoint.position.set(tx, 7, tz);
  markers.checkpoint.rotation.y = Math.atan2(G.player.x - tx, G.player.z - tz);
  const d = Math.hypot(tx - p.x, tz - p.z);
  if (d < 10 && G.player.inCar) {
    rt.cp++; sfx('coin');
    feed(`CHECKPOINT ${rt.cp}/${cps.length}`);
    if (rt.cp >= cps.length) finishEvent(rt, isDuel);
  }
}

export function updateRaces(dt) {
  // idle markers
  if (!G.race && !G.duel && !G.mission) {
    markers.checkpoint.visible = false;
    const r = raceAt(G.player.x, G.player.z);
    if (r && G.player.inCar) { markers.race.visible = true; markers.race.position.set(r.start[0], 7, r.start[1]); }
    else if (duelAt(G.player.x, G.player.z) && G.player.inCar) { markers.duel.visible = true; markers.duel.position.set(DUEL.start[0], 7, DUEL.start[1]); markers.race.visible = false; }
    else { markers.race.visible = false; markers.duel.visible = false; }
  } else { markers.race.visible = false; markers.duel.visible = false; }

  if (G.race) {
    const rt = G.race;
    stepEvent(rt, rt.def.cps, false);
    if (!rt.finished) {
      for (const rv of rt.rivals) if (rt.started) rivalStep(rv, rt.def.cps, dt);
      const pp = playerProgress(rt, rt.def.cps);
      let pos = 1;
      for (const rv of rt.rivals) if ((rv.finished ? 1e12 : rv.prog) > pp) pos++;
      rt.pos = pos;
    }
  }
  if (G.duel) {
    const rt = G.duel;
    stepEvent(rt, DUEL.cps, true);
    if (!rt.finished && rt.started) {
      rivalStep(rt.rival, DUEL.cps, dt);
      if (rt.rival.finished && !rt.finished) finishEvent(rt, true, false);
    }
  }
}

function finishEvent(rt, isDuel, playerWon = true) {
  rt.finished = true;
  markers.checkpoint.visible = false;
  if (isDuel) {
    if (playerWon && rt.cp >= DUEL.cps.length) {
      G.stats.duelsWon++;
      addRespect(90, 'Palms Strip');
      G.msg = `PINK SLIP WON — the ${DUEL.car} is yours. Kenji walks home.`;
      say(BOSS, 'A pink slip! Park that Ríos Special at Club Válvula. The Strip just learned your name.', 7);
      feed(`DUEL WON — ${DUEL.car} transferred to you`);
      sfx('passed');
    } else {
      const loss = Math.min(800, G.cash);
      G.cash -= loss;
      G.msg = `DUEL LOST — Kenji takes $${loss} and your pride. Rechallenge at the Strip marker.`;
      feed('DUEL LOST — cash seized by Kingslip crew');
    }
    G.duel = null;
    return;
  }
  const def = rt.def, pos = rt.pos;
  const prize = pos <= 3 ? def.prizes[pos - 1] : 0;
  const repGain = pos === 1 ? def.respect : pos <= 3 ? Math.floor(def.respect * 0.6) : Math.floor(def.respect * 0.25);
  if (prize) addCash(prize);
  addRespect(repGain, def.district);
  if (pos === 1) G.stats.racesWon++;
  G.banner = {
    title: pos === 1 ? 'RACE WON' : `FINISHED ${pos}/6`,
    lines: [`${def.name} — position ${pos}/6 in ${rt.elapsed.toFixed(1)}s`, prize ? `Prize +$${prize}` : 'No prize — top 3 pays', `RESPECT +${repGain}`],
    until: G.time + 6,
  };
  say(BOSS, pos === 1 ? `${def.name} is YOURS. The crew drinks free tonight.` : `P${pos}. The ladder is climbed one rung at a time — again.`, 6);
  feed(`RACE — ${def.name}: finished ${pos}/6, +$${prize}, RESPECT +${repGain}`);
  sfx(pos === 1 ? 'passed' : 'coin');
  // clean up rival cars
  for (const rv of rt.rivals) { const i = G.cars.indexOf(rv.car); if (i >= 0) G.cars.splice(i, 1); rv.car.mesh.visible = false; }
  G.race = null;
}
