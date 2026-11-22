// NEON PALMS — San Verde PD Interdiction: named units with roles, pursuit/ramming/
// roadblock behaviour, dispatch feed, and the CONDOR air unit at 4+ stars.
import { G, feed } from './config.js';
import { scene } from './city.js';
import { rng, rr, clamp } from './rng.js';
import { spawnCar, syncCarMesh, damageCar } from './vehicles.js';
import { spawnPed } from './pedestrians.js';

export const UNIT_POOL = [
  { call: 'VIPER-3', role: 'PURSUIT' }, { call: 'VIPER-7', role: 'PURSUIT' },
  { call: 'MAMBA-2', role: 'RAMMING' }, { call: 'COBRA-5', role: 'RAMMING' },
  { call: 'GECKO-9', role: 'ROADBLOCK' }, { call: 'GECKO-4', role: 'ROADBLOCK' },
  { call: 'ANACONDA-1', role: 'SPOTLIGHT' }, { call: 'PYTHON-6', role: 'FIRING' },
];
let unitSeq = 0;

export function commitCrime(stars, label) {
  const before = G.wanted;
  G.wanted = clamp(Math.max(G.wanted, stars), 0, 5);
  G.sight = 'IN SIGHT'; G.sightTimer = 9; G.heatTimer = 14;
  if (G.wanted > before) feed(`DISPATCH — ${label}: wanted level ${G.wanted}★, all Interdiction units respond`);
}

export function clearCrime() {
  if (G.wanted > 0) feed('DISPATCH — suspect lost, Interdiction standing down');
  G.wanted = 0; G.sight = 'SEARCHING';
  for (const c of G.cops) { c.giveUp = true; }
}

function spawnUnit() {
  const spec = UNIT_POOL[unitSeq % UNIT_POOL.length]; unitSeq++;
  const px = G.player.x, pz = G.player.z;
  const ang = rr(0, Math.PI * 2), d = rr(55, 80);
  const x = clamp(px + Math.sin(ang) * d, -320, 320), z = clamp(pz + Math.cos(ang) * d, -320, 320);
  const car = spawnCar(x, z, ang, 4, { cop: true });
  car.top = 46; car.accel = 22; car.condition = 100;
  const unit = { call: spec.call, role: spec.role, car, officer: null, giveUp: false, ramCd: rr(1, 3), blockSet: false };
  car.copUnit = unit;
  G.cops.push(unit);
  feed(`DISPATCH — ${unit.call} (${unit.role}) joining pursuit`);
  return unit;
}

function despawnUnit(unit) {
  const i = G.cars.indexOf(unit.car); if (i >= 0) G.cars.splice(i, 1);
  scene.remove(unit.car.mesh);
  const j = G.cops.indexOf(unit); if (j >= 0) G.cops.splice(j, 1);
}

export function updatePolice(dt) {
  const px = G.player.x, pz = G.player.z;
  // wanted bookkeeping: sight decays when no cop is close
  const nearest = nearestCopDist();
  if (G.wanted > 0) {
    if (nearest < 55 || G.eyesOut > 0 && nearest < 90) { G.sight = 'IN SIGHT'; G.sightTimer = 9; }
    else {
      G.sight = 'SEARCHING';
      G.sightTimer -= dt;
      if (G.sightTimer <= 0) {
        G.wanted -= 1; G.sightTimer = 9;
        feed(`DISPATCH — search cooling, wanted now ${G.wanted}★`);
        if (G.wanted <= 0) clearCrime();
      }
    }
  }
  const want = [0, 1, 2, 3, 4, 5][G.wanted] || 0;
  const targetCount = G.wanted === 0 ? 0 : Math.min(2 + G.wanted, 6);
  if (G.cops.length < targetCount && G.wanted > 0 && (G.spawnCd = (G.spawnCd || 0) - dt) <= 0) {
    spawnUnit(); G.spawnCd = 2.2;
  }
  void want;
  for (let i = G.cops.length - 1; i >= 0; i--) {
    const u = G.cops[i], car = u.car;
    const dx = px - car.x, dz = pz - car.z, d = Math.hypot(dx, dz);
    if (u.giveUp || car.dead || d > 260) {
      car.speed -= car.speed * dt * 2; syncCarMesh(car);
      if (u.giveUp && d > 60 || d > 260 || car.dead) { despawnUnit(u); continue; }
      continue;
    }
    let tx = px, tz = pz, desired = car.top;
    if (u.role === 'ROADBLOCK') {
      // park across the road ahead of the player once, then hold
      const pa = G.player.inCar ? G.player.inCar.a : G.player.a;
      tx = px + Math.sin(pa) * 42; tz = pz + Math.cos(pa) * 42;
      if (d < 70 && !u.blockSet) { /* keep driving to point */ }
      if (Math.hypot(tx - car.x, tz - car.z) < 5) { desired = 0; u.blockSet = true; }
    } else if (u.role === 'SPOTLIGHT') {
      tx = px + 16; tz = pz + 10; desired = 30;
    } else if (u.role === 'RAMMING') {
      u.ramCd -= dt;
      if (u.ramCd <= 0 && d < 14 && G.player.inCar) {
        G.player.inCar.speed *= 0.55; damageCar(G.player.inCar, 4);
        G.camShake = 0.5; u.ramCd = 3.2; feed(`${u.call} — PIT contact on suspect vehicle`);
      }
    }
    const ta = Math.atan2(tx - car.x, tz - car.z);
    let da = ta - car.a;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    car.steer = clamp(da * 1.6, -1, 1);
    car.a += car.steer * dt * 1.5 * clamp(Math.abs(car.speed) / 8 + 0.3, 0, 1) * Math.sign(car.speed || 1);
    const slowForTurn = clamp(1 - Math.abs(da) * 0.45, 0.35, 1);
    const catchUp = d > 60 ? 1.18 : 1;
    car.speed += clamp(desired * slowForTurn * catchUp - car.speed, -30 * dt, car.accel * dt);
    car.x += Math.sin(car.a) * car.speed * dt;
    car.z += Math.cos(car.a) * car.speed * dt;
    car.x = clamp(car.x, -330, 330); car.z = clamp(car.z, -330, 330);
    // bump the player car
    if (G.player.inCar) {
      const pc = G.player.inCar, bx = pc.x - car.x, bz = pc.z - car.z, bd = Math.hypot(bx, bz);
      if (bd < 4 && bd > 0.01) { pc.x += (bx / bd) * 0.4; pc.z += (bz / bd) * 0.4; pc.speed *= 0.9; }
    }
    const bar = car.mesh.getObjectByName('lightbar');
    if (bar) bar.material.color.setHex(Math.floor(G.time * 5) % 2 ? 0xff2040 : 0x2266ff);
    syncCarMesh(car);
    u.dist = Math.round(d);
  }
  updateHeli(dt, px, pz);
}

export function nearestCopDist() {
  let d = 1e9;
  for (const u of G.cops) { const dd = Math.hypot(u.car.x - G.player.x, u.car.z - G.player.z); if (dd < d) d = dd; }
  return d;
}

// CONDOR air unit: helicopter + spotlight cone at 4+ stars.
function updateHeli(dt, px, pz) {
  if (G.wanted >= 4) {
    if (!G.heli) {
      const grp = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 6.4), new THREE.MeshStandardMaterial({ color: 0x181824, roughness: 0.4, metalness: 0.5 }));
      grp.add(body);
      const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.7), new THREE.MeshBasicMaterial({ color: 0x333340 }));
      rotor.position.y = 1.1; rotor.name = 'rotor'; grp.add(rotor);
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(7.5, 34, 20, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
      );
      cone.position.y = -17.5; cone.name = 'cone'; grp.add(cone);
      const spot = new THREE.SpotLight(0xfff2b0, 2.4, 90, 0.32, 0.5);
      spot.position.y = -1; grp.add(spot); grp.add(spot.target); spot.target.position.y = -34;
      scene.add(grp);
      G.heli = { mesh: grp, x: px, z: pz - 30 };
      feed('DISPATCH — CONDOR air unit overhead, spotlight live');
    }
    const h = G.heli;
    h.x += (px - h.x) * dt * 0.7; h.z += (pz - 14 - h.z) * dt * 0.7;
    h.mesh.position.set(h.x, 30 + Math.sin(G.time * 1.3) * 1.2, h.z);
    h.mesh.rotation.y = Math.atan2(px - h.x, pz - h.z);
    const rotor = h.mesh.getObjectByName('rotor');
    if (rotor) rotor.rotation.y = G.time * 28;
    G.sight = 'IN SIGHT'; G.sightTimer = Math.max(G.sightTimer, 4);
  } else if (G.heli) {
    scene.remove(G.heli.mesh); G.heli = null;
    feed('DISPATCH — CONDOR returning to base');
  }
}

export function copShooters() {
  // officers on foot appear when their car is wrecked — handled in combat via peds; here: none.
  return [];
}
export { spawnPed };
