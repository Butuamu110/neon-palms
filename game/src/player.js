// Rio Cárdenas, the player: on foot he walks, sprints and aims with the mouse; E takes a
// car — politely when it is empty, at gunpoint's notice when it is not, which the PD counts
// as carjacking. In a car he is the car. Health and armour live here, as do the weapons he
// owns and the slow business of dying: wasted means the hospital keeps the change.

import { WEAPONS } from './combat.js';

export function createPlayer(x, y) {
  const player = {
    x, y,
    vx: 0, vy: 0,
    angle: -Math.PI / 2,
    hp: 100,
    armor: 0,
    car: null,
    dead: false,
    weapons: WEAPONS.map((w) => ({ id: w.id, owned: w.id === 'fists' || w.id === 'pistol', ammo: w.id === 'pistol' ? 72 : 0 })),
    weaponIdx: 1,
    fireCd: 0,
    triggerHeld: false,
    walkPhase: 0,

    get speed() {
      return Math.hypot(this.vx, this.vy);
    },

    currentWeapon() {
      return this.weapons[this.weaponIdx];
    },

    giveWeapon(id, ammo) {
      const slot = this.weapons.find((w) => w.id === id);
      if (!slot) return;
      slot.owned = true;
      slot.ammo = Math.min(slot.ammo + ammo, 9999);
    },

    selectWeapon(index) {
      if (index < 0 || index >= this.weapons.length) return false;
      if (!this.weapons[index].owned) return false;
      this.weaponIdx = index;
      return true;
    },

    enterCar(car) {
      this.car = car;
      car.driver = 'player';
      car.parked = false;
      this.x = car.x;
      this.y = car.y;
    },

    leaveCar() {
      if (!this.car) return null;
      const car = this.car;
      car.driver = null;
      if (!car.wreck) car.parked = true;
      // Step out on the left side of the car.
      const side = car.angle - Math.PI / 2;
      this.x = car.x + Math.cos(side) * (car.def.width * 0.5 + 16);
      this.y = car.y + Math.sin(side) * (car.def.width * 0.5 + 16);
      this.car = null;
      return car;
    },

    takeDamage(amount, game) {
      if (this.dead) return;
      const absorbed = Math.min(this.armor, amount * 0.6);
      this.armor -= absorbed;
      this.hp -= amount - absorbed;
      game.hurtFlash = Math.min(1, (game.hurtFlash || 0) + 0.45);
      if (this.hp <= 0) {
        this.hp = 0;
        this.dead = true;
        game.onWasted();
      }
    },

    heal(amount) {
      this.hp = Math.min(100, this.hp + amount);
    },

    update(dt, game) {
      if (this.dead) return;
      if (this.car) {
        this.x = this.car.x;
        this.y = this.car.y;
        this.angle = this.car.angle;
        return;
      }
      const input = game.input;
      let mx = 0;
      let my = 0;
      if (input.held.up) my -= 1;
      if (input.held.down) my += 1;
      if (input.held.left) mx -= 1;
      if (input.held.right) mx += 1;
      const moving = mx !== 0 || my !== 0;
      const sprint = input.held.sprint;
      const speed = sprint ? 252 : 158;
      if (moving) {
        const len = Math.hypot(mx, my);
        this.vx = (mx / len) * speed;
        this.vy = (my / len) * speed;
      } else {
        this.vx = 0;
        this.vy = 0;
      }
      let nx = this.x + this.vx * dt;
      let ny = this.y + this.vy * dt;
      const hit = game.city.collide(nx, ny, 12);
      if (hit) {
        nx += hit.nx * hit.depth;
        ny += hit.ny * hit.depth;
      }
      // The sea is a wall; the sand is fine.
      this.x = Math.max(16, Math.min(4820, nx));
      this.y = Math.max(16, Math.min(3740, ny));
      if (moving) this.walkPhase += dt * (sprint ? 11 : 8);

      // Aim: at the mouse when it is on the canvas, else along the walk.
      const cam = game.camera;
      if (game.input.mouse.inside) {
        const wx = cam.x + (game.input.mouse.x - game.view.w / 2) / cam.zoom;
        const wy = cam.y + (game.input.mouse.y - game.view.h / 2) / cam.zoom;
        this.angle = Math.atan2(wy - this.y, wx - this.x);
      } else if (moving) {
        this.angle = Math.atan2(my, mx);
      }
    },
  };
  return player;
}

/** The nearest car the player could take: empty, or with a driver to remove. */
export function nearestStealable(game, radius) {
  const p = game.player;
  let best = null;
  let bestD = radius;
  const consider = (car) => {
    if (car.wreck || car === p.car) return;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  };
  for (const car of game.allCars()) consider(car);
  return best;
}
