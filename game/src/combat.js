// Combat for NEON PALMS: five weapon slots, hitscan tracers, muzzle flash, and a city that
// reacts. Shots are rays: the nearest body or car along the line takes the hit, sparks fly,
// witnesses run, and the dispatcher hears about it — louder if the target wears a badge.
// Mission shooters shoot back with human inaccuracy; carjacked drivers sometimes do too.

import { CRIME_HEAT } from './police.js';

export const WEAPONS = [
  { id: 'fists', name: 'Fists', slot: 1, damage: 16, rate: 2.2, range: 34, spread: 0, pellets: 1, price: 0, auto: false, ammoMax: Infinity },
  { id: 'pistol', name: 'P-9 Pistol', slot: 2, damage: 24, rate: 3.4, range: 520, spread: 0.02, pellets: 1, price: 650, auto: false, ammoMax: 240 },
  { id: 'smg', name: 'VK SMG', slot: 3, damage: 15, rate: 9.5, range: 470, spread: 0.055, pellets: 1, price: 1900, auto: true, ammoMax: 600 },
  { id: 'shotgun', name: 'Boomstick', slot: 4, damage: 11, rate: 1.15, range: 300, spread: 0.11, pellets: 7, price: 2600, auto: false, ammoMax: 90 },
  { id: 'rifle', name: 'AR-15 Carbine', slot: 5, damage: 30, rate: 6.5, range: 760, spread: 0.016, pellets: 1, price: 4200, auto: true, ammoMax: 480 },
];

export function weaponById(id) {
  return WEAPONS.find((w) => w.id === id);
}

export function createCombat() {
  return {
    tracers: [],
    flashes: [],
    crimeClock: 0,

    update(dt, game) {
      this.crimeClock -= dt;
      for (let i = this.tracers.length - 1; i >= 0; i -= 1) {
        this.tracers[i].life -= dt;
        if (this.tracers[i].life <= 0) this.tracers.splice(i, 1);
      }
      for (let i = this.flashes.length - 1; i >= 0; i -= 1) {
        this.flashes[i].life -= dt;
        if (this.flashes[i].life <= 0) this.flashes.splice(i, 1);
      }
      this.updatePlayerFire(dt, game);
      this.updateShooters(dt, game);
    },

    updatePlayerFire(dt, game) {
      const p = game.player;
      p.fireCd -= dt;
      if (p.car || p.dead) return;
      const weapon = weaponById(p.weapons[p.weaponIdx].id);
      const wantFire = game.input.held.fire;
      if (!wantFire) {
        p.triggerHeld = false;
        return;
      }
      if (!weapon.auto && p.triggerHeld) return;
      if (p.fireCd > 0) return;
      const slot = p.weapons[p.weaponIdx];
      if (weapon.id !== 'fists' && slot.ammo <= 0) {
        game.audio.dryFire();
        p.fireCd = 0.3;
        p.triggerHeld = true;
        return;
      }
      p.triggerHeld = true;
      p.fireCd = 1 / weapon.rate;
      if (weapon.id !== 'fists') slot.ammo -= 1;
      this.fireRay(game, p, weapon, true);
    },

    /** One trigger pull from `shooter` (the player or a ped) along its aim. */
    fireRay(game, shooter, weapon, isPlayer) {
      if (isPlayer) game.stats.shotsFired += 1;
      const rng = game.rngCombat;
      const baseAngle = shooter.angle;
      const ox = shooter.x + Math.cos(baseAngle) * 16;
      const oy = shooter.y + Math.sin(baseAngle) * 16;
      this.flashes.push({ x: ox, y: oy, life: 0.05, max: 0.05, big: weapon.id === 'shotgun' });
      game.audio.shot(weapon.id === 'shotgun' || weapon.id === 'rifle');
      game.setDanger(shooter.x, shooter.y, 330);

      for (let pellet = 0; pellet < weapon.pellets; pellet += 1) {
        const angle = baseAngle + rng.range(-weapon.spread, weapon.spread);
        const hit = this.castRay(game, shooter, ox, oy, angle, weapon.range);
        const ex = hit ? hit.x : ox + Math.cos(angle) * weapon.range;
        const ey = hit ? hit.y : oy + Math.sin(angle) * weapon.range;
        this.tracers.push({ x0: ox, y0: oy, x1: ex, y1: ey, life: 0.07, max: 0.07, enemy: !isPlayer });
        if (!hit) continue;
        game.spawnSparks(ex, ey, weapon.id === 'shotgun' ? 7 : 4);
        this.applyHit(game, shooter, hit, weapon, isPlayer);
      }
      if (isPlayer && this.crimeClock <= 0) {
        this.crimeClock = 0.8;
        game.police.report('shot', game, shooter.x, shooter.y);
      }
    },

    /** March the ray in small steps; the first body, car or wall wins. */
    castRay(game, shooter, ox, oy, angle, range) {
      const step = 9;
      const dx = Math.cos(angle) * step;
      const dy = Math.sin(angle) * step;
      let x = ox;
      let y = oy;
      for (let t = step; t < range; t += step) {
        x += dx;
        y += dy;
        if (game.city.collide(x, y, 3)) return { kind: 'wall', x, y };
        for (const ped of game.crowds.peds) {
          if (ped === shooter || ped.dead) continue;
          if (Math.abs(ped.x - x) < 11 && Math.abs(ped.y - y) < 11) return { kind: 'ped', ped, x, y };
        }
        for (const unit of game.police.units) {
          const car = unit.car;
          if (Math.abs(car.x - x) < car.def.width * 0.7 && Math.abs(car.y - y) < car.def.width * 0.7) return { kind: 'copcar', car, x, y };
        }
        for (const car of game.allCars()) {
          if (car === shooter.car || car.parked && Math.abs(car.x - x) > 60) { /* still hittable below */ }
          if (Math.abs(car.x - x) < car.def.width * 0.66 && Math.abs(car.y - y) < car.def.width * 0.66) return { kind: 'car', car, x, y };
        }
        if (!game.player.car && game.player !== shooter) {
          const p = game.player;
          if (Math.abs(p.x - x) < 11 && Math.abs(p.y - y) < 11) return { kind: 'player', x, y };
        }
      }
      return null;
    },

    applyHit(game, shooter, hit, weapon, isPlayer) {
      if (hit.kind === 'ped') {
        hit.ped.hp -= weapon.damage * game.rngCombat.range(0.85, 1.15);
        game.audio.hit();
        if (hit.ped.hp <= 0 && isPlayer) {
          game.police.report('pedDown', game, hit.ped.x, hit.ped.y);
          game.stats.pedsDown += 1;
        } else if (hit.ped.kind === 'walker' || hit.ped.kind === 'crew') {
          hit.ped.state = 'flee';
          hit.ped.wait = 2;
        }
        return;
      }
      if (hit.kind === 'copcar') {
        hit.car.health -= weapon.damage * 0.4;
        if (isPlayer) game.police.report('shotAtCop', game, hit.car.x, hit.car.y);
        if (hit.car.health <= 0 && !hit.car.wreck) {
          hit.car.wreck = true;
          game.onCopDown(hit.car);
        }
        return;
      }
      if (hit.kind === 'car') {
        hit.car.health -= weapon.damage * 0.32;
        game.audio.hit();
        if (hit.car.driver === 'traffic') game.ejectDriver(hit.car, true);
        return;
      }
      if (hit.kind === 'player') {
        game.player.takeDamage(weapon.damage * game.rngCombat.range(0.7, 1.1), game);
      }
    },

    /** Mission shooters and armed drivers: they aim, they miss like humans, they reload. */
    updateShooters(dt, game) {
      const p = game.player;
      for (const ped of game.crowds.peds) {
        if (ped.kind !== 'shooter' || ped.dead) continue;
        const target = p.car || p;
        const d = Math.hypot(target.x - ped.x, target.y - ped.y);
        ped.angle = Math.atan2(target.y - ped.y, target.x - ped.x);
        // Close to a firing position and hold it; strafing looks alive.
        if (d > 300) {
          ped.x += Math.cos(ped.angle) * 95 * dt;
          ped.y += Math.sin(ped.angle) * 95 * dt;
        } else if (d < 130) {
          ped.x -= Math.cos(ped.angle) * 60 * dt;
          ped.y -= Math.sin(ped.angle) * 60 * dt;
        } else {
          ped.x += Math.cos(ped.angle + Math.PI / 2) * Math.sin(game.time * 0.9 + ped.id) * 34 * dt;
          ped.y += Math.sin(ped.angle + Math.PI / 2) * Math.sin(game.time * 0.9 + ped.id) * 34 * dt;
        }
        const hit = game.city.collide(ped.x, ped.y, 11);
        if (hit) {
          ped.x += hit.nx * hit.depth;
          ped.y += hit.ny * hit.depth;
        }
        ped.fireTimer -= dt;
        if (ped.fireTimer <= 0 && d < 560) {
          ped.fireTimer = game.rngCombat.range(0.5, 1.3);
          const weapon = weaponById(ped.weaponId || 'smg');
          // Human aim: lead badly, spray wide.
          const savedAngle = ped.angle;
          ped.angle += game.rngCombat.range(-0.09, 0.09);
          this.fireRay(game, ped, weapon, false);
          ped.angle = savedAngle;
        }
      }
    },
  };
}

export { CRIME_HEAT };
