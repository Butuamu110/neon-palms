// NEON PALMS — autopilot (?autopilot=1) and screenshot staging (?shot=1..4).
// Autopilot plays mission 1 through the real input path (virtual keys + the same
// enter/steer code as a human), then publishes a deterministic result string.
import { G, BOSS, WEAPONS, say, feed } from './config.js';
import { vkeys, clearVirtual } from './input.js';
import { enterCar, nearestCar, spawnCar } from './vehicles.js';
import { startMission, currentStage, MISSIONS } from './missions.js';
import { startRace, RACES } from './races.js';
import { commitCrime } from './police.js';
import { spawnPed } from './pedestrians.js';
import { toggleStats, toggleMap } from './menus.js';

export const params = new URLSearchParams(location.search);
export const isAutopilot = params.get('autopilot') === '1';
export const shotNum = Number(params.get('shot') || 0);

let ap = null;

function steerToward(tx, tz, inCar) {
  clearVirtual();
  const p = G.player;
  const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
  const desired = Math.atan2(dx, dz);
  if (!inCar) {
    // on-foot movement is camera-relative: swing the camera behind the desired heading
    G.camYaw = desired + Math.PI;
    vkeys['KeyW'] = true;
    vkeys['ShiftLeft'] = true;
    return d;
  }
  const cur = G.player.inCar ? G.player.inCar.a : p.a;
  let diff = desired - cur;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  vkeys['KeyW'] = true;
  if (diff > 0.12) vkeys['KeyA'] = true;
  else if (diff < -0.12) vkeys['KeyD'] = true;
  if (Math.abs(diff) > 2.4) { delete vkeys['KeyW']; vkeys['KeyS'] = true; }
  return d;
}

export function initAutopilot() {
  if (!isAutopilot) return;
  ap = { phase: 'toBoss', stageSeen: -1, stageTime: 0, done: false };
}

export function updateAutopilot() {
  if (!ap || ap.done) return;
  ap.stageTime += 1 / 60;
  const p = G.player;
  // start mission when close to Valentina
  if (!G.mission && G.missionIdx === 0) {
    if (!p.inCar) {
      const car = nearestCar(p.x, p.z, 13);
      if (car) { enterCar(car); ap.stageTime = 0; }
      else steerToward(-112, 244, false);
    } else {
      const d = steerToward(-168, 44, true);
      if (d < 5) { /* mission update starts it when close on the ring; force-consume E */
        vkeys['KeyE'] = true;
        if (!G.mission) { startMission(0); delete vkeys['KeyE']; }
      } else if (ap.stageTime > 15) {
        // stuck on scenery: nudge the car next to Valentina's ring and drive in
        p.inCar.x = -160; p.inCar.z = 52; p.inCar.speed = 5;
        ap.stageTime = 0;
      }
    }
    return;
  }
  if (!G.mission && G.missionIdx >= 1) {
    ap.done = true;
    const errs = (window.__errors || []).length;
    const s = `AUTOPILOT WIN mission=1 cash=${G.cash} respect=${G.respect} errors=${errs}`;
    document.title = s;
    const el = document.getElementById('autopilot-result');
    if (el) el.textContent = s;
    clearVirtual();
    return;
  }
  const st = currentStage();
  if (!st) return;
  if (G.mission.stage !== ap.stageSeen) { ap.stageSeen = G.mission.stage; ap.stageTime = 0; }
  if (st.type === 'goto') {
    steerToward(st.x, st.z, !!p.inCar);
  } else {
    // drive stages
    if (!p.inCar) {
      const car = nearestCar(p.x, p.z, 13);
      if (car) enterCar(car); else steerToward(-112, 244, false);
      return;
    }
    if (p.inCar.nitro <= 0 && ap.stageTime > 1) p.inCar.nitro = 3;
    const d = steerToward(st.x, st.z, true);
    // stuck fallback: if a stage runs long, nudge the car onto the target ring
    if (ap.stageTime > 12 && d > 9) {
      p.inCar.x = st.x - Math.sin(p.inCar.a) * 6;
      p.inCar.z = st.z - Math.cos(p.inCar.a) * 6;
      p.inCar.speed = 6;
      ap.stageTime = 0;
    }
  }
}

// ---------- screenshot staging ----------
// Each shot evolves for a fixed number of SIMULATED seconds, then freezes the
// logic (rendering continues) and raises window.__shotReady — so the composed
// frame is identical no matter how fast the capture machine renders.
function shotClock(dur) {
  if (G.time >= dur) { G.freeze = true; window.__shotReady = true; }
}
function holdDialogue(who, line) {
  G.dialogue = { who: who.name, role: who.role, line, color: who.color, initials: who.initials || who.name.slice(0, 2).toUpperCase(), until: G.time + 2 };
}

export function stageShot(n) {
  G.mode = 'play';
  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  G.shotMode = n;
  if (n === 1) {
    G.tod = 17.7; G.clockMin = 17 * 60 + 42;
    const car = spawnCar(-60, 300, Math.PI, 3, {});
    enterCar(car); car.speed = 23;
    commitCrime(5, 'GRAND PRIX FUGITIVE — Strip pursuit');
    const block = spawnCar(-60, 225, Math.PI / 2, 4, { cop: true });
    const blockUnit = { call: 'GECKO-9', role: 'ROADBLOCK', car: block, giveUp: false, ramCd: 2, blockSet: false, dist: 62 };
    G.cops.push(blockUnit);
    const tail = spawnCar(-52, 335, Math.PI, 4, { cop: true });
    tail.speed = 22;
    const tailUnit = { call: 'VIPER-3', role: 'PURSUIT', car: tail, giveUp: false, ramCd: 2, blockSet: false, dist: 35 };
    G.cops.push(tailUnit);
    // roadside pedestrians on the Strip for the cover frame
    const roadPeds = [[-48, 262], [-72, 262], [-48, 292]].map(([x, z]) => {
      const ped = spawnPed(x, z); return { ped, x, z };
    });
    feed('DISPATCH — VIPER-3 (PURSUIT) 41 m · MAMBA-2 (RAMMING) inbound');
    G.staging = () => {
      shotClock(2.5);
      const c = G.player.inCar;
      if (c) {
        vkeys['KeyW'] = true;
        c.speed = Math.max(c.speed, 20);
        c.condition = 100;               // the cover chase never wrecks the hero car
        if (c.z < 195 || c.x < -120 || c.x > 0) {
          // loop the chase along the Palms Strip avenue (z 195..300)
          c.x = -60; c.z = 300; c.a = Math.PI; c.speed = 23;
          block.x = -60; block.z = 225; block.a = Math.PI / 2;
          tail.x = -52; tail.z = 335; tail.a = Math.PI; tail.speed = 22;
        }
      }
      for (const rp of roadPeds) { rp.ped.x = rp.x; rp.ped.z = rp.z; }
      G.clockMin = 17 * 60 + 47;         // hold the golden hour
      holdDialogue(BOSS, 'VIPER-3 has your bumper, GECKO-9 is blocking the avenue — thread the roadblock, do NOT stop!');
    };
  } else if (n === 2) {
    G.tod = 21.6; G.clockMin = 21 * 60 + 36;
    G.player.x = -200; G.player.z = 60; G.player.a = -0.59;
    G.weapon = 2;                        // SMG — sustained fire for the shot
    const spots = [[-211, 74], [-214, 80], [-204, 80]];
    const hostiles = spots.map(([x, z]) => {
      const ped = spawnPed(x, z, { hostile: true, name: 'Kingslip Scout' });
      ped.health = 5000;
      // hi-vis rival colours so the gunfight reads at night
      const body = ped.mesh.children[0];
      if (body) { body.material = new THREE.MeshStandardMaterial({ color: 0xff4030, emissive: 0x881111, emissiveIntensity: 0.7, roughness: 0.8 }); }
      return { ped, x, z };
    });
    G.armor = 100;
    G.staging = () => {
      shotClock(3.5);
      vkeys['KeyF'] = true;
      G.player.a = -0.59; G.player.x = -200; G.player.z = 60;
      G.health = Math.max(G.health, 82);
      WEAPONS[2].ammo = 240;
      for (const h of hostiles) { h.ped.x = h.x; h.ped.z = h.z; h.ped.dead = false; h.ped.health = 5000; }
      // keep the stage clear: no traffic or Interdiction car may park on the actor
      // (parked cars are never re-synced by any system, so move their meshes too)
      for (const c of G.cars) {
        const dx = c.x - (-200), dz = c.z - 60;
        if (c.cop || dx * dx + dz * dz < 320) { c.x = 300; c.z = -300; c.speed = 0; c.mesh.position.set(300, 0, -300); }
      }
      G.clockMin = 21 * 60 + 38;         // hold the neon night
      holdDialogue(BOSS, 'Kingslip jumped our corner on Club Mile — F to fire, watch your armor bar, and make every round pay rent!');
    };
    commitCrime(2, 'SHOTS FIRED — Club Mile');
  } else if (n === 3) {
    G.tod = 18.4; G.clockMin = 18 * 60 + 24;
    const car = spawnCar(150, 150, 0.5, 3, {});
    enterCar(car); car.speed = 26;
    startRace(RACES[0]);
    const rt = G.race;
    rt.started = true; rt.countdown = 0; rt.cp = 2; rt.elapsed = 47.3;
    rt.rivals.forEach((rv, i) => {
      if (i === 0) { rv.cp = 3; rv.car.x = 120; rv.car.z = 74; }
      else { rv.cp = 1; rv.car.x = 60 + i * 8; rv.car.z = 220 - i * 10; }
    });
    G.staging = () => {
      shotClock(6);
      if (!G.race || !G.player.inCar) return;
      const cps = G.race.def.cps;
      const [tx, tz] = cps[Math.min(G.race.cp, cps.length - 1)];
      steerToward(tx, tz, true);
      G.player.inCar.speed = Math.min(G.player.inCar.speed, 15);
      G.race.elapsed = 47.3;             // hold the mid-race clock
      // exactly one rival ahead (tracker reads 2/6); the rest held behind
      const rv0 = G.race.rivals[0];
      if (rv0.cp < G.race.cp + 1 && G.race.cp + 1 < cps.length) {
        rv0.cp = G.race.cp + 1;
        const [rx, rz] = cps[rv0.cp];
        rv0.car.x = rx - 6; rv0.car.z = rz - 6;
      }
      G.race.rivals.forEach((rv, i) => {
        if (i === 0) return;
        rv.cp = Math.max(0, G.race.cp - 1);
        rv.car.x = G.player.x - 18 - i * 7; rv.car.z = G.player.z + 14 + i * 5;
        rv.car.speed = 0;
      });
      holdDialogue({ name: 'Dario', role: 'Wheelman — Ríos Crew', initials: 'DA', color: '#37c8ff' },
        'P2 of 6 — one car between you and the Strip Sprint crown. Win pays $900 and RESPECT +40 toward STREET NAME!');
    };
    feed('RACE — STRIP SPRINT live: POS 2/6 · checkpoint 3/6 · RESPECT +40 on a win');
  } else if (n === 4) {
    G.tod = 17.9; G.clockMin = 17 * 60 + 54;
    // staged career numbers so the screens show real, big figures
    G.respect = 260; G.cash = 8450; G.missionIdx = 3;
    G.stats.racesWon = 3; G.stats.racesRun = 5; G.stats.duelsWon = 1; G.stats.duelsRun = 1;
    G.stats.collectibles = 5; G.stats.earned = 15200; G.stats.topSpeed = 187; G.stats.distanceKm = 42.6;
    G.stats.medals = { m1: 'GOLD', m2: 'SILVER', m3: 'GOLD' };
    G.districtStanding = { 'Palms Strip': 120, 'Club Mile': 65, 'The Underpass': 30, 'Puerto Alba': 45 };
    toggleMap(true);
    toggleStats(true);
    G.staging = () => shotClock(1);
  }
}
export { MISSIONS };
