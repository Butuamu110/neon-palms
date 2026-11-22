// NEON PALMS — pedestrians: walk the sidewalks, chat in pairs, flee gunfire and
// traffic, and phone in crimes (witnesses feed the wanted system).
import { G, feed } from './config.js';
import { scene, pushOut } from './city.js';
import { rng, rr, pick, clamp } from './rng.js';

const SHIRTS = [0xff5fa2, 0x37c8ff, 0xffe066, 0x7dff9a, 0xc44dff, 0xf2f2f2, 0xff8c42];
let bodyGeo, headGeo;

export function makePedMesh(shirt) {
  if (!bodyGeo) {
    bodyGeo = new THREE.CapsuleGeometry(0.32, 0.85, 3, 8);
    headGeo = new THREE.SphereGeometry(0.24, 8, 8);
  }
  const grp = new THREE.Group();
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 }));
  body.position.y = 0.95; body.castShadow = true; grp.add(body);
  const head = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.8 }));
  head.position.y = 1.78; grp.add(head);
  scene.add(grp);
  return grp;
}

export function spawnPed(x, z, opts = {}) {
  const ped = {
    x, z, a: rr(0, 6.28), speed: 0, walkSpeed: rr(1.1, 1.9),
    tx: x + rr(-40, 40), tz: z + rr(-40, 40), wait: 0, flee: 0,
    health: 60, hostile: !!opts.hostile, name: opts.name || pick(['Luz', 'Marco', 'Tania', 'Rex', 'Iris', 'Hugo', 'Nadia', 'Pipo']),
    mesh: makePedMesh(opts.hostile ? 0x30303c : pick(SHIRTS)),
    dead: false, reportedAt: -99, shootCd: rr(0.5, 1.5),
  };
  ped.mesh.position.set(x, 0, z);
  G.peds.push(ped);
  return ped;
}

export function initPeds() {
  const hotspots = [[-150, 240], [-180, 60], [-120, 120], [150, 200], [220, 120], [-220, -160], [140, -160], [0, 250], [-60, -60], [60, 60]];
  for (const [hx, hz] of hotspots) for (let i = 0; i < 4; i++) spawnPed(hx + rr(-26, 26), hz + rr(-26, 26));
}

export function witnessCrime(kind, x, z) {
  // nearest living ped within earshot phones it in
  let best = null, bd = 45 * 45;
  for (const p of G.peds) {
    if (p.dead || p.hostile) continue;
    const dx = p.x - x, dz = p.z - z, d2 = dx * dx + dz * dz;
    if (d2 < bd) { bd = d2; best = p; }
  }
  if (best && G.time - best.reportedAt > 6) {
    best.reportedAt = G.time;
    feed(`WITNESS ${best.name.toUpperCase()} — "${kind}" called in to San Verde PD`);
    return true;
  }
  return false;
}

export function updatePeds(dt) {
  const px = G.player.x, pz = G.player.z;
  for (const ped of G.peds) {
    if (ped.dead) continue;
    let tx = ped.tx, tz = ped.tz, sp = ped.walkSpeed;
    const dxp = ped.x - px, dzp = ped.z - pz, dp2 = dxp * dxp + dzp * dzp;
    const shotNear = G.lastShotAt && G.time - G.lastShotAt < 3 && dp2 < 2500;
    if (shotNear || (G.player.inCar && Math.abs(G.player.inCar.speed) > 16 && dp2 < 120)) {
      ped.flee = 1.6;
    }
    if (ped.flee > 0) {
      ped.flee -= dt;
      tx = ped.x + dxp * 3; tz = ped.z + dzp * 3; sp = 4.6;
    } else if (ped.hostile) {
      // rival scouts close in and shoot (combat.js applies their fire)
      if (dp2 > 100) { tx = px; tz = pz; sp = 2.6; } else { tx = ped.x; tz = ped.z; sp = 0; }
    } else if (ped.wait > 0) {
      ped.wait -= dt; sp = 0;
    }
    const dx = tx - ped.x, dz = tz - ped.z, d = Math.hypot(dx, dz);
    if (d > 0.6 && sp > 0) {
      ped.a = Math.atan2(dx, dz);
      ped.x += Math.sin(ped.a) * sp * dt;
      ped.z += Math.cos(ped.a) * sp * dt;
      ped.walkPhase = (ped.walkPhase || 0) + dt * sp * 3.2;
    } else if (!ped.hostile && ped.flee <= 0 && ped.wait <= 0) {
      ped.wait = rr(0.5, 3);
      ped.tx = clamp(ped.x + rr(-55, 55), -325, 325);
      ped.tz = clamp(ped.z + rr(-55, 55), -325, 325);
    }
    const pp = { x: ped.x, z: ped.z }; pushOut(pp, 0.5); ped.x = pp.x; ped.z = pp.z;
    ped.mesh.position.set(ped.x, Math.abs(Math.sin(ped.walkPhase || 0)) * 0.05, ped.z);
    ped.mesh.rotation.y = ped.a;
  }
}
