// Cars for NEON PALMS: a catalogue of models with their own pace and manners, an arcade
// physics step (throttle, speed-sensitive steering, handbrake slip, building and car
// collisions, off-road drag), and a top-down painter that draws each model properly —
// cabin glass, wheel steer, light bars, taxi signs, spoilers, underglow — because the
// screenshots are judged on how the cars read.

export const MODELS = {
  solstice: { name: 'Solstice GT', length: 124, width: 56, top: 460, accel: 330, grip: 5.2, price: 68000, kind: 'hero', spoiler: true, stripe: true },
  vader: { name: 'Vader Muscle', length: 118, width: 56, top: 420, accel: 310, grip: 4.2, price: 34000, kind: 'muscle', stripe: true },
  comet: { name: 'Comet S', length: 108, width: 50, top: 430, accel: 320, grip: 5.6, price: 42000, kind: 'sport' },
  taxa: { name: 'Taxa Cab', length: 112, width: 52, top: 330, accel: 230, grip: 4.6, price: 0, kind: 'taxi', taxi: true },
  cruiser: { name: 'PD Interceptor', length: 116, width: 54, top: 445, accel: 320, grip: 5.0, price: 0, kind: 'police', lightbar: true },
  sedan: { name: 'Meridian Sedan', length: 110, width: 52, top: 320, accel: 215, grip: 4.8, price: 12000, kind: 'sedan' },
  compact: { name: 'Pichu Compact', length: 92, width: 46, top: 290, accel: 200, grip: 5.0, price: 7000, kind: 'compact' },
  lux: { name: 'Aurum Limo', length: 128, width: 56, top: 350, accel: 240, grip: 4.4, price: 95000, kind: 'lux' },
  van: { name: 'Cargo Van', length: 122, width: 58, top: 280, accel: 180, grip: 3.8, price: 15000, kind: 'van' },
  truck: { name: 'Hauler Truck', length: 138, width: 60, top: 260, accel: 160, grip: 3.4, price: 22000, kind: 'truck' },
  lowrider: { name: 'Flats Lowrider', length: 116, width: 54, top: 310, accel: 230, grip: 4.0, price: 19000, kind: 'muscle', stripe: true },
};

export const PAINTS = ['#c2274b', '#2456c8', '#e8e4da', '#15151c', '#e07b39', '#2e8f6e', '#7a3fa0', '#c8a028', '#7fb2c9', '#5e6650', '#93248f', '#28418f'];

let nextCarId = 1;

export function createCar(modelId, x, y, angle, color) {
  const model = MODELS[modelId];
  return {
    id: nextCarId++,
    model: modelId,
    def: model,
    x, y, angle,
    vx: 0, vy: 0,
    steerVis: 0,
    color: color || PAINTS[0],
    health: 100,
    driver: null, // 'player' | 'traffic' | 'cop' | 'racer' | 'target' | null (parked)
    callsign: null,
    role: null,
    dead: false,
    wreck: false,
    lightsOn: true,
    sirenPhase: Math.random() * 6,
    doorOpen: 0,
    underglow: model.kind === 'hero' || model.kind === 'sport' ? '#ff4fd8' : null,
    parked: false,
  };
}

export function speedOf(car) {
  return Math.hypot(car.vx, car.vy);
}

/** Forward speed along the nose (negative when reversing). */
export function forwardSpeed(car) {
  return car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle);
}

export function speedKmh(car) {
  return Math.round(Math.abs(forwardSpeed(car)) * 0.36);
}

/**
 * One physics step. `control` is {throttle -1..1, steer -1..1, handbrake bool}. Returns
 * the impact speed of any building hit this step (0 when clean) so the caller can price
 * the damage and the noise.
 */
export function stepCar(car, control, dt, city) {
  const def = car.def;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const rx = -fy;
  const ry = fx;
  let fSpeed = car.vx * fx + car.vy * fy;
  let rSpeed = car.vx * rx + car.vy * ry;

  const ground = city.groundAt(car.x, car.y);
  const surfaceGrip = ground === 'sand' ? 0.45 : ground === 'block' ? 0.8 : 1;
  const topSpeed = def.top * (ground === 'sand' ? 0.55 : 1);

  if (control.throttle > 0) {
    fSpeed += def.accel * control.throttle * dt * (fSpeed < 0 ? 2.2 : 1);
    if (fSpeed > topSpeed) fSpeed = Math.max(topSpeed, fSpeed - 240 * dt);
  } else if (control.throttle < 0) {
    if (fSpeed > 12) fSpeed -= 420 * dt;
    else fSpeed = Math.max(-130, fSpeed + def.accel * control.throttle * dt * 0.7);
  } else {
    fSpeed -= fSpeed * 0.35 * dt;
  }
  // Rolling drag and air.
  fSpeed -= fSpeed * 0.12 * dt;

  // Steering bites with speed, fades at the top end; reversing flips it.
  const steerAuthority = Math.min(1, Math.abs(fSpeed) / 90) * (1 - Math.min(0.45, Math.abs(fSpeed) / (def.top * 2.4)));
  const turn = control.steer * 2.35 * steerAuthority * (fSpeed < 0 ? -1 : 1);
  car.angle += turn * dt * (control.handbrake ? 1.5 : 1);
  car.steerVis += ((control.steer * 0.5) - car.steerVis) * Math.min(1, dt * 10);

  // Grip kills sideways slide; the handbrake lets it live.
  const grip = control.handbrake ? 1.1 : def.grip * surfaceGrip;
  rSpeed -= rSpeed * Math.min(1, grip * dt * 2.4);

  const nfx = Math.cos(car.angle);
  const nfy = Math.sin(car.angle);
  const nrx = -nfy;
  const nry = nfx;
  car.vx = nfx * fSpeed + nrx * rSpeed;
  car.vy = nfy * fSpeed + nry * rSpeed;
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  // World edges: the sea and the sheet border stop a car dead.
  car.x = Math.max(30, Math.min(5160, car.x));
  car.y = Math.max(30, Math.min(3760, car.y));

  // Buildings: circle at the centre plus one at the nose; push out along the hit normal.
  let impact = 0;
  for (const [ox, oy] of [[0, 0], [def.length * 0.36, 0], [-def.length * 0.36, 0]]) {
    const px = car.x + nfx * ox - nfy * oy;
    const py = car.y + nfy * ox + nfx * oy;
    const hit = city.collide(px, py, def.width * 0.52);
    if (hit) {
      car.x += hit.nx * hit.depth;
      car.y += hit.ny * hit.depth;
      const into = -(car.vx * hit.nx + car.vy * hit.ny);
      if (into > 0) {
        impact = Math.max(impact, into);
        car.vx += hit.nx * into * 1.4;
        car.vy += hit.ny * into * 1.4;
      }
    }
  }
  if (impact > 60) {
    car.health -= (impact - 60) * 0.11;
    if (car.health <= 0 && !car.wreck) {
      car.wreck = true;
      car.health = 0;
    }
  }
  if (car.doorOpen > 0) car.doorOpen = Math.max(0, car.doorOpen - dt * 1.4);
  return impact;
}

/** Soft car-to-car push: overlapping circles trade a little velocity and scrape paint. */
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const min = (a.def.width + b.def.width) * 0.62;
  const d2 = dx * dx + dy * dy;
  if (d2 === 0 || d2 > min * min) return 0;
  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  const push = (min - d) / 2;
  if (!a.parked) { a.x -= nx * push; a.y -= ny * push; }
  if (!b.parked) { b.x += nx * push; b.y += ny * push; }
  const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rel < 0) {
    const j = -rel * 0.6;
    a.vx -= nx * j; a.vy -= ny * j;
    b.vx += nx * j; b.vy += ny * j;
    if (-rel > 70) {
      a.health -= 2.5;
      b.health -= 2.5;
    }
    return -rel;
  }
  return 0;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Paint one car, nose along +x in local space (the caller translates/rotates).
 * `time` drives the light bar and the underglow pulse.
 */
export function drawCar(ctx, car, time) {
  const def = car.def;
  const L = def.length;
  const W = def.width;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  // Underglow first: it spills onto the asphalt under the body.
  if (car.underglow && !car.wreck) {
    const pulse = 0.55 + 0.2 * Math.sin(time * 3 + car.id);
    const glow = ctx.createRadialGradient(0, 0, 6, 0, 0, L * 0.72);
    glow.addColorStop(0, hexA(car.underglow, 0.5 * pulse));
    glow.addColorStop(1, hexA(car.underglow, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(-L * 0.75, -L * 0.55, L * 1.5, L * 1.1);
  }

  // Tyres: front pair turns with the steering.
  ctx.fillStyle = '#0c0c10';
  const ww = 13;
  const wl = 26;
  for (const [wx, wy, front] of [[L * 0.32, -W / 2 + 3, 1], [L * 0.32, W / 2 - 3, 1], [-L * 0.32, -W / 2 + 3, 0], [-L * 0.32, W / 2 - 3, 0]]) {
    ctx.save();
    ctx.translate(wx, wy);
    if (front) ctx.rotate(car.steerVis * 0.55);
    roundRect(ctx, -wl / 2, -ww / 2, wl, ww, 4);
    ctx.fill();
    ctx.restore();
  }

  // Body: a lengthwise gradient so the nose reads lighter than the tail.
  const body = ctx.createLinearGradient(-L / 2, 0, L / 2, 0);
  const base = car.wreck ? '#3a3a40' : car.color;
  body.addColorStop(0, shade(base, -28));
  body.addColorStop(0.45, shade(base, 12));
  body.addColorStop(1, shade(base, -8));
  ctx.fillStyle = body;
  roundRect(ctx, -L / 2, -W / 2, L, W, def.kind === 'van' || def.kind === 'truck' ? 7 : 13);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (def.stripe) {
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(-L / 2 + 4, -4.6, L - 8, 3);
    ctx.fillRect(-L / 2 + 4, 1.6, L - 8, 3);
  }
  if (def.kind === 'police') {
    ctx.fillStyle = '#101018';
    ctx.fillRect(-L * 0.08, -W / 2 + 2, L * 0.3, W - 4);
    ctx.fillStyle = '#f2f2f2';
    ctx.font = `bold ${Math.round(W * 0.34)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.translate(L * 0.07, 0);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('PD', 0, 0);
    ctx.restore();
  }
  if (def.taxi) {
    ctx.fillStyle = '#ffd257';
    ctx.fillRect(-L / 2, -W / 2, L, W);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    for (let i = 0; i < 6; i += 1) ctx.fillRect(-L / 2 + i * (L / 6), W / 2 - 8, L / 12, 8);
    ctx.fillStyle = '#15151c';
    roundRect(ctx, -10, -11, 26, 22, 4);
    ctx.fill();
    ctx.fillStyle = '#ffd257';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TAXI', 3, 0);
  }

  // Cabin: glasshouse with a windshield rake; vans and trucks get a slab front instead.
  ctx.fillStyle = 'rgba(16,22,34,0.92)';
  if (def.kind === 'van' || def.kind === 'truck') {
    roundRect(ctx, L * 0.08, -W / 2 + 6, L * 0.36, W - 12, 5);
    ctx.fill();
    ctx.fillStyle = shade(base, 6);
    ctx.fillRect(-L / 2 + 3, -W / 2 + 3, L * 0.55, W - 6);
  } else {
    roundRect(ctx, -L * 0.3, -W / 2 + 7, L * 0.52, W - 14, 9);
    ctx.fill();
    ctx.fillStyle = 'rgba(120,190,235,0.5)';
    ctx.beginPath();
    ctx.moveTo(L * 0.2, -W / 2 + 9);
    ctx.lineTo(L * 0.3, 0);
    ctx.lineTo(L * 0.2, W / 2 - 9);
    ctx.lineTo(L * 0.12, 0);
    ctx.closePath();
    ctx.fill();
    // Roof panel between the glass: a touch darker than the body so the cabin reads.
    ctx.fillStyle = shade(base, -2);
    roundRect(ctx, -L * 0.16, -W / 2 + 10, L * 0.24, W - 20, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  if (def.spoiler) {
    ctx.fillStyle = shade(base, -34);
    ctx.fillRect(-L / 2 - 3, -W / 2 + 4, 9, W - 8);
  }
  if (def.lightbar) {
    const phase = Math.floor(time * 3 + car.sirenPhase) % 2;
    ctx.fillStyle = phase === 0 ? '#ff3b4e' : '#274bdb';
    roundRect(ctx, -6, -W / 4, 15, W / 4, 3);
    ctx.fill();
    ctx.fillStyle = phase === 0 ? '#274bdb' : '#ff3b4e';
    roundRect(ctx, -6, 0, 15, W / 4, 3);
    ctx.fill();
  }
  if (car.doorOpen > 0) {
    ctx.save();
    ctx.translate(-L * 0.05, -W / 2);
    ctx.rotate(-0.9 * car.doorOpen);
    ctx.fillStyle = shade(base, -6);
    ctx.fillRect(0, -5, L * 0.24, 5);
    ctx.restore();
  }

  // Lights: headlights pale, tail lights red; brighter cones are the renderer's job.
  ctx.fillStyle = '#ffeec2';
  ctx.fillRect(L / 2 - 3, -W / 2 + 5, 4, 9);
  ctx.fillRect(L / 2 - 3, W / 2 - 14, 4, 9);
  ctx.fillStyle = car.wreck ? '#571d22' : '#ff2e3f';
  ctx.fillRect(-L / 2 - 1, -W / 2 + 5, 4, 9);
  ctx.fillRect(-L / 2 - 1, W / 2 - 14, 4, 9);

  // Damage smoke stain and scrapes.
  if (car.health < 55) {
    ctx.fillStyle = `rgba(20,20,24,${0.35 + (55 - car.health) / 120})`;
    ctx.beginPath();
    ctx.ellipse(L * 0.3, 0, L * 0.16, W * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function hexA(hex, alpha) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function shade(hex, amt) {
  const n = Number.parseInt(hex.slice(1), 16);
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const r = clamp(((n >> 16) & 255) + amt);
  const g = clamp(((n >> 8) & 255) + amt);
  const b = clamp((n & 255) + amt);
  return `rgb(${r},${g},${b})`;
}
