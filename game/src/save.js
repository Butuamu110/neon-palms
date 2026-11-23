// Save slots for NEON PALMS: three slots in localStorage holding the career — cash, respect,
// story progress, garage, statistics and where Rio was standing. Saving is explicit (the
// safehouse, or F5) so a bust never quietly overwrites a good run.

import { SAVE_KEY } from './config.js';

const SLOTS = 3;

function readAll() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return [null, null, null];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [null, null, null];
    const out = [null, null, null];
    for (let i = 0; i < SLOTS; i += 1) out[i] = parsed[i] ?? null;
    return out;
  } catch {
    return [null, null, null];
  }
}

function writeAll(slots) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(slots));
    return true;
  } catch {
    return false;
  }
}

/** A plain-data snapshot of everything a slot remembers. */
export function snapshot(game) {
  const p = game.player;
  return {
    version: 1,
    when: new Date().toISOString(),
    cash: game.cash,
    rep: game.rep,
    missionIndex: game.missions.index,
    tod: game.tod,
    player: { x: Math.round(p.x), y: Math.round(p.y), angle: p.angle },
    weapons: game.player.weapons.map((w) => ({ id: w.id, ammo: w.ammo })),
    garage: game.garage.slice(),
    stats: { ...game.stats },
  };
}

export function saveSlot(game, slot) {
  if (slot < 0 || slot >= SLOTS) return false;
  const slots = readAll();
  slots[slot] = snapshot(game);
  return writeAll(slots);
}

export function loadSlot(game, slot) {
  const data = readAll()[slot];
  if (!data) return false;
  game.cash = data.cash | 0;
  game.rep = data.rep | 0;
  game.missions.index = Math.min(data.missionIndex | 0, game.missions.list.length);
  game.tod = typeof data.tod === 'number' ? data.tod : game.tod;
  const p = game.player;
  p.x = data.player.x;
  p.y = data.player.y;
  p.angle = data.player.angle || 0;
  p.leaveCar();
  for (const saved of data.weapons || []) {
    const owned = p.weapons.find((w) => w.id === saved.id);
    if (owned) owned.ammo = saved.ammo;
  }
  game.garage = Array.isArray(data.garage) ? data.garage.slice() : [];
  Object.assign(game.stats, data.stats || {});
  return true;
}

/** Slot summaries for the menu: null for empty, else {when, missionIndex, cash, rep}. */
export function slotInfo() {
  return readAll().map((slot) => {
    if (!slot) return null;
    return {
      when: slot.when,
      missionIndex: slot.missionIndex | 0,
      cash: slot.cash | 0,
      rep: slot.rep | 0,
    };
  });
}

export function wipeSlot(slot) {
  const slots = readAll();
  if (slot < 0 || slot >= SLOTS) return;
  slots[slot] = null;
  writeAll(slots);
}
