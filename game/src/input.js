// Keyboard, mouse and touch input for NEON PALMS. Held keys are read as a live state (steering,
// walking, firing); one-shot presses (interact, map, pause, weapon slots, menu confirm) are
// queued and taken once by the loop, so a press between frames is never lost or doubled.
// The virtual key layer lets the autopilot press the same keys a human would.

export const ACT = {
  CONFIRM: 1,
  INTERACT: 2,
  PAUSE: 4,
  MAP: 8,
  STATS: 16,
  RADIO: 32,
  SAVE: 64,
  SHOP: 128,
};

const HELD = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  handbrake: ['Space'],
  fire: ['KeyF'],
};

const PRESS = {
  [ACT.CONFIRM]: ['Enter'],
  [ACT.INTERACT]: ['KeyE'],
  [ACT.PAUSE]: ['Escape', 'KeyP'],
  [ACT.MAP]: ['KeyM'],
  [ACT.STATS]: ['Tab'],
  [ACT.RADIO]: ['KeyR'],
  [ACT.SAVE]: ['F5'],
  [ACT.SHOP]: ['KeyB'],
};

const WEAPON_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];

export function createInput(canvas) {
  const down = new Set();
  const virtual = new Set();
  let actions = 0;
  let weaponPress = 0;
  const mouse = { x: 0, y: 0, down: false, inside: false };

  function codeHeld(map, name) {
    for (const code of map[name]) if (down.has(code) || virtual.has(code)) return true;
    return false;
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
    if (!event.repeat) {
      down.add(event.code);
      for (const flag of Object.keys(PRESS)) {
        if (PRESS[flag].includes(event.code)) actions |= Number(flag);
      }
      const wi = WEAPON_KEYS.indexOf(event.code);
      if (wi >= 0) weaponPress = wi + 1;
      if (event.code === 'Space') actions |= ACT.CONFIRM;
    }
  });
  window.addEventListener('keyup', (event) => {
    down.delete(event.code);
  });
  window.addEventListener('blur', () => {
    down.clear();
    mouse.down = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    mouse.inside = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouse.down = true;
    if (event.button === 0) actions |= ACT.CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });

  return {
    mouse,
    /** Live driving/walking state, merged from real and virtual keys. */
    held: {
      get up() { return codeHeld(HELD, 'up'); },
      get down() { return codeHeld(HELD, 'down'); },
      get left() { return codeHeld(HELD, 'left'); },
      get right() { return codeHeld(HELD, 'right'); },
      get sprint() { return codeHeld(HELD, 'sprint'); },
      get handbrake() { return codeHeld(HELD, 'handbrake'); },
      get fire() { return codeHeld(HELD, 'fire') || mouse.down; },
    },
    /** -1..1 steering from the held keys. */
    steer() {
      return (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0);
    },
    /** -1..1 throttle from the held keys. */
    throttle() {
      return (this.held.up ? 1 : 0) - (this.held.down ? 1 : 0);
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Weapon slot pressed since last call (1..5), or 0. */
    takeWeapon() {
      const taken = weaponPress;
      weaponPress = 0;
      return taken;
    },
    /** Autopilot/testing hook: hold or release a key code virtually. */
    setVirtual(code, isDown) {
      if (isDown) virtual.add(code);
      else virtual.delete(code);
    },
    pressVirtual(code) {
      for (const flag of Object.keys(PRESS)) {
        if (PRESS[flag].includes(code)) actions |= Number(flag);
      }
      if (code === 'Space') actions |= ACT.CONFIRM;
    },
    clearVirtual() {
      virtual.clear();
    },
  };
}
