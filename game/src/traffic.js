// NEON PALMS — traffic AI: civilian cars cruise the road grid, turn at junctions,
// brake for the car ahead, and flee or stop when shots are fired nearby.
import { G, CFG } from './config.js';
import { rng, rr, pick, clamp } from './rng.js';
import { spawnCar, syncCarMesh } from './vehicles.js';

export function initTraffic() {
  for (let i = 0; i < 16; i++) {
    const vertical = rng() < 0.5;
    const line = pick(CFG.roadLines);
    const pos = rr(-310, 310);
    const x = vertical ? line + 4 : pos;
    const z = vertical ? pos : line + 4;
    const dir = rng() < 0.5 ? 1 : -1;
    const car = spawnCar(x, z, vertical ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2), Math.floor(rr(0, 3)), { traffic: true });
    car.ai = { vertical, line, dir, cruise: rr(9, 15), panic: 0 };
  }
}

export function updateTraffic(dt) {
  const px = G.player.x, pz = G.player.z;
  for (const car of G.cars) {
    if (!car.traffic || car.dead) continue;
    const ai = car.ai;
    if (!ai) continue;
    // panic if gunfire close
    if (G.lastShotAt && G.time - G.lastShotAt < 2.5) {
      const dx = car.x - px, dz = car.z - pz;
      if (dx * dx + dz * dz < 1600) ai.panic = 2.5;
    }
    if (ai.panic > 0) ai.panic -= dt;
    // obstacle ahead?
    let blocked = false;
    const fx = Math.sin(car.a), fz = Math.cos(car.a);
    for (const o of G.cars) {
      if (o === car) continue;
      const dx = o.x - car.x, dz = o.z - car.z;
      const ahead = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < 9 && side < 2.4) { blocked = true; break; }
    }
    const pdx = px - car.x, pdz = pz - car.z;
    const pAhead = pdx * fx + pdz * fz, pSide = Math.abs(pdx * fz - pdz * fx);
    if (!G.player.inCar && pAhead > 0 && pAhead < 7 && pSide < 2) blocked = true;

    const target = blocked ? 0 : ai.cruise * (ai.panic > 0 ? 1.9 : 1);
    car.speed += clamp(target - car.speed, -26 * dt * 3, 12 * dt * 3) * 1;
    car.speed = clamp(car.speed, 0, 30);
    car.x += fx * car.speed * dt;
    car.z += fz * car.speed * dt;
    // junction: maybe turn onto a crossing road line
    const along = ai.vertical ? car.z : car.x;
    for (const L of CFG.roadLines) {
      if (Math.abs(along - L) < 1.2 && car.speed > 2 && rng() < 0.012) {
        ai.vertical = !ai.vertical;
        ai.line = L;
        if (ai.vertical) { car.x = L + 4 * ai.dir; car.a = ai.dir > 0 ? 0 : Math.PI; }
        else { car.z = L + 4 * ai.dir; car.a = ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
        break;
      }
    }
    // wrap at world edge: reverse direction
    if (car.x > 330 || car.x < -330 || car.z > 330 || car.z < -330) {
      ai.dir *= -1;
      car.a += Math.PI;
      car.x = clamp(car.x, -328, 328); car.z = clamp(car.z, -328, 328);
    }
    syncCarMesh(car);
  }
}
