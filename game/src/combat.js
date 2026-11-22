// NEON PALMS — combat: on-foot shooting with muzzle glow, tracers, floating damage
// numbers, health/armor, hostile peds and officer fire, player death/respawn.
import { G, WEAPONS, feed } from './config.js';
import { scene } from './city.js';
import { rng, clamp } from './rng.js';
import { down } from './input.js';
import { sfx } from './audio.js';
import { commitCrime } from './police.js';
import { witnessCrime } from './pedestrians.js';

export const dmgNumbers = [];   // {x,y,z,val,until,mesh}
let glowTexCache = null, tracerMat = null, flashMat = null;
const tracers = [];

function glowTex() {
  if (glowTexCache) return glowTexCache;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.4, 'rgba(255,180,60,0.6)'); gr.addColorStop(1, 'rgba(255,140,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  glowTexCache = new THREE.CanvasTexture(c);
  return glowTexCache;
}

export function initCombat() {
  tracerMat = new THREE.LineBasicMaterial({ color: 0xffd94d, transparent: true, opacity: 0.9 });
  flashMat = new THREE.SpriteMaterial({ map: glowTex(), color: 0xffcf7a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
}

function spawnDmgNumber(x, y, z, val, crit) {
  const c = document.createElement('canvas'); c.width = 96; c.height = 48;
  const g = c.getContext('2d');
  g.font = 'bold 30px Arial'; g.textAlign = 'center';
  g.lineWidth = 5; g.strokeStyle = '#000'; g.strokeText(String(val), 48, 32);
  g.fillStyle = crit ? '#ff4040' : '#ffe066'; g.fillText(String(val), 48, 32);
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.position.set(x, y, z); s.scale.set(3.4, 1.7, 1);
  scene.add(s);
  dmgNumbers.push({ mesh: s, until: G.time + 0.85, vy: 2.2 });
  // also float a DOM chip for screenshot legibility
  const el = document.createElement('div');
  el.className = 'dmg-float'; el.textContent = '-' + val;
  el.style.left = (44 + rng() * 12) + '%'; el.style.top = (38 + rng() * 10) + '%';
  document.getElementById('dmg-layer').appendChild(el);
  setTimeout(() => el.remove(), 850);
}

function muzzleFlash(x, y, z) {
  const s = new THREE.Sprite(flashMat.clone());
  s.position.set(x, y, z); s.scale.set(2.6, 2.6, 1);
  scene.add(s);
  tracers.push({ mesh: s, until: G.time + 0.05, isFlash: true });
}

function tracer(x1, y1, z1, x2, y2, z2) {
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2)]);
  const line = new THREE.Line(geo, tracerMat);
  scene.add(line);
  tracers.push({ mesh: line, until: G.time + 0.07 });
}

export function hurtPlayer(n, label) {
  if (G.armor > 0) { const absorbed = Math.min(G.armor, n * 0.6); G.armor -= absorbed; n -= absorbed; }
  G.health -= n;
  G.camShake = Math.max(G.camShake, 0.3);
  if (G.health <= 0 && G.mode === 'play') {
    G.health = 0;
    feed('SAN VERDE GENERAL — you were dropped; crew pulled you out');
    const cost = Math.min(500, Math.floor(G.cash * 0.1));
    G.cash -= cost;
    G.health = 100; G.armor = 25;
    G.player.inCar = null;
    if (G.player.mesh) G.player.mesh.visible = true;
    G.player.x = 150; G.player.z = 210;   // hospital at Puerto Alba edge
    G.wanted = 0; G.sight = 'SEARCHING';
    G.msg = `WASTED — hospital bill $${cost}. Valentina: "Walk it off."`;
    G.msgUntil = G.time + 5;
  }
  void label;
}

export function updateCombat(dt) {
  // expire tracers / flashes / damage numbers
  for (let i = tracers.length - 1; i >= 0; i--) {
    if (G.time > tracers[i].until) { scene.remove(tracers[i].mesh); tracers.splice(i, 1); }
  }
  for (let i = dmgNumbers.length - 1; i >= 0; i--) {
    const d = dmgNumbers[i];
    d.mesh.position.y += d.vy * dt;
    d.mesh.material.opacity = clamp((d.until - G.time) / 0.85, 0, 1);
    if (G.time > d.until) { scene.remove(d.mesh); dmgNumbers.splice(i, 1); }
  }
  // hostile peds + wanted officers shoot back
  const px = G.player.x, pz = G.player.z;
  for (const ped of G.peds) {
    if (ped.dead) continue;
    const hostileCop = false;
    if (!ped.hostile && !hostileCop) continue;
    ped.shootCd -= dt;
    const dx = px - ped.x, dz = pz - ped.z, d = Math.hypot(dx, dz);
    if (ped.shootCd <= 0 && d < 30 && d > 2) {
      ped.shootCd = 0.9 + rng() * 0.7;
      muzzleFlash(ped.x, 1.45, ped.z);
      tracer(ped.x, 1.45, ped.z, px, 1.3, pz);
      sfx('shot');
      if (rng() < 0.42) hurtPlayer(4 + Math.floor(rng() * 6), 'gunfire');
    }
  }
  // player fire
  G.fireCd -= dt;
  const w = WEAPONS[G.weapon];
  if (G.mode !== 'play' || G.player.inCar || G.mapOpen || G.statsOpen) return;
  if (!down('KeyF') && !down('Mouse0')) return;
  if (G.fireCd > 0) return;
  if (w.ammo !== Infinity && w.ammo <= 0) { G.fireCd = 0.3; G.msg = `${w.name} — OUT OF AMMO`; G.msgUntil = G.time + 1.2; return; }
  G.fireCd = w.rate;
  if (w.ammo !== Infinity) w.ammo--;
  G.stats.shotsFired++;
  G.lastShotAt = G.time;
  sfx('shot');
  const pa = G.player.a;
  const mx = px + Math.sin(pa) * 0.7, mz = pz + Math.cos(pa) * 0.7;
  muzzleFlash(mx, 1.45, mz);
  // nearest hittable target in a forward cone
  let best = null, bd = 42;
  const consider = (obj, x, z, isPed) => {
    const dx = x - px, dz = z - pz, d = Math.hypot(dx, dz);
    if (d > bd || d < 0.5) return;
    const ang = Math.atan2(dx, dz);
    let da = Math.abs(ang - pa); while (da > Math.PI) da = Math.abs(da - Math.PI * 2);
    if (da < 0.5 || d < 4) { best = { obj, x, z, d, isPed }; bd = d; }
  };
  for (const ped of G.peds) if (!ped.dead) consider(ped, ped.x, ped.z, true);
  for (const car of G.cars) if (!car.dead) consider(car, car.x, car.z, false);
  const ex = best ? best.x : px + Math.sin(pa) * 30, ez = best ? best.z : pz + Math.cos(pa) * 30;
  tracer(mx, 1.45, mz, ex, 1.2, ez);
  witnessCrime('SHOTS FIRED', px, pz);
  if (G.wanted < 2) commitCrime(2, 'SHOTS FIRED on Club Mile');
  if (best) {
    const crit = rng() < 0.18;
    const dmg = Math.round(w.dmg * (crit ? 1.8 : 1) * (0.85 + rng() * 0.3));
    spawnDmgNumber(best.x, 2.3, best.z, dmg, crit);
    sfx('hit');
    if (best.isPed) {
      best.obj.health -= dmg;
      best.obj.flee = 2;
      if (best.obj.health <= 0 && !best.obj.dead) {
        best.obj.dead = true;
        best.obj.mesh.rotation.x = Math.PI / 2; best.obj.mesh.position.y = 0.3;
        feed(best.obj.hostile ? 'RIVAL DOWN — the crew saw it' : 'CIVILIAN DOWN — PD notified');
        if (best.obj.hostile) { G.addRespectOnce = true; }
        commitCrime(best.obj.hostile ? 3 : 4, best.obj.hostile ? 'RIVAL TAKEDOWN' : 'HOMICIDE');
      }
    } else {
      best.obj.condition = clamp(best.obj.condition - dmg * 0.35, 0, 100);
      if (best.obj.cop) commitCrime(3, 'FIRING ON INTERDICTION UNIT');
    }
  }
}
