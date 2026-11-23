// Palmera's economy: five tills that matter. Ammu-Palmera sells the five weapon slots and
// their feed; Spray & Pay straightens panels, changes the paint the PD is looking for and
// quietly cools a small heat; Burger Palms puts health back; Garage Solstice sells cars
// and stores the ones Rio owns; the Safehouse Brisa saves the career and sleeps the clock
// forward. Every catalogue is data — menus.js renders whatever catalogFor returns.

import { MODELS } from './vehicles.js';
import { WEAPONS } from './combat.js';

export function spend(game, amount) {
  if (game.cash < amount) return false;
  game.cash -= amount;
  game.audio.cash();
  return true;
}

export function earn(game, amount) {
  game.cash += amount;
  game.stats.earned += amount;
}

const GARAGE_STOCK = ['compact', 'sedan', 'lowrider', 'comet', 'vader', 'solstice', 'lux'];

export function catalogFor(poi, game) {
  const p = game.player;
  if (poi.kind === 'gunshop') {
    const items = [];
    for (const weapon of WEAPONS) {
      if (weapon.id === 'fists') continue;
      const slot = p.weapons.find((w) => w.id === weapon.id);
      if (!slot.owned) {
        items.push({
          label: `${weapon.name} — new`,
          price: weapon.price,
          can: game.cash >= weapon.price,
          run(g) {
            if (!spend(g, weapon.price)) return 'Not enough cash.';
            p.giveWeapon(weapon.id, Math.floor(weapon.ammoMax * 0.4));
            return `${weapon.name} is yours. Slot ${weapon.slot}.`;
          },
        });
      } else {
        const amount = Math.floor(weapon.ammoMax * 0.5);
        const price = Math.round(weapon.price * 0.18);
        items.push({
          label: `${weapon.name} ammo +${amount}`,
          price,
          can: game.cash >= price && slot.ammo < 9000,
          run(g) {
            if (!spend(g, price)) return 'Not enough cash.';
            slot.ammo += amount;
            return 'Ammo topped up.';
          },
        });
      }
    }
    items.push({
      label: 'Body armour — full',
      price: 420,
      can: game.cash >= 420 && p.armor < 100,
      run(g) {
        if (!spend(g, 420)) return 'Not enough cash.';
        p.armor = 100;
        return 'Armour fitted. Walk taller.';
      },
    });
    return items;
  }
  if (poi.kind === 'spray') {
    const car = p.car;
    const damage = car ? Math.round(100 - car.health) : 0;
    const repairPrice = car ? 120 + damage * 6 : 0;
    return [
      {
        label: car ? `Repair ${car.def.name} (${damage}% damage)` : 'Repair — bring a car',
        price: repairPrice,
        can: !!car && damage > 0 && game.cash >= repairPrice,
        run(g) {
          if (!car) return 'You are on foot.';
          if (!spend(g, repairPrice)) return 'Not enough cash.';
          car.health = 100;
          car.wreck = false;
          return 'Straightened, filled, polished.';
        },
      },
      {
        label: 'Repaint — new colour, cold trail',
        price: 300,
        can: !!car && game.cash >= 300,
        run(g) {
          if (!car) return 'You are on foot.';
          if (!spend(g, 300)) return 'Not enough cash.';
          const paints = ['#c2274b', '#2456c8', '#e8e4da', '#15151c', '#e07b39', '#2e8f6e', '#7a3fa0', '#c8a028'];
          let next = paints[Math.floor(Math.random() * paints.length)];
          if (next === car.color) next = paints[(paints.indexOf(next) + 1) % paints.length];
          car.color = next;
          if (g.police.seen === false || g.police.stars <= 2) {
            g.police.heat = Math.min(g.police.heat, 165);
            g.police.seen = false;
          }
          return 'New paint. Whoever they are chasing, it is not this car.';
        },
      },
    ];
  }
  if (poi.kind === 'food') {
    return [
      {
        label: 'Palms Burger — full health',
        price: 25,
        can: game.cash >= 25 && p.hp < 100,
        run(g) {
          if (!spend(g, 25)) return 'Not enough cash.';
          p.heal(100);
          return 'Grease is a medicine. Full health.';
        },
      },
      {
        label: 'Cafecito — top up 40 health',
        price: 9,
        can: game.cash >= 9 && p.hp < 100,
        run(g) {
          if (!spend(g, 9)) return 'Not enough cash.';
          p.heal(40);
          return 'Sweet, strong, gone.';
        },
      },
    ];
  }
  if (poi.kind === 'garage') {
    const items = GARAGE_STOCK.map((modelId) => {
      const def = MODELS[modelId];
      const owned = game.garage.includes(modelId);
      return {
        label: owned ? `${def.name} — in your garage (E to take out)` : `${def.name} — buy`,
        price: owned ? 0 : def.price,
        can: owned || game.cash >= def.price,
        run(g) {
          if (!owned && !spend(g, def.price)) return 'Not enough cash.';
          if (!owned) g.garage.push(modelId);
          return g.spawnGarageCar(modelId);
        },
      };
    });
    if (p.car) {
      items.push({
        label: `Store the ${p.car.def.name} here`,
        price: 0,
        can: true,
        run(g) {
          const model = p.car.model;
          if (!g.garage.includes(model)) g.garage.push(model);
          const car = p.leaveCar();
          if (car) car.parked = true;
          return 'Stored. It will be here when the night goes wrong.';
        },
      });
    }
    return items;
  }
  if (poi.kind === 'safehouse') {
    return [
      {
        label: 'Save the career (slot 1)',
        price: 0,
        can: true,
        run(g) { return g.saveTo(0) ? 'Saved. The city forgets nothing; now neither do you.' : 'Save failed — storage is off.'; },
      },
      {
        label: 'Sleep until golden hour',
        price: 0,
        can: true,
        run(g) {
          g.tod = 0.7;
          p.heal(100);
          g.police.heat = Math.max(0, g.police.heat - 150);
          return 'You wake to long shadows and a quieter radio.';
        },
      },
    ];
  }
  return [];
}

/** Which POIs open a shop, and how close Rio must stand. */
export const SHOP_KINDS = ['gunshop', 'spray', 'food', 'garage', 'safehouse'];

export function nearestShop(game, radius) {
  const p = game.player;
  let best = null;
  let bestD = radius;
  for (const poi of game.city.pois) {
    if (!SHOP_KINDS.includes(poi.kind)) continue;
    const d = Math.hypot(poi.x - p.x, poi.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = poi;
    }
  }
  return best;
}
