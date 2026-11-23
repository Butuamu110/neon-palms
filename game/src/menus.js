// NEON PALMS' screens: the title (giant display type over the living city, save slots
// underneath), the pause ledger, the help card, the shop front and the two ways a night
// ends early — WASTED in red, BUSTED in blue. The world keeps moving behind the title and
// the pause; only the shop and the endings freeze it.

import { FONT, FONT_DISPLAY, PALETTE, rankFor } from './config.js';
import { panel, wrapText } from './hud.js';
import { slotInfo } from './save.js';

export const SCREEN = {
  TITLE: 'title',
  PLAY: 'play',
  PAUSE: 'pause',
  MAP: 'map',
  SHOP: 'shop',
  HELP: 'help',
  OVER: 'over',
};

export function drawTitle(ctx, game) {
  const view = game.view;
  // Warm wash so the type sits on the golden hour, not against it.
  const grad = ctx.createLinearGradient(0, 0, 0, view.h);
  grad.addColorStop(0, 'rgba(20,6,28,0.55)');
  grad.addColorStop(0.55, 'rgba(20,6,28,0.18)');
  grad.addColorStop(1, 'rgba(20,6,28,0.66)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, view.w, view.h);

  const cx = view.w / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Palm fronds over the wordmark, drawn as strokes.
  ctx.strokeStyle = PALETTE.neonTeal;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  const px = cx;
  const py = view.h * 0.16;
  for (const a of [-2.6, -2.1, -1.55, -1.05, -0.5]) {
    ctx.beginPath();
    ctx.moveTo(px, py + 26);
    ctx.quadraticCurveTo(px + Math.cos(a) * 44, py + Math.sin(a) * 40, px + Math.cos(a) * 78, py + 26 + Math.sin(a) * 58);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(px, py + 26);
  ctx.lineTo(px - 4, py + 74);
  ctx.stroke();

  ctx.font = `900 118px ${FONT_DISPLAY}`;
  const titleGrad = ctx.createLinearGradient(0, view.h * 0.2, 0, view.h * 0.2 + 118);
  titleGrad.addColorStop(0, '#ffe9a8');
  titleGrad.addColorStop(0.5, '#ff8a5c');
  titleGrad.addColorStop(1, '#ff4fd8');
  ctx.fillStyle = titleGrad;
  ctx.fillText('NEON PALMS', cx, view.h * 0.2 + 66);
  ctx.font = `700 21px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('A SOLSTICE CREW STORY — PALMERA, GOLDEN HOUR', cx, view.h * 0.2 + 142);
  ctx.font = `italic 600 15px ${FONT}`;
  ctx.fillStyle = PALETTE.neonCyan;
  ctx.fillText('Fifteen jobs. Five stars. One crown.', cx, view.h * 0.2 + 170);

  // Menu.
  const items = game.titleItems;
  ctx.font = `800 25px ${FONT}`;
  items.forEach((item, i) => {
    const y = view.h * 0.52 + i * 44;
    const selected = game.menuIndex === i;
    if (selected) {
      ctx.fillStyle = 'rgba(255,79,216,0.85)';
      ctx.fillText('\u25B8', cx - ctx.measureText(item.label).width / 2 - 34, y);
    }
    ctx.fillStyle = selected ? '#ffffff' : 'rgba(245,238,252,0.62)';
    ctx.fillText(item.label, cx, y);
  });

  // Save slots strip.
  const infos = slotInfo();
  const slotW = 246;
  const total = slotW * 3 + 24;
  let sx = cx - total / 2;
  const sy = view.h - 148;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  infos.forEach((info, i) => {
    panel(ctx, sx, sy, slotW, 84, i === 0 ? PALETTE.gold : PALETTE.neonCyan);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `800 12px ${FONT}`;
    ctx.fillText(`SLOT ${i + 1}`, sx + 12, sy + 9);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 12.5px ${FONT}`;
    if (info) {
      ctx.fillText(`Story ${info.missionIndex}/15 · $${info.cash.toLocaleString('en-US')}`, sx + 12, sy + 30);
      ctx.fillText(`${info.rep} REP — ${rankFor(info.rep).name}`, sx + 12, sy + 49);
      ctx.fillText('L on the street, then ' + (i + 1) + ' — or save at the safehouse', sx + 12, sy + 66);
    } else {
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText('Empty. The safehouse saves here.', sx + 12, sy + 34);
    }
    sx += slotW + 12;
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(245,238,252,0.75)';
  ctx.font = `600 14px ${FONT}`;
  ctx.fillText('WASD drive & walk · E take / talk · F or mouse fire · M map · P ledger · R radio · B shop', cx, view.h - 34);
}

export function drawPause(ctx, game) {
  const view = game.view;
  ctx.fillStyle = 'rgba(7,4,16,0.72)';
  ctx.fillRect(0, 0, view.w, view.h);
  const w = 620;
  const h = 520;
  const x = (view.w - w) / 2;
  const y = (view.h - h) / 2;
  panel(ctx, x, y, w, h, PALETTE.gold);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `900 34px ${FONT_DISPLAY}`;
  ctx.fillText('THE LEDGER', x + 26, y + 20);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `italic 600 14px ${FONT}`;
  ctx.fillText('Rio C\u00e1rdenas, paused mid-breath. Palmera waits.', x + 26, y + 62);
  const s = game.stats;
  const rows = [
    ['STORY', `${game.missions.index}/15 jobs — ${Math.round((game.missions.index / 15) * 100)}% complete`],
    ['CASH', `$${game.cash.toLocaleString('en-US')} (earned $${s.earned.toLocaleString('en-US')} all told)`],
    ['RESPECT', `${game.rep} REP — ${rankFor(game.rep).name}`],
    ['TIME IN PALMERA', `${Math.floor(s.timePlayed / 60)}m ${Math.floor(s.timePlayed % 60)}s`],
    ['DISTANCE', `${(s.distance / 1000).toFixed(1)} km driven, ${(s.distanceFoot / 1000).toFixed(1)} km on foot`],
    ['JOBS', `${s.jobsDone} done of ${s.jobsTaken} taken`],
    ['CARS TAKEN', String(s.carsTaken)],
    ['SHOTS FIRED', String(s.shotsFired)],
    ['BUSTED / WASTED', `${s.busts} / ${s.wasteds}`],
    ['GARAGE', game.garage.length ? game.garage.join(', ') : 'empty'],
  ];
  ctx.font = `600 15px ${FONT}`;
  rows.forEach(([label, value], i) => {
    const ry = y + 102 + i * 30;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(label, x + 26, ry);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 15px ${FONT}`;
    ctx.fillText(value, x + 190, ry);
    ctx.font = `600 15px ${FONT}`;
  });
  ctx.fillStyle = PALETTE.neonCyan;
  ctx.font = `italic 600 13.5px ${FONT}`;
  const lines = wrapText(ctx, 'F5 quick-saves to slot 1. The Safehouse Brisa saves and sleeps. Spray & Pay cools a two-star trail with fresh paint.', w - 52);
  lines.forEach((line, i) => ctx.fillText(line, x + 26, y + h - 66 + i * 19));
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 15px ${FONT}`;
  ctx.fillText('ESC / P — back to the street', x + 26, y + h - 28);
}

export function drawHelp(ctx, game) {
  const view = game.view;
  ctx.fillStyle = 'rgba(7,4,16,0.8)';
  ctx.fillRect(0, 0, view.w, view.h);
  const w = 640;
  const h = 470;
  const x = (view.w - w) / 2;
  const y = (view.h - h) / 2;
  panel(ctx, x, y, w, h, PALETTE.neonCyan);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = PALETTE.neonCyan;
  ctx.font = `900 30px ${FONT_DISPLAY}`;
  ctx.fillText('HOW TO PLAY PALMERA', x + 26, y + 20);
  const rows = [
    ['W A S D', 'Walk / drive'],
    ['SHIFT', 'Sprint on foot'],
    ['SPACE', 'Handbrake — swing the tail out'],
    ['E', 'Enter / steal a car · talk · take a job'],
    ['F or MOUSE', 'Fire the selected weapon'],
    ['1 – 5', 'Weapon slots (buy the locked ones at Ammu-Palmera)'],
    ['B', 'Shop, when you are at the door'],
    ['M', 'Full city map + career ledger'],
    ['P or ESC', 'Pause — the Ledger'],
    ['R', 'Next radio station'],
    ['F5', 'Quick save (slot 1)'],
  ];
  ctx.font = `600 15.5px ${FONT}`;
  rows.forEach(([key, what], i) => {
    const ry = y + 76 + i * 31;
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `800 15.5px ${FONT}`;
    ctx.fillText(key, x + 26, ry);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 15.5px ${FONT}`;
    ctx.fillText(what, x + 170, ry);
  });
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `italic 600 13.5px ${FONT}`;
  ctx.fillText('Heat fades fastest when no unit can see you. Fresh paint helps. So does the sea road.', x + 26, y + h - 30);
}

export function drawShop(ctx, game) {
  const view = game.view;
  const shop = game.shop;
  if (!shop) return;
  ctx.fillStyle = 'rgba(7,4,16,0.55)';
  ctx.fillRect(0, 0, view.w, view.h);
  const w = 560;
  const rowH = 44;
  const h = 118 + shop.items.length * rowH + 46;
  const x = (view.w - w) / 2;
  const y = (view.h - h) / 2;
  panel(ctx, x, y, w, h, PALETTE.neonTeal);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = PALETTE.neonTeal;
  ctx.font = `900 26px ${FONT_DISPLAY}`;
  ctx.fillText(shop.poi.name.toUpperCase(), x + 22, y + 16);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `800 17px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(`$${game.cash.toLocaleString('en-US')}`, x + w - 22, y + 20);
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `italic 600 13px ${FONT}`;
  ctx.fillText(shopBlurb(shop.poi.kind), x + 22, y + 50);
  shop.items.forEach((item, i) => {
    const ry = y + 84 + i * rowH;
    const selected = game.shopIndex === i;
    if (selected) {
      ctx.fillStyle = 'rgba(79,227,193,0.16)';
      ctx.fillRect(x + 10, ry - 5, w - 20, rowH - 4);
    }
    ctx.fillStyle = item.can ? PALETTE.text : 'rgba(245,238,252,0.4)';
    ctx.font = `700 16px ${FONT}`;
    ctx.fillText(item.label, x + 22, ry + 6);
    ctx.textAlign = 'right';
    ctx.fillStyle = item.price > 0 ? PALETTE.gold : PALETTE.good;
    ctx.fillText(item.price > 0 ? `$${item.price.toLocaleString('en-US')}` : 'FREE', x + w - 22, ry + 6);
    ctx.textAlign = 'left';
  });
  ctx.fillStyle = PALETTE.neonCyan;
  ctx.font = `italic 600 13.5px ${FONT}`;
  ctx.fillText(shop.message || 'W/S choose · E buy · ESC leave', x + 22, y + h - 32);
}

function shopBlurb(kind) {
  if (kind === 'gunshop') return 'Cash only. No names. The slots you are missing live here.';
  if (kind === 'spray') return 'Panels, paint, and a short memory for your old colour.';
  if (kind === 'food') return 'Grease, sugar, cafecito. Health comes back one bite at a time.';
  if (kind === 'garage') return 'Paz keeps the keys. Buy once, take out whenever.';
  if (kind === 'safehouse') return 'A bed, a shower, a save point and a quieter radio.';
  return '';
}

export function drawOver(ctx, game) {
  const view = game.view;
  const busted = game.overKind === 'busted';
  ctx.fillStyle = busted ? 'rgba(8,10,40,0.66)' : 'rgba(40,4,8,0.66)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 104px ${FONT_DISPLAY}`;
  ctx.fillStyle = busted ? PALETTE.policeBlue : PALETTE.danger;
  ctx.fillText(busted ? 'BUSTED' : 'WASTED', view.w / 2, view.h * 0.42);
  ctx.font = `600 19px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(busted ? 'Interdiction keeps $400 and your dignity. You walk out of Palmera PD HQ.' : 'Hospital Coral patches Rio up and keeps $350 for the trouble.', view.w / 2, view.h * 0.42 + 78);
  ctx.font = `800 16px ${FONT}`;
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText('ENTER — back to the street', view.w / 2, view.h * 0.42 + 118);
}
