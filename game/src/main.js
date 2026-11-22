// NEON PALMS — entry point: boot, fixed-timestep loop, player on-foot controller,
// camera work, contextual E interactions, crew/radio/weapon keys, collectibles.
import { G, WEAPONS, RADIO, feed, say, BOSS, districtAt } from './config.js';
import { clamp } from './rng.js';
import { initInput, onPress, down, axis } from './input.js';
import { initAudio, updateAudio, sfx } from './audio.js';
import { initCity, renderer, scene, camera, updateSky, pushOut } from './city.js';
import { makePedMesh } from './pedestrians.js';
import { initTraffic, updateTraffic } from './traffic.js';
import { initPeds, updatePeds, witnessCrime } from './pedestrians.js';
import { spawnParkedCars, updatePlayerCar, nearestCar, enterCar, exitCar, syncCarMesh } from './vehicles.js';
import { updatePolice, commitCrime } from './police.js';
import { initCombat, updateCombat } from './combat.js';
import { updateRaces, raceAt, duelAt, startRace, startDuel } from './races.js';
import { updateMissions } from './missions.js';
import { buildHUD, updateHUD, useCrew } from './hud.js';
import { drawMinimap, drawFullMap } from './minimap.js';
import { buildMenus, toggleMap, toggleStats, saveGame, applySave } from './menus.js';
import { isAutopilot, shotNum, initAutopilot, updateAutopilot, stageShot } from './autopilot.js';

const params = new URLSearchParams(location.search);

function initPlayerMesh() {
  const grp = makePedMesh(0xff2e88);
  G.player.mesh = grp;
  grp.position.set(G.player.x, 0, G.player.z);
}

function updateOnFoot(dt, ax) {
  const p = G.player;
  const sp = ax.sprint ? 6.4 : 3.6;
  let mx = 0, mz = 0;
  if (ax.fwd) mz += 1; if (ax.back) mz -= 1;
  if (ax.left) mx -= 1; if (ax.right) mx += 1;
  if (mx || mz) {
    const camA = G.camYaw;
    const sin = Math.sin(camA), cos = Math.cos(camA);
    const wx = mx * cos - mz * sin, wz = -mx * sin - mz * cos;
    // note: forward on screen is away from camera (camYaw behind player)
    const fx = -sin, fz = -cos;
    const dx = fx * mz + cos * mx, dz = fz * mz + (-sin) * mx;
    void wx; void wz;
    const len = Math.hypot(dx, dz) || 1;
    p.a = Math.atan2(dx / len, dz / len);
    p.x += (dx / len) * sp * dt;
    p.z += (dz / len) * sp * dt;
    p.walkPhase += dt * sp * 2.4;
    G.stats.distanceKm += sp * dt / 1000 / 3;
  }
  p.x = clamp(p.x, -332, 332); p.z = clamp(p.z, -332, 332);
  const pp = { x: p.x, z: p.z }; pushOut(pp, 0.6); p.x = pp.x; p.z = pp.z;
  if (p.mesh) {
    p.mesh.position.set(p.x, Math.abs(Math.sin(p.walkPhase)) * 0.06, p.z);
    p.mesh.rotation.y = p.a;
  }
}

function updateCamera(dt) {
  const p = G.player;
  const car = p.inCar;
  const tx = car ? car.x : p.x, tz = car ? car.z : p.z;
  const ta = car ? car.a : p.a;
  if (G.shotMode === 1 && car) {
    // LOW CLOSE chase cam — hero car fills the frame
    const bx = tx - Math.sin(ta) * 7.2, bz = tz - Math.cos(ta) * 7.2;
    camera.position.set(bx, 2.1, bz);
    camera.lookAt(tx + Math.sin(ta) * 10, 1.4, tz + Math.cos(ta) * 10);
    return;
  }
  if (G.shotMode === 2) {
    // over-shoulder cam behind the player, looking where they aim
    const fx = Math.sin(p.a), fz = Math.cos(p.a);
    camera.position.set(tx - fx * 7.5 + fz * 1.6, 2.7, tz - fz * 7.5 - fx * 1.6);
    camera.lookAt(tx + fx * 9, 1.3, tz + fz * 9);
    return;
  }
  // smooth follow cam; yaw eases behind the player/car heading
  const desiredYaw = ta + Math.PI;
  if (G.camYaw === undefined) G.camYaw = desiredYaw;
  let dy = desiredYaw - G.camYaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  G.camYaw += dy * Math.min(1, dt * (car ? 3.2 : 5));
  const dist = car ? 10.5 : 7.5, height = car ? 4.2 : 3.1;
  const cx = tx + Math.sin(G.camYaw) * dist, cz = tz + Math.cos(G.camYaw) * dist;
  const shake = G.camShake;
  camera.position.set(
    cx + (Math.sin(G.time * 47) * shake * 0.5),
    height + shake * 0.3,
    cz + (Math.cos(G.time * 39) * shake * 0.5)
  );
  camera.lookAt(tx, 1.5, tz);
  G.camShake = Math.max(0, G.camShake - dt * 1.8);
}

function interactions() {
  G.prompt = G.prompt && G.missionPromptLock ? G.prompt : G.prompt;
  const p = G.player;
  if (p.inCar) {
    const r = raceAt(p.x, p.z);
    const d = duelAt(p.x, p.z);
    if (!G.race && !G.duel && !G.mission) {
      if (r) G.prompt = `E — ENTER ${r.name} (fee $${r.entry} · 1st $${r.prizes[0]})`;
      else if (d) G.prompt = 'E — PINK-SLIP DUEL vs KENJI (winner takes the car)';
    }
    if (G.consumeE) {
      if (!G.race && !G.duel && !G.mission && r) startRace(r);
      else if (!G.race && !G.duel && !G.mission && d) startDuel();
      else exitCar();
    }
    return;
  }
  const car = nearestCar(p.x, p.z, 6);
  if (car) {
    G.prompt = car.parked ? `E — STEAL the ${car.modelName}` : `E — ENTER the ${car.modelName}`;
    if (G.consumeE) {
      const wasParked = car.parked;
      enterCar(car);
      if (wasParked) {
        G.stats.carsStolen++;
        if (witnessCrime('GRAND THEFT AUTO', p.x, p.z)) commitCrime(1, 'GRAND THEFT AUTO');
        else feed('STEAL — no witnesses… this time');
      }
    }
  }
}

function step(dt) {
  if (G.freeze) return;   // staged screenshot holds its composed frame
  G.time += dt;
  // game clock: 1 real second = 1 game minute
  G.clockMin += dt * 1;
  if (G.clockMin >= 1440) G.clockMin -= 1440;
  G.tod = G.clockMin / 60;
  for (let i = 0; i < 3; i++) G.crewCd[i] = Math.max(0, G.crewCd[i] - dt);
  if (G.eyesOut > 0) G.eyesOut -= dt;
  if (G.radioTimer !== undefined) {
    G.radioTimer -= dt;
    if (G.radioTimer <= 0) { G.radioTimer = 24; G.radioTrack++; }
  }
  if (G.addRespectOnce) { G.addRespectOnce = false; }

  const ax = axis();
  if (G.mode === 'play' && !G.mapOpen && !G.statsOpen) {
    if (G.staging) G.staging();
    if (isAutopilot) updateAutopilot();
    if (G.player.inCar) updatePlayerCar(dt, ax);
    else updateOnFoot(dt, ax);
    const eDown = down('KeyE');
    G.consumeE = eDown && !G._ePrev;   // E is edge-triggered: one press, one action
    G._ePrev = eDown;
    interactions();
    updateMissions(dt);
    // mission module sets its own prompt for Valentina; don't let it be cleared
    updateTraffic(dt);
    updatePeds(dt);
    updatePolice(dt);
    updateCombat(dt);
    updateRaces(dt);
    // collectibles
    for (const c of G.collectibles) {
      if (c.got) continue;
      c.mesh.rotation.y = G.time * 2;
      const dx = c.x - G.player.x, dz = c.z - G.player.z;
      if (dx * dx + dz * dz < 9) {
        c.got = true; c.mesh.visible = false;
        G.stats.collectibles++;
        sfx('coin');
        feed(`NEON PALM FOUND — ${G.stats.collectibles}/12 hidden palms`);
        if (G.stats.collectibles === 12) { G.banner = { title: 'ALL 12 NEON PALMS', lines: ['The full set glows for the Ríos crew'], until: G.time + 5 }; }
      }
    }
    // autosave on mission pass is handled by stats delta check
    if (G.stats.missionsDone !== (G._lastSavedMissions || 0)) {
      G._lastSavedMissions = G.stats.missionsDone;
      saveGame(G.saveSlot);
    }
  }
}

function boot() {
  window.__G = G; // debug / verification handle
  window.__NP = { get scene() { return scene; }, get camera() { return camera; } };
  initInput();
  initCity();
  initPlayerMesh();
  spawnParkedCars();
  initTraffic();
  initPeds();
  initCombat();
  buildHUD();
  buildMenus();
  initAutopilot();
  G.radioTimer = 24;
  G.camYaw = Math.PI;
  feed('RÍOS CREW — welcome to San Verde, rookie');
  feed('DISPATCH — Interdiction patrols normal');

  onPress((code) => {
    initAudio();
    if (G.mode === 'title' && (code === 'Enter' || code === 'Space')) {
      document.getElementById('btn-start')?.click();
      return;
    }
    if (code === 'KeyM') toggleMap();
    else if (code === 'KeyP' || code === 'Escape') { if (G.mapOpen) toggleMap(false); else toggleStats(); }
    else if (code === 'KeyR') {
      G.radio = (G.radio + 1) % RADIO.length; G.radioTrack = 0; G.radioTimer = 24; sfx('ui');
      feed(`RADIO — ${RADIO[G.radio].name}`);
    } else if (code === 'KeyZ') useCrew(0);
    else if (code === 'KeyX') useCrew(1);
    else if (code === 'KeyC') useCrew(2);
    else if (code.startsWith('Digit')) {
      const n = Number(code.slice(5)) - 1;
      if (WEAPONS[n]) {
        if (WEAPONS[n].locked) {
          if (G.cash >= WEAPONS[n].price) { G.cash -= WEAPONS[n].price; WEAPONS[n].locked = false; feed(`AMMU-NATION — ${WEAPONS[n].name} purchased`); sfx('coin'); }
          else { G.msg = `${WEAPONS[n].name} costs $${WEAPONS[n].price} — locked`; G.msgUntil = G.time + 2; }
        } else { G.weapon = n; sfx('ui'); }
      }
    } else if (code === 'KeyL') {
      G._loadArm = true;
      G.msg = 'LOAD SAVE — press 1, 2 or 3'; G.msgUntil = G.time + 3;
    }
  });
  // save-slot loading takes priority over weapon digits right after L
  onPress((code) => {
    if (G._loadArm && code.startsWith('Digit')) {
      const n = Number(code.slice(5));
      if (n >= 1 && n <= 3) applySave(n);
      G._loadArm = false;
    }
  });

  if (isAutopilot) {
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    G.mode = 'play';
  }
  if (shotNum >= 1 && shotNum <= 4) stageShot(shotNum);
  if (params.get('play') === '1') {
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    G.mode = 'play';
  }

  let last = performance.now(), acc = 0;
  const DT = 1 / 60;
  function frame(now) {
    requestAnimationFrame(frame);
    let elapsed = (now - last) / 1000;
    last = now;
    // verification modes (autopilot / staged shots) burn through logic steps as fast
    // as the renderer allows, so a slow software rasteriser cannot stall the sim.
    const FAST = isAutopilot || shotNum > 0;
    const maxSteps = FAST ? 900 : 16;
    if (elapsed > (FAST ? 10 : 0.34)) elapsed = FAST ? 10 : 0.34;
    acc += elapsed;
    let n = 0;
    while (acc >= DT && n < maxSteps) { step(DT); acc -= DT; n++; }
    if (n === maxSteps) acc = 0;
    // presentation updates run once per rendered frame, not per logic step
    updateSky();
    updateCamera(Math.min(elapsed, 0.05));
    updateAudio(elapsed);
    updateHUD();
    drawMinimap();
    if (G.mapOpen) drawFullMap();
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}

boot();
export { say, BOSS, districtAt };
