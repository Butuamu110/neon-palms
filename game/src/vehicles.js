// NEON PALMS — vehicle factory + player driving physics + enter/steal logic.
import { G, CAR_MODELS, feed } from './config.js';
import { scene, pushOut } from './city.js';
import { rr, clamp } from './rng.js';
import { down } from './input.js';
import { sfx } from './audio.js';

let carGeo, cabinGeo, wheelGeo, wheelMat, glassMat, lightMatF, lightMatR;

export function makeCarMesh(color, isCop = false) {
  if (!carGeo) {
    carGeo = new THREE.BoxGeometry(2.0, 0.62, 4.3);
    cabinGeo = new THREE.BoxGeometry(1.7, 0.55, 2.1);
    wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10); wheelGeo.rotateZ(Math.PI / 2);
    wheelMat = new THREE.MeshStandardMaterial({ color: 0x111116, roughness: 0.9 });
    glassMat = new THREE.MeshStandardMaterial({ color: 0x1a2436, roughness: 0.2, metalness: 0.6 });
    lightMatF = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
    lightMatR = new THREE.MeshBasicMaterial({ color: 0xff3040 });
  }
  const grp = new THREE.Group();
  const body = new THREE.Mesh(carGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 }));
  body.position.y = 0.55; body.castShadow = true; grp.add(body);
  const cabin = new THREE.Mesh(cabinGeo, glassMat); cabin.position.set(0, 1.08, -0.2); grp.add(cabin);
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat); w.position.set(wx, 0.36, wz); grp.add(w);
  }
  const lf = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.06), lightMatF); lf.position.set(-0.6, 0.62, 2.16); grp.add(lf);
  const rf = lf.clone(); rf.position.x = 0.6; grp.add(rf);
  const lr = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.06), lightMatR); lr.position.set(-0.6, 0.62, -2.16); grp.add(lr);
  const rr2 = lr.clone(); rr2.position.x = 0.6; grp.add(rr2);
  if (isCop) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2040 }));
    bar.position.set(0, 1.45, -0.2); bar.name = 'lightbar'; grp.add(bar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.2, 4.34), new THREE.MeshBasicMaterial({ color: 0x1a3a8f }));
    stripe.position.y = 0.72; grp.add(stripe);
  }
  scene.add(grp);
  return grp;
}

export function spawnCar(x, z, a, modelIdx, opts = {}) {
  const model = CAR_MODELS[modelIdx % CAR_MODELS.length];
  const car = {
    x, z, a, speed: 0, steer: 0, model: modelIdx, modelName: model.name,
    top: model.top, accel: model.accel, color: model.color,
    condition: 100, nitro: 0, mesh: makeCarMesh(model.color, opts.cop),
    traffic: !!opts.traffic, cop: !!opts.cop, parked: !!opts.parked,
    ai: null, dead: false, honk: 0,
  };
  car.mesh.position.set(x, 0, z); car.mesh.rotation.y = a;
  G.cars.push(car);
  return car;
}

export function syncCarMesh(car) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.a;
  car.mesh.rotation.z = -car.steer * 0.04;
}

export function damageCar(car, n) {
  car.condition = clamp(car.condition - n, 0, 100);
  if (car.condition <= 0 && !car.dead) { car.dead = true; car.top = 6; }
}

// Player driving: arcade physics with nitro, handbrake, building collision.
export function updatePlayerCar(dt, ax) {
  const car = G.player.inCar;
  if (!car) return;
  const nitroBoost = car.nitro > 0 ? 1.55 : 1;
  if (ax.fwd) car.speed += car.accel * nitroBoost * dt;
  else if (ax.back) car.speed -= (car.speed > 0.5 ? 22 : car.accel * 0.55) * dt;
  else car.speed -= car.speed * 0.55 * dt;
  if (ax.brake) car.speed -= car.speed * 2.4 * dt;
  if (car.nitro > 0) car.nitro = Math.max(0, car.nitro - dt);
  const maxF = car.top * (car.condition < 25 ? 0.55 : 1) * nitroBoost;
  car.speed = clamp(car.speed, -car.top * 0.36, maxF);
  const steerTarget = (ax.left ? 1 : 0) - (ax.right ? 1 : 0);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 7);
  if (Math.abs(car.speed) > 0.2) car.a += car.steer * dt * 1.65 * Math.sign(car.speed) * clamp(Math.abs(car.speed) / 9, 0.25, 1);
  const ox = car.x, oz = car.z;
  car.x += Math.sin(car.a) * car.speed * dt;
  car.z += Math.cos(car.a) * car.speed * dt;
  car.x = clamp(car.x, -332, 332); car.z = clamp(car.z, -332, 332);
  const before = { x: car.x, z: car.z };
  pushOut(before, 2.1);
  if (before.x !== car.x || before.z !== car.z) {
    if (Math.abs(car.speed) > 12) { damageCar(car, 5); G.camShake = Math.min(0.7, Math.abs(car.speed) * 0.012); }
    car.speed *= -0.25; car.x = before.x; car.z = before.z;
  }
  // car-to-car bumps
  for (const o of G.cars) {
    if (o === car) continue;
    const dx = o.x - car.x, dz = o.z - car.z, d2 = dx * dx + dz * dz;
    if (d2 < 16 && d2 > 0.01) {
      const d = Math.sqrt(d2), push = (4 - d) * 0.5;
      o.x += (dx / d) * push; o.z += (dz / d) * push;
      if (Math.abs(car.speed) > 10) { damageCar(o, 3); damageCar(car, 2); G.camShake = Math.max(G.camShake, 0.25); }
      car.speed *= 0.82;
    }
  }
  const kmh = Math.abs(car.speed) * 3.6;
  if (kmh > G.stats.topSpeed) G.stats.topSpeed = Math.floor(kmh);
  G.stats.distanceKm += Math.abs(car.speed) * dt / 1000;
  syncCarMesh(car);
  G.player.x = car.x; G.player.z = car.z;
}

export function nearestCar(x, z, maxD = 6) {
  let best = null, bd = maxD * maxD;
  for (const c of G.cars) {
    if (c.cop || c.dead) continue;
    const dx = c.x - x, dz = c.z - z, d2 = dx * dx + dz * dz;
    if (d2 < bd) { bd = d2; best = c; }
  }
  return best;
}

export function enterCar(car) {
  G.player.inCar = car;
  car.traffic = false; car.parked = false;
  if (G.player.mesh) G.player.mesh.visible = false;
  sfx('steal');
}
export function exitCar() {
  const car = G.player.inCar;
  if (!car) return;
  G.player.inCar = null;
  G.player.x = car.x + Math.cos(car.a) * 2.4; G.player.z = car.z - Math.sin(car.a) * 2.4;
  car.speed = 0;
  if (G.player.mesh) G.player.mesh.visible = true;
}

// Parked stealable cars near spawn + scattered; each has an owner ped sometimes.
export function spawnParkedCars() {
  const spots = [
    [-112, 244, 0.4, 0], [-132, 262, 2.2, 1], [-96, 228, 1.1, 2],
    [-200, 60, 0, 1], [120, 240, 3.1, 0], [210, -120, 1.5, 3],
    [-240, -200, 0.7, 2], [80, 90, 2.8, 0], [-40, -240, 0.2, 1], [260, 260, 1.9, 4],
  ];
  for (const [x, z, a, m] of spots) spawnCar(x, z, a, m, { parked: true });
}
