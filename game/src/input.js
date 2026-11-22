// NEON PALMS — keyboard input. Real keys and autopilot virtual keys merge into one set.
export const keys = {};
export const vkeys = {};   // written by autopilot / shot staging
let pressedHandlers = [];

export function initInput() {
  addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
    if (!keys[e.code]) for (const h of pressedHandlers) h(e.code);
    keys[e.code] = true;
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
}
export function onPress(fn) { pressedHandlers.push(fn); }
export function down(code) { return !!(keys[code] || vkeys[code]); }
export function axis() {
  return {
    fwd: down('KeyW') || down('ArrowUp'),
    back: down('KeyS') || down('ArrowDown'),
    left: down('KeyA') || down('ArrowLeft'),
    right: down('KeyD') || down('ArrowRight'),
    sprint: down('ShiftLeft') || down('ShiftRight'),
    brake: down('Space'),
  };
}
export function clearVirtual() { for (const k in vkeys) delete vkeys[k]; }
