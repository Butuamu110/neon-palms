// NEON PALMS' painter: a top-down Palmera with long golden-hour shadows, neon that spills
// onto wet asphalt, a beach that shimmers and a sea that moves. The static city is drawn
// fresh each frame with hard viewport culling (it is all rectangles and arcs), then cars,
// crowds, the helicopter and its searchlight, then the light itself: headlight cones,
// streetlight pools, the warm grade of the hour and a breath of film grain to finish.

import { BEACH, GRID, PALETTE, WORLD } from './config.js';
import { avenueX, blockX, blockY, streetY } from './city.js';
import { drawCar, hexA, shade } from './vehicles.js';
import { drawPed } from './peds.js';
import { valueNoise } from './rng.js';

export const SCREEN = { TITLE: 'title', PLAY: 'play', PAUSED: 'pause', MAP: 'map', SHOP: 'shop', HELP: 'help', OVER: 'over' };

/** How dark and how warm the hour is: keyframed over tod in [0, 1]. */
export function lightingAt(tod) {
  const keys = [
    [0.0, 0.25, 0.1], [0.45, 0.0, 0.0], [0.62, 0.06, 0.35], [0.7, 0.16, 0.85],
    [0.78, 0.42, 0.7], [0.85, 0.78, 0.25], [0.93, 0.92, 0.05], [1.0, 0.6, 0.1],
  ];
  let a = keys[0];
  let b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (tod >= keys[i][0] && tod <= keys[i + 1][0]) {
      a = keys[i];
      b = keys[i + 1];
      break;
    }
  }
  const t = b[0] === a[0] ? 0 : (tod - a[0]) / (b[0] - a[0]);
  return { dark: a[1] + (b[1] - a[1]) * t, warm: a[2] + (b[2] - a[2]) * t };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { w: 1280, h: 960 };
  // Film grain: one 256px noise tile, re-drawn at shifting offsets.
  const grain = document.createElement('canvas');
  grain.width = 256;
  grain.height = 256;
  {
    const g = grain.getContext('2d');
    const img = g.createImageData(256, 256);
    for (let y = 0; y < 256; y += 1) {
      for (let x = 0; x < 256; x += 1) {
        const i = (y * 256 + x) * 4;
        const v = Math.floor(valueNoise(x * 0.9, y * 0.9, 77) * 255);
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = 26;
      }
    }
    g.putImageData(img, 0, 0);
  }

  function resize() {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    view.w = Math.round(window.innerWidth * ratio);
    view.h = Math.round(window.innerHeight * ratio);
    canvas.width = view.w;
    canvas.height = view.h;
  }
  window.addEventListener('resize', resize);
  resize();

  function visibleRect(game) {
    const cam = game.camera;
    const hw = view.w / 2 / cam.zoom + 90;
    const hh = view.h / 2 / cam.zoom + 90;
    return { x0: cam.x - hw, y0: cam.y - hh, x1: cam.x + hw, y1: cam.y + hh };
  }

  function draw(game) {
    const cam = game.camera;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.save();
    ctx.translate(view.w / 2, view.h / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);
    const vis = visibleRect(game);
    drawGround(ctx, game, vis);
    drawProps(ctx, game, vis, false);
    drawBuildings(ctx, game, vis);
    drawMarkers(ctx, game);
    drawCarsAndCrowds(ctx, game, vis);
    drawProps(ctx, game, vis, true);
    drawHeli(ctx, game);
    drawEffects(ctx, game);
    drawLighting(ctx, game, vis);
    ctx.restore();
    drawGrade(ctx, game);
  }

  return { draw, view, ctx, grain };
}

// ---------------------------------------------------------------- ground
function drawGround(ctx, game, vis) {
  const city = game.city;
  const time = game.time;
  // Base: district pavement everywhere; the port apron and the coast drawn over it.
  ctx.fillStyle = '#2c2838';
  ctx.fillRect(vis.x0, vis.y0, vis.x1 - vis.x0, vis.y1 - vis.y0);
  // Water with moving shimmer bands.
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(Math.max(vis.x0, BEACH.waterX), vis.y0, vis.x1 - Math.max(vis.x0, BEACH.waterX), vis.y1 - vis.y0);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(Math.max(vis.x0, BEACH.waterX), Math.max(vis.y0, 3420), vis.x1, 60);
  ctx.save();
  ctx.beginPath();
  ctx.rect(Math.max(vis.x0, BEACH.waterX), vis.y0, vis.x1, vis.y1 - vis.y0);
  ctx.clip();
  ctx.strokeStyle = 'rgba(140,220,255,0.13)';
  ctx.lineWidth = 3;
  for (let y = Math.floor(vis.y0 / 90) * 90; y < vis.y1; y += 90) {
    ctx.beginPath();
    for (let x = Math.max(vis.x0, BEACH.waterX); x < vis.x1; x += 60) {
      const yy = y + Math.sin(x * 0.01 + time * 0.7 + y) * 7 + valueNoise(x * 0.02, y * 0.02 + time * 0.05, 5) * 10;
      if (x === Math.max(vis.x0, BEACH.waterX)) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
  // Foam line where the sea gives up.
  ctx.fillStyle = 'rgba(191,234,255,0.5)';
  const foamX = BEACH.waterX + Math.sin(time * 0.8) * 6;
  ctx.fillRect(foamX, vis.y0, 5, vis.y1 - vis.y0);
  // Sand.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(Math.max(vis.x0, BEACH.sandX), vis.y0, Math.min(vis.x1, BEACH.waterX) - Math.max(vis.x0, BEACH.sandX), vis.y1 - vis.y0);
  ctx.fillStyle = PALETTE.sandWet;
  ctx.fillRect(Math.max(vis.x0, BEACH.waterX - 26), vis.y0, 26, vis.y1 - vis.y0);
  // Port apron.
  ctx.fillStyle = '#3b3f45';
  ctx.fillRect(vis.x0, 3000, Math.min(vis.x1, BEACH.sandX) - vis.x0, 430);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let x = Math.floor(vis.x0 / 200) * 200; x < Math.min(vis.x1, BEACH.sandX); x += 200) ctx.fillRect(x, 3000, 3, 430);

  // Blocks: sidewalk slab, then the block's own ground.
  for (let r = 0; r < GRID.rows; r += 1) {
    for (let c = 0; c < GRID.cols; c += 1) {
      const bx = blockX(c);
      const by = blockY(r);
      if (bx + GRID.blockW < vis.x0 || bx > vis.x1 || by + GRID.blockH < vis.y0 || by > vis.y1) continue;
      const block = city.blocks[r][c];
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(bx - 26, by - 26, GRID.blockW + 52, GRID.blockH + 52);
      ctx.fillStyle = block.kind === 'park' ? PALETTE.park : block.kind === 'lot' ? '#2f2d38' : shade(block.district.tone, -6);
      ctx.fillRect(bx, by, GRID.blockW, GRID.blockH);
      if (block.kind === 'lot') {
        ctx.strokeStyle = 'rgba(240,240,240,0.4)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i += 1) {
          ctx.strokeRect(bx + 44 + i * 104, by + 60, 74, 120);
          ctx.strokeRect(bx + 44 + i * 104, by + 230, 74, 120);
        }
      }
      if (block.kind === 'park') {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(bx + GRID.blockW / 2 - 60, by + 20, 120, GRID.blockH - 40);
        ctx.fillRect(bx + 20, by + GRID.blockH / 2 - 60, GRID.blockW - 40, 120);
      }
    }
  }

  // Roads: avenues, streets, the coast road.
  ctx.fillStyle = PALETTE.asphalt;
  for (let i = 0; i <= GRID.cols; i += 1) ctx.fillRect(avenueX(i) - GRID.road / 2, Math.max(vis.y0, 0), GRID.road, 3020);
  for (let j = 0; j <= GRID.rows; j += 1) ctx.fillRect(Math.max(vis.x0, 0), streetY(j) - GRID.road / 2, GRID.cityEast, GRID.road);
  ctx.fillRect(GRID.cityEast, 0, BEACH.sandX - GRID.cityEast, WORLD.height - 380);
  // Lane dashes.
  ctx.fillStyle = PALETTE.lane;
  for (let i = 0; i <= GRID.cols; i += 1) {
    for (let y = Math.max(0, Math.floor(vis.y0 / 64) * 64); y < Math.min(3020, vis.y1); y += 64) ctx.fillRect(avenueX(i) - 2, y, 4, 34);
  }
  for (let j = 0; j <= GRID.rows; j += 1) {
    for (let x = Math.max(0, Math.floor(vis.x0 / 64) * 64); x < Math.min(GRID.cityEast, vis.x1); x += 64) ctx.fillRect(x, streetY(j) - 2, 34, 4);
  }
  // Crosswalks at every crossing.
  ctx.fillStyle = 'rgba(240,240,240,0.55)';
  for (let i = 0; i <= GRID.cols; i += 1) {
    for (let j = 0; j <= GRID.rows; j += 1) {
      const cx = avenueX(i);
      const cy = streetY(j);
      if (cx < vis.x0 - 90 || cx > vis.x1 + 90 || cy < vis.y0 - 90 || cy > vis.y1 + 90) continue;
      for (let s = -3; s <= 3; s += 1) {
        ctx.fillRect(cx - 84, cy + s * 20 - 5, 26, 10);
        ctx.fillRect(cx + 58, cy + s * 20 - 5, 26, 10);
        ctx.fillRect(cx + s * 20 - 5, cy - 84, 10, 26);
        ctx.fillRect(cx + s * 20 - 5, cy + 58, 10, 26);
      }
    }
  }
  void city;
}

// ---------------------------------------------------------------- props & buildings
function drawProps(ctx, game, vis, foreground) {
  for (const prop of game.city.props) {
    if (prop.x < vis.x0 - 120 || prop.x > vis.x1 + 120 || prop.y < vis.y0 - 120 || prop.y > vis.y1 + 120) continue;
    if (!foreground && prop.kind === 'crane') drawCrane(ctx, prop);
    if (foreground) continue;
    if (prop.kind === 'umbrella') {
      ctx.save();
      ctx.translate(prop.x, prop.y);
      ctx.rotate(prop.angle);
      ctx.fillStyle = prop.color;
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        ctx.lineTo(Math.cos(a) * 17, Math.sin(a) * 17);
        const b = a + Math.PI / 8;
        ctx.lineTo(Math.cos(b) * 8, Math.sin(b) * 8);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (prop.kind === 'bench') {
      ctx.save();
      ctx.translate(prop.x, prop.y);
      ctx.rotate(prop.angle);
      ctx.fillStyle = prop.color;
      ctx.fillRect(-14, -4, 28, 8);
      ctx.restore();
    } else if (prop.kind === 'fountain') {
      const pulse = 1 + Math.sin(game.time * 2.2) * 0.05;
      ctx.fillStyle = '#8d8578';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 44 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2e7ba6';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 36 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(191,234,255,0.75)';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 12 + Math.sin(game.time * 3) * 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.kind === 'container') {
      ctx.save();
      ctx.translate(prop.x, prop.y);
      ctx.rotate(prop.angle);
      ctx.fillStyle = prop.color;
      ctx.fillRect(-52, -21, 104, 42);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      for (let i = -3; i <= 3; i += 1) {
        ctx.beginPath();
        ctx.moveTo(i * 14, -21);
        ctx.lineTo(i * 14, 21);
        ctx.stroke();
      }
      ctx.restore();
    } else if (prop.kind === 'crate') {
      ctx.save();
      ctx.translate(prop.x, prop.y);
      ctx.rotate(prop.angle);
      ctx.fillStyle = prop.color;
      ctx.fillRect(-13, -13, 26, 26);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.strokeRect(-13, -13, 26, 26);
      ctx.restore();
    } else if (prop.kind === 'boat') {
      ctx.save();
      ctx.translate(prop.x, prop.y + Math.sin(game.time + prop.x) * 2);
      ctx.rotate(prop.angle);
      ctx.fillStyle = prop.color;
      ctx.beginPath();
      ctx.moveTo(46 * prop.s, 0);
      ctx.lineTo(20 * prop.s, -13 * prop.s);
      ctx.lineTo(-38 * prop.s, -11 * prop.s);
      ctx.lineTo(-46 * prop.s, 0);
      ctx.lineTo(-38 * prop.s, 11 * prop.s);
      ctx.lineTo(20 * prop.s, 13 * prop.s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(-8 * prop.s, -6 * prop.s, 20 * prop.s, 12 * prop.s);
      ctx.restore();
    } else if (prop.kind === 'buoy') {
      ctx.fillStyle = prop.color;
      ctx.beginPath();
      ctx.arc(prop.x, prop.y + Math.sin(game.time * 1.4 + prop.x) * 2.4, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (!foreground) drawPalms(ctx, game, vis);
}

function drawCrane(ctx, prop) {
  ctx.save();
  ctx.translate(prop.x, prop.y);
  ctx.fillStyle = 'rgba(10,4,20,0.35)';
  ctx.fillRect(-14, -14, 60, 28);
  ctx.fillStyle = prop.color;
  ctx.fillRect(-12, -12, 30, 24);
  ctx.strokeStyle = prop.color;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(210, -54);
  ctx.stroke();
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(168, -44);
  ctx.lineTo(168, 26);
  ctx.stroke();
  ctx.fillStyle = '#5e5e6a';
  ctx.fillRect(150, 26, 36, 26);
  ctx.restore();
}

function drawPalms(ctx, game, vis) {
  const time = game.time;
  for (const palm of game.city.palms) {
    if (palm.x < vis.x0 - 60 || palm.x > vis.x1 + 60 || palm.y < vis.y0 - 60 || palm.y > vis.y1 + 60) continue;
    const s = palm.s * 17;
    // Shadow first, leaning away from the low sun.
    ctx.fillStyle = 'rgba(10,20,8,0.22)';
    ctx.beginPath();
    ctx.ellipse(palm.x + 16, palm.y + 7, s * 1.15, s * 0.5, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(palm.x, palm.y);
    ctx.rotate(palm.lean + Math.sin(time * 0.9 + palm.phase) * 0.02);
    ctx.strokeStyle = '#35803c';
    ctx.lineWidth = 4.6;
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i += 1) {
      const a = (i / 7) * Math.PI * 2 + palm.phase;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(Math.cos(a) * s * 0.7, Math.sin(a) * s * 0.7, Math.cos(a) * s * 1.12, Math.sin(a) * s * 1.12 + 5);
      ctx.stroke();
    }
    ctx.strokeStyle = '#46a352';
    ctx.lineWidth = 3;
    for (let i = 0; i < 7; i += 1) {
      const a = (i / 7) * Math.PI * 2 + palm.phase + 0.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5, Math.cos(a) * s * 0.82, Math.sin(a) * s * 0.82 + 4);
      ctx.stroke();
    }
    ctx.fillStyle = '#6a4a2f';
    ctx.beginPath();
    ctx.arc(0, 0, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a5a33';
    ctx.beginPath();
    ctx.arc(3.4, 2.6, 2.6, 0, Math.PI * 2);
    ctx.arc(-3, 3.2, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawBuildings(ctx, game, vis) {
  const light = lightingAt(game.tod);
  const shadowLen = 14 + light.warm * 44;
  for (const b of game.city.buildings) {
    if (b.x + b.w < vis.x0 - 80 || b.x > vis.x1 + 80 || b.y + b.h < vis.y0 - 80 || b.y > vis.y1 + 80) continue;
    // Long shadow to the east, then the roof slab.
    ctx.fillStyle = PALETTE.buildingShadow;
    ctx.fillRect(b.x + shadowLen, b.y + shadowLen * 0.36, b.w, b.h);
    ctx.fillStyle = shade(b.color, -18 - Math.floor(b.wear * 12));
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // Parapet and inner roof.
    ctx.strokeStyle = shade(b.color, 26);
    ctx.lineWidth = 5;
    ctx.strokeRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);
    ctx.fillStyle = shade(b.color, -24);
    ctx.fillRect(b.x + 12, b.y + 12, b.w - 24, b.h - 24);
    drawRoofDetail(ctx, b, game);
    // Neon sign on the street edge, with its spill.
    if (b.neon) {
      const sx = b.x + b.w / 2;
      const sy = b.y + b.h + 15;
      const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, 120);
      glow.addColorStop(0, hexA(b.neon.color, 0.4 + light.dark * 0.3));
      glow.addColorStop(1, hexA(b.neon.color, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(sx - 120, sy - 120, 240, 240);
      ctx.save();
      ctx.shadowColor = b.neon.color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = b.neon.color;
      ctx.font = `900 ${Math.min(30, Math.max(17, b.w / Math.max(6, b.neon.text.length) * 1.7))}px "Arial Black", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.neon.text, sx, sy);
      ctx.restore();
    } else if (b.name) {
      ctx.fillStyle = 'rgba(255,255,255,0.66)';
      ctx.font = '700 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.name.toUpperCase(), b.x + b.w / 2, b.y + b.h / 2);
    }
  }
}

function drawRoofDetail(ctx, b, game) {
  const ix = b.x + 22;
  const iy = b.y + 22;
  const iw = b.w - 44;
  const ih = b.h - 44;
  if (iw < 30 || ih < 30) return;
  ctx.save();
  if (b.roof === 'tank') {
    ctx.fillStyle = shade(b.color, -52);
    ctx.beginPath();
    ctx.arc(b.x + b.w * 0.7, b.y + b.h * 0.34, Math.min(30, iw * 0.2), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shade(b.color, 8);
    ctx.lineWidth = 3;
    ctx.stroke();
  } else if (b.roof === 'pool') {
    ctx.fillStyle = '#1f6f9f';
    ctx.fillRect(ix, iy, iw * 0.62, ih * 0.6);
    ctx.fillStyle = 'rgba(140,225,255,0.6)';
    ctx.fillRect(ix + 4, iy + 4 + Math.sin(game.time * 1.3 + b.x) * 2, iw * 0.62 - 8, 5);
    ctx.fillStyle = shade(b.color, -10);
    ctx.fillRect(ix + iw * 0.7, iy, iw * 0.26, ih * 0.6);
  } else if (b.roof === 'garden') {
    ctx.fillStyle = '#2c5a2e';
    ctx.fillRect(ix, iy, iw, ih);
    ctx.fillStyle = '#386e3a';
    for (let i = 0; i < 5; i += 1) ctx.fillRect(ix + ((i * 67 + b.x) % Math.max(20, iw - 30)), iy + ((i * 41 + b.y) % Math.max(20, ih - 24)), 26, 18);
  } else if (b.roof === 'helipad') {
    ctx.strokeStyle = 'rgba(255,210,87,0.85)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(b.x + b.w / 2, b.y + b.h / 2, Math.min(iw, ih) * 0.36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,87,0.85)';
    ctx.font = `900 ${Math.min(44, ih * 0.4)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', b.x + b.w / 2, b.y + b.h / 2);
  } else if (b.roof === 'machines') {
    ctx.fillStyle = shade(b.color, -48);
    const n = Math.max(2, Math.floor(iw / 52));
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < Math.max(1, Math.floor(ih / 52)); j += 1) {
        ctx.fillRect(ix + i * 52, iy + j * 52, 34, 30);
      }
    }
  } else if (b.roof === 'sign' && b.name) {
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(ix, iy, iw, 26);
  } else {
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x + b.w / 2, b.y + 12);
    ctx.lineTo(b.x + b.w / 2, b.y + b.h - 12);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- markers
function drawMarkers(ctx, game) {
  const target = game.missions.target();
  const time = game.time;
  if (target && game.screen === 'play') {
    const pulse = 1 + Math.sin(time * 4.4) * 0.1;
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 5;
    ctx.shadowColor = PALETTE.gold;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,87,0.16)';
    ctx.beginPath();
    ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // A light pillar so the eye finds it across the city.
    const grad = ctx.createLinearGradient(0, target.y - 320, 0, target.y);
    grad.addColorStop(0, 'rgba(255,210,87,0)');
    grad.addColorStop(1, 'rgba(255,210,87,0.3)');
    ctx.fillStyle = grad;
    ctx.fillRect(target.x - 7, target.y - 320, 14, 320);
  }
  const offer = game.missions.offerPoint();
  if (offer && game.screen === 'play') {
    const bob = Math.sin(time * 3.2) * 6;
    ctx.save();
    ctx.translate(offer.x, offer.y - 56 + bob);
    ctx.fillStyle = PALETTE.neonPink;
    ctx.shadowColor = PALETTE.neonPink;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = '900 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 0, 1);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- actors
function drawCarsAndCrowds(ctx, game, vis) {
  const actors = [];
  for (const car of game.allCars()) {
    if (car.x < vis.x0 - 160 || car.x > vis.x1 + 160 || car.y < vis.y0 - 160 || car.y > vis.y1 + 160) continue;
    actors.push({ y: car.y, car });
  }
  actors.sort((a, b) => a.y - b.y);
  for (const actor of actors) {
    const car = actor.car;
    // Ground shadow, long at golden hour.
    ctx.fillStyle = 'rgba(8,4,18,0.4)';
    ctx.save();
    ctx.translate(car.x + 15, car.y + 8);
    ctx.rotate(car.angle);
    ctx.fillRect(-car.def.length / 2, -car.def.width / 2, car.def.length, car.def.width);
    ctx.restore();
    drawCar(ctx, car, game.time);
    if (car.health < 42 && !car.wreck) {
      // Damage smoke.
      const s = 8 + Math.sin(game.time * 7 + car.id * 3) * 2.4;
      ctx.fillStyle = 'rgba(60,60,70,0.4)';
      ctx.beginPath();
      ctx.arc(car.x + Math.cos(car.angle) * 30, car.y + Math.sin(car.angle) * 30 - 6, s, 0, Math.PI * 2);
      ctx.fill();
    }
    if (car.wreck) {
      ctx.fillStyle = 'rgba(20,20,26,0.35)';
      ctx.beginPath();
      ctx.ellipse(car.x, car.y, car.def.length * 0.55, car.def.width * 0.7, car.angle, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const ped of game.crowds.peds) {
    if (ped.hidden) continue;
    if (ped.x < vis.x0 - 40 || ped.x > vis.x1 + 40 || ped.y < vis.y0 - 40 || ped.y > vis.y1 + 40) continue;
    ctx.fillStyle = 'rgba(8,4,18,0.32)';
    ctx.beginPath();
    ctx.ellipse(ped.x + 5, ped.y + 4, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    drawPed(ctx, ped, game.time);
  }
  // The player on foot gets a soft ring so he is never lost in his own city.
  const p = game.player;
  if (!p.car && game.screen === 'play') {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 17 + Math.sin(game.time * 4) * 1.6, 0, Math.PI * 2);
    ctx.stroke();
    drawPed(ctx, { ...p, kind: 'player', shirt: '#ff4fd8', pants: '#1c1c26', skin: '#d99e63', state: 'walk', speed: p.speed, phase: p.walkPhase, hat: false }, game.time);
  }
}

function drawHeli(ctx, game) {
  const heli = game.police.heli;
  if (!heli) return;
  // Ground shadow and the light pool live at the spot point.
  ctx.fillStyle = 'rgba(8,4,18,0.3)';
  ctx.beginPath();
  ctx.ellipse(heli.x + 60, heli.y + 40, 64, 22, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(heli.x, heli.y);
  ctx.rotate(heli.angle);
  // Rotor wash.
  ctx.fillStyle = 'rgba(200,220,255,0.1)';
  ctx.beginPath();
  ctx.arc(0, 0, 88, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(220,235,255,0.35)';
  ctx.lineWidth = 3;
  const ra = heli.rotor;
  ctx.beginPath();
  ctx.moveTo(Math.cos(ra) * -86, Math.sin(ra) * -86);
  ctx.lineTo(Math.cos(ra) * 86, Math.sin(ra) * 86);
  ctx.moveTo(Math.cos(ra + Math.PI / 2) * -86, Math.sin(ra + Math.PI / 2) * -86);
  ctx.lineTo(Math.cos(ra + Math.PI / 2) * 86, Math.sin(ra + Math.PI / 2) * 86);
  ctx.stroke();
  // Tail and fuselage.
  ctx.fillStyle = '#20242e';
  ctx.fillRect(-96, -5, 62, 10);
  ctx.fillRect(-100, -14, 8, 28);
  ctx.fillStyle = '#2c3140';
  ctx.beginPath();
  ctx.ellipse(0, 0, 44, 21, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(140,200,240,0.85)';
  ctx.beginPath();
  ctx.ellipse(20, 0, 17, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2f2f2';
  ctx.font = '900 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PD', -8, 0);
  // Skids.
  ctx.strokeStyle = '#14161c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-24, -24);
  ctx.lineTo(28, -24);
  ctx.moveTo(-24, 24);
  ctx.lineTo(28, 24);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- effects & light
function drawEffects(ctx, game) {
  // Tracers.
  for (const t of game.combat.tracers) {
    const a = Math.max(0, t.life / t.max);
    ctx.strokeStyle = t.enemy ? `rgba(255,90,80,${a * 0.9})` : `rgba(255,230,160,${a * 0.95})`;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(t.x0, t.y0);
    ctx.lineTo(t.x1, t.y1);
    ctx.stroke();
  }
  // Muzzle flashes.
  for (const f of game.combat.flashes) {
    const a = Math.max(0, f.life / f.max);
    const r = (f.big ? 30 : 20) * a + 6;
    const grad = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, r);
    grad.addColorStop(0, `rgba(255,240,190,${a})`);
    grad.addColorStop(0.4, `rgba(255,170,60,${a * 0.7})`);
    grad.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Particles: sparks, smoke, confetti.
  for (const pt of game.particles) {
    const a = Math.max(0, pt.life / pt.max);
    if (pt.kind === 'spark') {
      ctx.strokeStyle = `rgba(255,190,90,${a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x - pt.vx * 0.03, pt.y - pt.vy * 0.03);
      ctx.stroke();
    } else if (pt.kind === 'smoke') {
      ctx.fillStyle = `rgba(70,70,82,${a * 0.4})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * (1.6 - a * 0.6), 0, Math.PI * 2);
      ctx.fill();
    } else if (pt.kind === 'confetti') {
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.rot);
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = a;
      ctx.fillRect(-4, -2.4, 8, 4.8);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }
}

function drawLighting(ctx, game, vis) {
  const light = lightingAt(game.tod);
  // Headlight cones and streetlight pools come first: the grade sits over them.
  if (light.dark > 0.18) {
    for (const lamp of game.city.lights) {
      if (lamp.x < vis.x0 - 90 || lamp.x > vis.x1 + 90 || lamp.y < vis.y0 - 90 || lamp.y > vis.y1 + 90) continue;
      const grad = ctx.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 74);
      grad.addColorStop(0, `rgba(255,214,140,${0.24 * light.dark})`);
      grad.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(lamp.x - 74, lamp.y - 74, 148, 148);
      ctx.fillStyle = '#ffe9b0';
      ctx.fillRect(lamp.x - 2, lamp.y - 2, 4, 4);
    }
    for (const car of game.allCars()) {
      if (!car.lightsOn || car.wreck) continue;
      if (car.x < vis.x0 - 200 || car.x > vis.x1 + 200 || car.y < vis.y0 - 200 || car.y > vis.y1 + 200) continue;
      const fx = Math.cos(car.angle);
      const fy = Math.sin(car.angle);
      const nx = car.x + fx * car.def.length * 0.5;
      const ny = car.y + fy * car.def.length * 0.5;
      const grad = ctx.createRadialGradient(nx, ny, 4, nx + fx * 90, ny + fy * 90, 130);
      grad.addColorStop(0, `rgba(255,240,200,${0.2 * light.dark})`);
      grad.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(nx, ny);
      ctx.arc(nx + fx * 40, ny + fy * 40, 120, car.angle - 0.42, car.angle + 0.42);
      ctx.closePath();
      ctx.fill();
    }
  }
  // The helicopter's searchlight: a cone from the sky to a bright pool.
  const heli = game.police.heli;
  if (heli) {
    const grad = ctx.createRadialGradient(heli.spotX, heli.spotY, 6, heli.spotX, heli.spotY, 120);
    grad.addColorStop(0, 'rgba(240,248,255,0.5)');
    grad.addColorStop(1, 'rgba(240,248,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(heli.spotX, heli.spotY, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(240,248,255,0.1)';
    ctx.beginPath();
    ctx.moveTo(heli.x, heli.y);
    ctx.lineTo(heli.spotX - 56, heli.spotY);
    ctx.lineTo(heli.spotX + 56, heli.spotY);
    ctx.closePath();
    ctx.fill();
  }
}

function drawGrade(ctx, game) {
  const view = { w: ctx.canvas.width, h: ctx.canvas.height };
  const light = lightingAt(game.tod);
  // Warmth of the hour, laid in from the west.
  if (light.warm > 0.02) {
    const grad = ctx.createLinearGradient(0, 0, view.w, 0);
    grad.addColorStop(0, `rgba(255,128,44,${0.17 * light.warm})`);
    grad.addColorStop(0.6, `rgba(255,79,120,${0.07 * light.warm})`);
    grad.addColorStop(1, `rgba(64,32,110,${0.1 * light.warm})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, view.w, view.h);
  }
  if (light.dark > 0.02) {
    ctx.fillStyle = `rgba(7,10,38,${light.dark * 0.36})`;
    ctx.fillRect(0, 0, view.w, view.h);
  }
  // A breath of vignette, and the grain.
  const vig = ctx.createRadialGradient(view.w / 2, view.h / 2, view.h * 0.52, view.w / 2, view.h / 2, view.h * 0.98);
  vig.addColorStop(0, 'rgba(5,2,12,0)');
  vig.addColorStop(1, 'rgba(5,2,12,0.3)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, view.w, view.h);
  const off = Math.floor(game.time * 8) % 256;
  ctx.save();
  ctx.globalAlpha = 0.5;
  for (let x = -off; x < view.w; x += 256) {
    for (let y = -off; y < view.h; y += 256) {
      ctx.drawImage(game.grainCanvas, x, y);
    }
  }
  ctx.restore();
}
