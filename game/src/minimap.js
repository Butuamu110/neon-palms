// NEON PALMS — round textured minimap (roads from the ground texture, blips for
// mission/race/cops/player, police search zone) and the full map screen (M):
// textured districts, per-district standing, POI legend and a GPS route line.
import { G, CFG, DISTRICTS, districtAt } from './config.js';
import { worldToMap } from './city.js';
import { currentStage } from './missions.js';
import { RACES, DUEL } from './races.js';

export function drawMinimap() {
  const cv = document.getElementById('minimap');
  if (!cv || !G.groundTexture) return;
  const g = cv.getContext('2d');
  const S = cv.width, R = 95; // view radius in metres
  const px = G.player.x, pz = G.player.z;
  g.clearRect(0, 0, S, S);
  g.save();
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, 7); g.clip();
  // textured base: draw the ground texture region around the player
  const img = G.groundTexture.image;
  const scale = img.width / (CFG.world * 2);
  const srcR = R * scale;
  const [cx, cy] = worldToMap(px, pz, img.width);
  g.drawImage(img, cx - srcR, cy - srcR, srcR * 2, srcR * 2, 0, 0, S, S);
  const toMap = (x, z) => [S / 2 + (x - px) * (S / 2 / R), S / 2 + (z - pz) * (S / 2 / R)];
  // search zone
  if (G.wanted > 0) {
    g.fillStyle = G.sight === 'IN SIGHT' ? 'rgba(255,40,60,0.20)' : 'rgba(255,220,80,0.16)';
    g.beginPath(); g.arc(S / 2, S / 2, S / 2 * (0.4 + G.wanted * 0.1), 0, 7); g.fill();
  }
  // blips
  const blip = (x, z, color, r = 4) => {
    const [mx, my] = toMap(x, z);
    if (mx < -6 || my < -6 || mx > S + 6 || my > S + 6) return;
    g.fillStyle = color; g.beginPath(); g.arc(mx, my, r, 0, 7); g.fill();
    g.strokeStyle = '#000'; g.lineWidth = 1.2; g.stroke();
  };
  for (const c of G.collectibles) if (!c.got) blip(c.x, c.z, '#ff2e88', 3);
  for (const r of RACES) blip(r.start[0], r.start[1], '#37c8ff', 4);
  blip(DUEL.start[0], DUEL.start[1], '#ff4040', 4);
  for (const u of G.cops) blip(u.car.x, u.car.z, '#2266ff', 4);
  if (G.heli) blip(G.heli.x, G.heli.z, '#2266ff', 5);
  const st = currentStage();
  if (st && (st.x !== undefined)) blip(st.x, st.z, '#ffd94d', 6);
  if (st && st.cps) { const [tx, tz] = st.cps[Math.min(G.mission.cp, st.cps.length - 1)]; blip(tx, tz, '#ffd94d', 6); }
  if (G.race) { const [tx, tz] = G.race.def.cps[Math.min(G.race.cp, G.race.def.cps.length - 1)]; blip(tx, tz, '#7dff9a', 6); }
  if (!G.mission && G.missionIdx < 8) blip(-168, 44, '#ffd94d', 6);
  // player arrow
  const a = G.player.inCar ? G.player.inCar.a : G.player.a;
  g.translate(S / 2, S / 2); g.rotate(a);
  g.fillStyle = '#ffffff';
  g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.closePath(); g.fill();
  g.strokeStyle = '#000'; g.stroke();
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 3;
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, 7); g.stroke();
}

export function drawFullMap() {
  const cv = document.getElementById('map-canvas');
  if (!cv || !G.groundTexture) return;
  const g = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  g.fillStyle = '#0b0b16'; g.fillRect(0, 0, W, H);
  const img = G.groundTexture.image;
  const mapW = 620, mapH = 620, ox = 30, oy = 40;
  g.drawImage(img, ox, oy, mapW, mapH);
  const toMap = (x, z) => [ox + ((x + CFG.world) / (CFG.world * 2)) * mapW, oy + ((z + CFG.world) / (CFG.world * 2)) * mapH];
  // district labels + standing
  g.font = 'bold 15px Arial'; g.textAlign = 'center';
  for (const d of DISTRICTS) {
    const [mx, my] = toMap((d.x0 + d.x1) / 2, (d.z0 + d.z1) / 2);
    const standing = G.districtStanding[d.name] || 0;
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(mx - 86, my - 16, 172, 34);
    g.fillStyle = d.color; g.fillText(d.name.toUpperCase(), mx, my);
    g.fillStyle = '#fff'; g.font = '12px Arial';
    g.fillText(`standing ${standing} RESPECT`, mx, my + 14);
    g.font = 'bold 15px Arial';
  }
  // GPS route to current objective
  let target = null;
  const st = currentStage();
  if (st && st.x !== undefined) target = [st.x, st.z];
  else if (st && st.cps) target = st.cps[Math.min(G.mission.cp, st.cps.length - 1)];
  else if (G.race) target = G.race.def.cps[Math.min(G.race.cp, G.race.def.cps.length - 1)];
  else if (G.missionIdx < 8) target = [-168, 44];
  if (target) {
    const [px2, py2] = toMap(G.player.x, G.player.z), [tx2, ty2] = toMap(target[0], target[1]);
    // route snapped to the road grid: horizontal then vertical along nearest lines
    const snap = (v) => CFG.roadLines.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a, CFG.roadLines[0]);
    const [rx] = toMap(snap(G.player.x), 0), [, ry] = toMap(0, snap(target[1]));
    g.strokeStyle = '#ffd94d'; g.lineWidth = 4; g.setLineDash([12, 7]);
    g.beginPath(); g.moveTo(px2, py2); g.lineTo(rx, py2); g.lineTo(rx, ry); g.lineTo(tx2, ty2); g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#ffd94d'; g.beginPath(); g.arc(tx2, ty2, 8, 0, 7); g.fill();
  }
  // POIs
  const poi = (x, z, color, label) => {
    const [mx, my] = toMap(x, z);
    g.fillStyle = color; g.beginPath(); g.arc(mx, my, 6, 0, 7); g.fill();
    g.strokeStyle = '#000'; g.stroke();
    if (label) { g.fillStyle = '#fff'; g.font = '11px Arial'; g.fillText(label, mx, my - 10); g.font = 'bold 15px Arial'; }
  };
  poi(-168, 44, '#ffd94d', 'VALENTINA');
  for (const r of RACES) poi(r.start[0], r.start[1], '#37c8ff', '');
  poi(DUEL.start[0], DUEL.start[1], '#ff4040', 'PINK SLIP');
  for (const c of G.collectibles) if (!c.got) poi(c.x, c.z, '#ff2e88', '');
  for (const u of G.cops) poi(u.car.x, u.car.z, '#2266ff', '');
  const [ppx, ppy] = toMap(G.player.x, G.player.z);
  g.fillStyle = '#fff'; g.beginPath(); g.arc(ppx, ppy, 7, 0, 7); g.fill();
  g.strokeStyle = '#ff2e88'; g.lineWidth = 3; g.stroke();
  // legend
  const lx = 690, ly = 60;
  g.textAlign = 'left';
  g.fillStyle = '#fff'; g.font = 'bold 17px Arial'; g.fillText('SAN VERDE — POI LEGEND', lx, ly);
  g.font = '13px Arial';
  const items = [
    ['#ffd94d', 'Valentina / mission objective + GPS route'],
    ['#37c8ff', 'Street race start (6 events)'],
    ['#ff4040', 'Pink-slip duel start'],
    ['#ff2e88', 'Neon palm collectible (12 hidden)'],
    ['#2266ff', 'Interdiction unit (live)'],
    ['#ffffff', 'You'],
  ];
  items.forEach(([c, t], i) => {
    g.fillStyle = c; g.beginPath(); g.arc(lx + 8, ly + 22 + i * 24, 6, 0, 7); g.fill();
    g.fillStyle = '#ddd'; g.fillText(t, lx + 24, ly + 26 + i * 24);
  });
  g.fillStyle = '#fff'; g.font = 'bold 15px Arial';
  g.fillText('DISTRICT STANDING (RESPECT EARNED)', lx, ly + 190);
  g.font = '13px Arial';
  DISTRICTS.forEach((d, i) => {
    g.fillStyle = d.color; g.fillText(`${d.name}: ${G.districtStanding[d.name] || 0}`, lx, ly + 216 + i * 20);
  });
  g.fillStyle = '#ffe066';
  g.fillText(`Current district: ${districtAt(G.player.x, G.player.z).name}`, lx, ly + 350);
  g.fillText('Press M to close', lx, ly + 380);
}
