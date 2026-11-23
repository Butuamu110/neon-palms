// NEON PALMS boot and the one loop. The world advances in fixed 1/60 s steps; input actions
// are routed by screen — the street gets the driving keys, the title gets its menu, the
// shop its till. Three special modes share this file: ?shot=<name>&seed=N stages one of the
// four screenshot scenes and freezes it for the camera; ?autopilot=1 lets the virtual
// driver play mission 1 through the real input path; anything else is the game itself.

import { RADIO, STEP } from './config.js';
import { createInput, ACT } from './input.js';
import { createAudio } from './audio.js';
import { createGame } from './world.js';
import { createRenderer } from './render.js';
import { drawHud } from './hud.js';
import { drawMinimap, drawBigMap } from './minimap.js';
import { drawTitle, drawPause, drawHelp, drawShop, drawOver } from './menus.js';
import { catalogFor } from './economy.js';
import { loadSlot, slotInfo } from './save.js';
import { stageShot } from './shots.js';
import { createAutopilot } from './autopilot.js';

window.__errors = [];
window.addEventListener('error', (event) => {
  window.__errors.push(String(event.message || event.error || 'unknown'));
});

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const autopilotMode = params.get('autopilot') === '1';
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const input = createInput(canvas);
const audio = createAudio();
const renderer = createRenderer(canvas);
const ctx = renderer.ctx;

let game = null;
function wireGame() {
  game.grainCanvas = renderer.grain;
  game.view = renderer.view;
}
function freshGame() {
  game = createGame(seed, input, audio);
  window.__neonPalms = game; // diagnostics handle: lets a headless run inspect live state
  wireGame();
  game.screen = shot || autopilotMode ? 'play' : 'title';
  buildTitleItems();
}
function buildTitleItems() {
  const infos = slotInfo();
  const items = [];
  const savedSlot = infos.findIndex((info) => info !== null);
  if (savedSlot >= 0) {
    items.push({ label: `CONTINUE — SLOT ${savedSlot + 1}`, act: () => { loadSlot(game, savedSlot); game.screen = 'play'; } });
  }
  items.push({ label: 'NEW GAME — RIO\u2019S STORY', act: () => { freshGame(); game.screen = 'play'; } });
  items.push({ label: 'HOW TO PLAY', act: () => { game.screen = 'help'; } });
  items.push({ label: audio.muted ? 'SOUND: OFF' : 'SOUND: ON', act: () => { audio.setMuted(!audio.muted); buildTitleItems(); } });
  game.titleItems = items;
  if (game.menuIndex >= items.length) game.menuIndex = 0;
}
freshGame();

let autopilot = null;
if (autopilotMode) autopilot = createAutopilot(game);

// Menu navigation that the action queue does not cover: W/S and the arrows move a cursor.
window.addEventListener('keydown', (event) => {
  audio.unlock();
  if (game.screen === 'title') {
    if (event.code === 'KeyW' || event.code === 'ArrowUp') {
      game.menuIndex = (game.menuIndex + game.titleItems.length - 1) % game.titleItems.length;
      audio.uiMove();
    } else if (event.code === 'KeyS' || event.code === 'ArrowDown') {
      game.menuIndex = (game.menuIndex + 1) % game.titleItems.length;
      audio.uiMove();
    }
  } else if (game.screen === 'shop' && game.shop) {
    if (event.code === 'KeyW' || event.code === 'ArrowUp') {
      game.shopIndex = (game.shopIndex + game.shop.items.length - 1) % game.shop.items.length;
      audio.uiMove();
    } else if (event.code === 'KeyS' || event.code === 'ArrowDown') {
      game.shopIndex = (game.shopIndex + 1) % game.shop.items.length;
      audio.uiMove();
    }
  }
});
window.addEventListener('pointerdown', () => audio.unlock(), { once: false });

function announce(text) {
  status.textContent = text;
}

function handleActions() {
  const actions = input.takeActions();
  const weapon = input.takeWeapon();
  const screen = game.screen;
  if (screen === 'title') {
    if (actions & ACT.CONFIRM) {
      audio.uiPick();
      const item = game.titleItems[game.menuIndex];
      if (item) item.act();
    }
    return;
  }
  if (screen === 'help') {
    if (actions & (ACT.CONFIRM | ACT.PAUSE)) game.screen = 'title';
    return;
  }
  if (screen === 'over') {
    if (actions & ACT.CONFIRM) game.respawn();
    return;
  }
  if (screen === 'pause') {
    if (actions & (ACT.PAUSE | ACT.CONFIRM)) game.screen = 'play';
    return;
  }
  if (screen === 'map') {
    if (actions & (ACT.MAP | ACT.PAUSE | ACT.CONFIRM)) game.screen = 'play';
    return;
  }
  if (screen === 'shop') {
    if (actions & ACT.PAUSE) {
      game.screen = 'play';
      game.shop = null;
      return;
    }
    if ((actions & (ACT.CONFIRM | ACT.INTERACT)) && game.shop) {
      const item = game.shop.items[game.shopIndex];
      if (item) {
        game.shop.message = item.run(game) || '';
        game.shop.items = catalogFor(game.shop.poi, game);
        if (game.shopIndex >= game.shop.items.length) game.shopIndex = game.shop.items.length - 1;
      }
    }
    return;
  }
  // Play.
  if (weapon && !game.player.car) {
    if (!game.player.selectWeapon(weapon - 1)) audio.dryFire();
  }
  if (actions & ACT.INTERACT) game.tryInteract();
  else if (actions & ACT.SHOP) game.tryShop();
  if (actions & ACT.MAP) game.screen = 'map';
  else if (actions & (ACT.PAUSE | ACT.STATS)) game.screen = 'pause';
  if (actions & ACT.RADIO) {
    game.radioIndex = (game.radioIndex + 1) % RADIO.length;
    game.radioStation = RADIO[game.radioIndex];
    if (game.player.car) audio.radio(game.radioIndex, true);
  }
  if (actions & ACT.SAVE) {
    const ok = game.saveTo(0);
    game.showDialogue([{ who: 'RIO', text: ok ? '(Saved — slot 1.)' : '(The save failed. Storage is off.)' }]);
  }
}

function draw() {
  renderer.draw(game);
  const screen = game.screen;
  if (screen === 'play') {
    drawMinimap(ctx, game, 18, game.view.h - 198, 192);
    drawHud(ctx, game);
  } else if (screen === 'title') drawTitle(ctx, game);
  else if (screen === 'pause') drawPause(ctx, game);
  else if (screen === 'map') drawBigMap(ctx, game);
  else if (screen === 'shop') {
    drawMinimap(ctx, game, 18, game.view.h - 198, 192);
    drawHud(ctx, game);
    drawShop(ctx, game);
  } else if (screen === 'help') drawHelp(ctx, game);
  else if (screen === 'over') drawOver(ctx, game);
}

if (shot) {
  const screen = stageShot(shot, game);
  game.screen = screen;
  // Paint synchronously, twice: headless capture pipelines composite the frame the main
  // thread settles on, and a staged scene has no next frame coming to wait for.
  draw();
  draw();
  window.__shotReady = true;
  announce(`NEON PALMS scene ${shot} staged. Errors: ${window.__errors.length}`);
  requestAnimationFrame(() => draw());
} else {
  let accumulator = 0;
  let last = performance.now();
  const frame = (now) => {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, 0.25);
    last = now;
    handleActions();
    while (accumulator >= STEP) {
      game.time += STEP;
      game.update(STEP);
      if (autopilot) autopilot.tick();
      accumulator -= STEP;
    }
    draw();
  };
  requestAnimationFrame(frame);
  announce('NEON PALMS. A Solstice Crew story.');
}
