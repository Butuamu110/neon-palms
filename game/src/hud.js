// The NEON PALMS HUD: everything the player reads while the city moves. Top-left the JOB
// panel (mission, stage, progress bar, next hint). Top-right the money, the respect rank
// and the wanted stars; under them, while the heat is on, the PD dispatch panel — live
// callsigns, roles, distances and sight status, with the dispatcher's last line of chatter.
// Bottom-right the vehicle panel or the weapon strip; bottom-centre the dialogue box; dead
// centre, when a job lands, the MISSION PASSED banner with its money and respect.

import { FONT, FONT_DISPLAY, PALETTE, rankFor, nextRank } from './config.js';
import { weaponById } from './combat.js';

export function panel(ctx, x, y, w, h, edge) {
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = edge || PALETTE.panelEdge;
  ctx.lineWidth = 1.6;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = edge || PALETTE.panelEdge;
  ctx.fillRect(x, y, 4, h);
}

export function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const trial = line ? line + ' ' + word : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = trial;
  }
  if (line) lines.push(line);
  return lines;
}

function fmtCash(n) {
  return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function drawHud(ctx, game) {
  const view = game.view;
  drawMissionPanel(ctx, game);
  drawWallet(ctx, game, view);
  if (game.police.stars > 0 || game.police.feed.length > 0) drawDispatch(ctx, game, view);
  drawStatus(ctx, game, view);
  if (game.player.car) drawVehiclePanel(ctx, game, view);
  else drawWeaponStrip(ctx, game, view);
  if (game.dialogue) drawDialogue(ctx, game, view);
  if (game.prompt) drawPrompt(ctx, game, view);
  if (game.police.bust > 0.15) drawBustMeter(ctx, game, view);
  if (game.banner) drawBanner(ctx, game, view);
  if (game.hurtFlash > 0.02) drawHurt(ctx, game, view);
}

function drawMissionPanel(ctx, game) {
  const info = game.missions.progress();
  const x = 18;
  const y = 18;
  const w = 342;
  ctx.font = `600 13px ${FONT}`;
  const stageLines = wrapText(ctx, info.stage, w - 28).slice(0, 2);
  // Wrap the NEXT teaser WITH its prefix, in the exact font it will be drawn in: wrapping
  // the bare teaser and prefixing afterwards overflows the panel's right edge.
  ctx.font = `italic 600 12px ${FONT}`;
  const nextLines = info.next ? wrapText(ctx, 'NEXT: ' + info.next, w - 28).slice(0, 2) : [];
  const h = 92 + stageLines.length * 17 + nextLines.length * 14;
  panel(ctx, x, y, w, h, PALETTE.gold);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `700 13px ${FONT}`;
  ctx.fillText(info.job, x + 14, y + 10);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 19px ${FONT}`;
  ctx.fillText(info.title.toUpperCase(), x + 14, y + 28);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 13px ${FONT}`;
  stageLines.forEach((line, i) => ctx.fillText(line, x + 14, y + 54 + i * 17));
  // Stage progress bar.
  const barY = y + 56 + stageLines.length * 17;
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(x + 14, barY, w - 28, 5);
  ctx.fillStyle = PALETTE.neonPink;
  ctx.fillRect(x + 14, barY, (w - 28) * Math.max(0, Math.min(1, info.frac)), 5);
  if (nextLines.length) {
    ctx.fillStyle = PALETTE.neonCyan;
    ctx.font = `italic 600 12px ${FONT}`;
    nextLines.forEach((line, i) => ctx.fillText(line, x + 14, barY + 9 + i * 14));
  }
}

function drawWallet(ctx, game, view) {
  const x = view.w - 18;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText(fmtCash(game.cash), x, 14);
  const rank = rankFor(game.rep);
  const next = nextRank(game.rep);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `700 13px ${FONT}`;
  ctx.fillText(`REP ${game.rep} — ${rank.name}${next ? ` · ${next.at - game.rep} to ${next.name}` : ''}`, x, 50);
  // Wanted stars: filled gold while seen, hollow while the trail cools.
  const stars = game.police.stars;
  if (stars > 0) {
    const flash = game.police.seen && Math.floor(game.time * 3) % 2 === 0;
    ctx.font = `26px ${FONT}`;
    for (let i = 0; i < 5; i += 1) {
      const sx = x - (4 - i) * 30;
      if (i < stars) {
        ctx.fillStyle = flash ? PALETTE.danger : PALETTE.gold;
        ctx.fillText('\u2605', sx, 72);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillText('\u2606', sx, 72);
      }
    }
  }
}

function drawDispatch(ctx, game, view) {
  const feed = game.police.feed;
  const w = 318;
  const rowH = 21;
  const hasChatter = game.police.chatterTimer > 0 && game.police.chatterLine;
  const h = 40 + Math.max(1, feed.length) * rowH + (hasChatter ? 34 : 8);
  const x = view.w - 18 - w;
  const y = 112;
  panel(ctx, x, y, w, h, PALETTE.policeBlue);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.policeBlue;
  ctx.font = `800 13px ${FONT}`;
  ctx.fillText('PALMERA PD — DISPATCH', x + 14, y + 8);
  ctx.fillStyle = game.police.seen ? PALETTE.danger : PALETTE.gold;
  ctx.font = `700 11px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(game.police.seen ? 'EYES ON YOU' : 'TRAIL COLD', x + w - 12, y + 9);
  ctx.textAlign = 'left';
  if (feed.length === 0) {
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText('Units standing by…', x + 14, y + 32);
  }
  feed.forEach((row, i) => {
    const ry = y + 32 + i * rowH;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 13px ${FONT}`;
    ctx.fillText(row.sign, x + 14, ry);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 11px ${FONT}`;
    ctx.fillText(row.role, x + 104, ry + 2);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 12px ${FONT}`;
    ctx.fillText(`${row.dist}m`, x + 196, ry + 1);
    ctx.fillStyle = row.status === 'IN SIGHT' ? PALETTE.danger : row.status === 'SEARCHING' ? PALETTE.gold : row.status === 'EN ROUTE' ? PALETTE.neonCyan : PALETTE.muted;
    ctx.font = `800 11px ${FONT}`;
    ctx.fillText(row.status, x + 240, ry + 2);
  });
  if (hasChatter) {
    ctx.fillStyle = PALETTE.neonCyan;
    ctx.font = `italic 600 12px ${FONT}`;
    const lines = wrapText(ctx, '"' + game.police.chatterLine + '"', w - 28).slice(0, 2);
    lines.forEach((line, i) => ctx.fillText(line, x + 14, y + 36 + feed.length * rowH + i * 15));
  }
}

function drawStatus(ctx, game, view) {
  const p = game.player;
  const w = 218;
  const x = view.w - 18 - w;
  const y = view.h - 148;
  // Health and armour bars ride above the vehicle/weapon cluster.
  bar(ctx, x, y, w, 13, p.hp / 100, PALETTE.danger, `HP ${Math.ceil(p.hp)}`);
  bar(ctx, x, y + 18, w, 13, p.armor / 100, PALETTE.neonCyan, `ARMOR ${Math.ceil(p.armor)}`);
}

function bar(ctx, x, y, w, h, frac, color, label) {
  ctx.fillStyle = 'rgba(10,6,20,0.72)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, (w - 2) * Math.max(0, Math.min(1, frac)), h - 2);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 10px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 6, y + h / 2 + 0.5);
}

function drawVehiclePanel(ctx, game, view) {
  const car = game.player.car;
  const w = 218;
  const h = 74;
  const x = view.w - 18 - w;
  const y = view.h - 18 - h;
  panel(ctx, x, y, w, h, PALETTE.neonTeal);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 15px ${FONT}`;
  ctx.fillText(car.def.name.toUpperCase(), x + 12, y + 8);
  ctx.fillStyle = PALETTE.neonTeal;
  ctx.font = `800 24px ${FONT}`;
  ctx.fillText(`${Math.abs(Math.round((car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle)) * 0.36))}`, x + 12, y + 30);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `700 12px ${FONT}`;
  ctx.fillText('km/h', x + 62, y + 40);
  // Damage bar.
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(x + 96, y + 38, w - 108, 8);
  ctx.fillStyle = car.health > 45 ? PALETTE.good : PALETTE.danger;
  ctx.fillRect(x + 96, y + 38, (w - 108) * (car.health / 100), 8);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 10px ${FONT}`;
  ctx.fillText('BODY', x + 96, y + 26);
  // Radio line.
  const station = game.radioStation;
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `italic 600 11px ${FONT}`;
  ctx.fillText(`\u266A ${station.name} — ${station.tag}`, x + 12, y + 58);
}

function drawWeaponStrip(ctx, game, view) {
  const p = game.player;
  const slotW = 62;
  const slotH = 56;
  const gap = 6;
  const total = slotW * 5 + gap * 4;
  const x = view.w - 18 - total;
  const y = view.h - 18 - slotH;
  for (let i = 0; i < 5; i += 1) {
    const slot = p.weapons[i];
    const def = weaponById(slot.id);
    const sx = x + i * (slotW + gap);
    const selected = p.weaponIdx === i;
    ctx.fillStyle = selected ? 'rgba(255,79,216,0.25)' : 'rgba(12,8,24,0.78)';
    ctx.fillRect(sx, y, slotW, slotH);
    ctx.strokeStyle = selected ? PALETTE.neonPink : slot.owned ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)';
    ctx.lineWidth = selected ? 2 : 1;
    ctx.strokeRect(sx + 0.5, y + 0.5, slotW - 1, slotH - 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = slot.owned ? PALETTE.muted : 'rgba(255,255,255,0.25)';
    ctx.font = `700 10px ${FONT}`;
    ctx.fillText(String(i + 1), sx + 5, y + 4);
    ctx.fillStyle = slot.owned ? PALETTE.text : 'rgba(255,255,255,0.3)';
    ctx.font = `700 10.5px ${FONT}`;
    const name = def.name.split(' ')[0];
    ctx.fillText(name.toUpperCase(), sx + 5, y + 20);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `700 11px ${FONT}`;
    ctx.fillText(slot.id === 'fists' ? '—' : slot.owned ? String(slot.ammo) : 'LOCKED', sx + 5, y + 37);
  }
}

function drawDialogue(ctx, game, view) {
  const d = game.dialogue;
  const w = Math.min(680, view.w - 360);
  const x = (view.w - w) / 2;
  const y = view.h - 118;
  ctx.font = `600 15px ${FONT}`;
  const lines = wrapText(ctx, d.text, w - 30).slice(0, 3);
  const h = 34 + lines.length * 20;
  panel(ctx, x, y, w, h, PALETTE.neonPink);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.neonPink;
  ctx.font = `800 12px ${FONT}`;
  ctx.fillText(d.who, x + 15, y + 8);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `600 15px ${FONT}`;
  lines.forEach((line, i) => ctx.fillText(line, x + 15, y + 27 + i * 20));
}

function drawPrompt(ctx, game, view) {
  ctx.font = `700 15px ${FONT}`;
  const text = game.prompt;
  const w = ctx.measureText(text).width + 34;
  const x = (view.w - w) / 2;
  const y = view.h - 168;
  ctx.fillStyle = 'rgba(12,8,24,0.85)';
  ctx.fillRect(x, y, w, 32);
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 31);
  ctx.fillStyle = PALETTE.gold;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, view.w / 2, y + 17);
}

function drawBustMeter(ctx, game, view) {
  const w = 300;
  const x = (view.w - w) / 2;
  const y = 22;
  ctx.fillStyle = 'rgba(12,8,24,0.8)';
  ctx.fillRect(x, y, w, 30);
  ctx.fillStyle = PALETTE.policeRed;
  ctx.fillRect(x + 2, y + 2, (w - 4) * Math.min(1, game.police.bust / 2.4), 26);
  ctx.fillStyle = '#fff';
  ctx.font = `800 15px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BUSTED…', view.w / 2, y + 16);
}

function drawBanner(ctx, game, view) {
  const b = game.banner;
  const t = b.t;
  const alpha = t < 0.25 ? t / 0.25 : t > b.dur - 0.6 ? Math.max(0, (b.dur - t) / 0.6) : 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  const cx = view.w / 2;
  const cy = view.h * 0.3;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Backing wash.
  const grad = ctx.createLinearGradient(0, cy - 74, 0, cy + 84);
  grad.addColorStop(0, 'rgba(10,5,20,0)');
  grad.addColorStop(0.5, 'rgba(10,5,20,0.78)');
  grad.addColorStop(1, 'rgba(10,5,20,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, cy - 74, view.w, 158);
  ctx.font = `900 ${b.title === 'MISSION PASSED' ? 64 : 52}px ${FONT_DISPLAY}`;
  const titleGrad = ctx.createLinearGradient(0, cy - 34, 0, cy + 30);
  titleGrad.addColorStop(0, '#fff3c4');
  titleGrad.addColorStop(0.55, PALETTE.gold);
  titleGrad.addColorStop(1, '#e07b39');
  ctx.fillStyle = b.title === 'MISSION PASSED' ? titleGrad : PALETTE.danger;
  ctx.fillText(b.title, cx, cy - 8);
  ctx.font = `700 20px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(b.sub || '', cx, cy + 34);
  if (b.pay > 0 || b.rep > 0) {
    ctx.font = `800 24px ${FONT}`;
    ctx.fillStyle = PALETTE.good;
    ctx.fillText(`+$${b.pay.toLocaleString('en-US')}    +${b.rep} REP`, cx, cy + 66);
  }
  ctx.restore();
}

function drawHurt(ctx, game, view) {
  const a = Math.min(0.32, game.hurtFlash * 0.32);
  const grad = ctx.createRadialGradient(view.w / 2, view.h / 2, view.h * 0.36, view.w / 2, view.h / 2, view.h * 0.75);
  grad.addColorStop(0, 'rgba(255,30,40,0)');
  grad.addColorStop(1, `rgba(255,30,40,${a})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, view.w, view.h);
}
