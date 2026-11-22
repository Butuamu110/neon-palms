// NEON PALMS — title screen, full-map overlay, stats/save screen with the RESPECT
// ladder, and 3 working localStorage save slots.
import { G, RANKS, rankIdx, addCash } from './config.js';
import { MISSIONS } from './missions.js';
import { RACES } from './races.js';
import { drawFullMap } from './minimap.js';
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const SAVE_KEY = (n) => 'neonpalms-save-' + n;

export function saveGame(slot) {
  const data = {
    cash: G.cash, respect: G.respect, missionIdx: G.missionIdx,
    stats: G.stats, districtStanding: G.districtStanding,
    x: Math.round(G.player.x), z: Math.round(G.player.z),
    collect: G.collectibles.map((c) => c.got ? 1 : 0),
  };
  try { localStorage.setItem(SAVE_KEY(slot), JSON.stringify(data)); } catch (e) { /* private mode */ }
  return data;
}
export function loadSaveData(slot) {
  try { const s = localStorage.getItem(SAVE_KEY(slot)); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
export function applySave(slot) {
  const d = loadSaveData(slot);
  if (!d) return false;
  G.cash = d.cash; G.respect = d.respect; G.missionIdx = d.missionIdx;
  Object.assign(G.stats, d.stats || {});
  G.districtStanding = d.districtStanding || {};
  G.player.x = d.x; G.player.z = d.z; G.player.inCar = null;
  if (G.player.mesh) G.player.mesh.visible = true;
  (d.collect || []).forEach((v, i) => { if (G.collectibles[i]) { G.collectibles[i].got = !!v; G.collectibles[i].mesh.visible = !v; } });
  G.msg = `SAVE SLOT ${slot} LOADED`; G.msgUntil = G.time + 3;
  return true;
}
export function slotSummary(slot) {
  const d = loadSaveData(slot);
  if (!d) return `SLOT ${slot} — EMPTY · start a new run on the Strip`;
  const pct = completionPct(d);
  return `SLOT ${slot} — $${d.cash.toLocaleString('en-US')} · RESPECT ${d.respect} · ${d.missionIdx}/8 missions · ${pct}% complete`;
}
export function completionPct(d = null) {
  const s = d ? d.stats : G.stats;
  const mi = d ? d.missionIdx : G.missionIdx;
  const parts = [
    (mi / 8) * 40,
    Math.min(1, (s.racesWon || 0) / 6) * 25,
    Math.min(1, (s.duelsWon || 0) / 1) * 10,
    ((s.collectibles || 0) / 12) * 15,
    Math.min(1, (d ? d.respect : G.respect) / 1000) * 10,
  ];
  return Math.round(parts.reduce((a, b) => a + b, 0));
}

export function buildMenus() {
  $('title-screen').innerHTML = `
    <div id="title-skyline"></div>
    <div id="title-inner">
      <div id="title-kicker">SAN VERDE · RÍOS RACING FAMILY PRESENTS</div>
      <h1 id="title-main">NEON<br>PALMS</h1>
      <div id="title-tag">Win the Strip by day. Own the neon by night.</div>
      <div id="title-slots"></div>
      <button id="btn-start" class="big-btn">▶ &nbsp;START ENGINE — FREE ROAM</button>
      <div id="title-controls">WASD drive / walk · E enter & steal · F fire · Shift sprint · Z/X/C crew · R radio · M map · P stats & saves · 1–6 weapons</div>
      <div id="title-foot">8 missions for Valentina 'Válvula' Ríos · 6 street races · pink-slip duels · San Verde PD Interdiction</div>
    </div>`;
  $('map-screen').innerHTML = `<canvas id="map-canvas" width="1024" height="700"></canvas>`;
  $('stats-screen').innerHTML = `<div id="stats-inner"></div>`;
  refreshTitleSlots();
  $('btn-start').addEventListener('click', () => startGame());
}

export function refreshTitleSlots() {
  const el = $('title-slots');
  if (el) el.innerHTML = [1, 2, 3].map((n) => `<div class="title-slot">${slotSummary(n)}</div>`).join('');
}

export function startGame() {
  G.mode = 'play';
  $('title-screen').classList.add('hidden');
  $('hud').classList.remove('hidden');
  sfx('passed');
}

export function toggleMap(force) {
  G.mapOpen = force !== undefined ? force : !G.mapOpen;
  $('map-screen').classList.toggle('hidden', !G.mapOpen);
  if (G.mapOpen) drawFullMap();
}
export function toggleStats(force) {
  G.statsOpen = force !== undefined ? force : !G.statsOpen;
  $('stats-screen').classList.toggle('hidden', !G.statsOpen);
  if (G.statsOpen) renderStats();
}

export function renderStats() {
  const s = G.stats;
  const pct = completionPct();
  const ri = rankIdx();
  const check = (ok, label) => `<div class="chk ${ok ? 'done' : ''}">${ok ? '✔' : '○'} ${label}</div>`;
  $('stats-inner').innerHTML = `
  <h2>CAREER — NEON PALMS</h2>
  <div id="pct-big">${pct}% <span>COMPLETE</span></div>
  <div class="stats-cols">
    <div>
      <h3>CHECKLIST</h3>
      ${check(G.missionIdx >= 8, `Story missions ${Math.min(G.missionIdx, 8)}/8 for Valentina`)}
      ${check(s.racesWon >= 6, `Street races won ${s.racesWon}/6`)}
      ${check(s.duelsWon >= 1, `Pink-slip duels won ${s.duelsWon}`)}
      ${check(s.collectibles >= 12, `Neon palms collected ${s.collectibles}/12`)}
      ${check(G.respect >= 1000, `Reach PALMS LEGEND (${G.respect}/1000 RESPECT)`)}
      <h3>PER-MISSION MEDALS</h3>
      ${MISSIONS.map((m) => `<div class="medal">${s.medals[m.id] ? '🏅 ' + s.medals[m.id] : '—'} · ${m.name}</div>`).join('')}
    </div>
    <div>
      <h3>CAREER STATS</h3>
      <div class="stat-row">Cash on hand <b>$${G.cash.toLocaleString('en-US')}</b></div>
      <div class="stat-row">Career earnings <b>$${s.earned.toLocaleString('en-US')}</b></div>
      <div class="stat-row">Races run / won <b>${s.racesRun} / ${s.racesWon}</b></div>
      <div class="stat-row">Duels run / won <b>${s.duelsRun} / ${s.duelsWon}</b></div>
      <div class="stat-row">Cars stolen <b>${s.carsStolen}</b></div>
      <div class="stat-row">Shots fired <b>${s.shotsFired}</b></div>
      <div class="stat-row">Top speed <b>${s.topSpeed} km/h</b></div>
      <div class="stat-row">Distance driven <b>${s.distanceKm.toFixed(1)} km</b></div>
      <h3>RACES</h3>
      ${RACES.map((r) => `<div class="medal">${r.name} — ${r.district} · 1st $${r.prizes[0]}</div>`).join('')}
    </div>
    <div>
      <h3>RESPECT LADDER</h3>
      ${RANKS.map((r, i) => `<div class="rank-row ${i === ri ? 'current' : ''} ${G.respect >= r.need ? 'earned' : ''}">
        <b>${r.name}</b> <span>${r.need} RP</span><br><small>${r.unlock}</small></div>`).join('')}
      <div class="stat-row">NEXT UNLOCK <b>${ri < RANKS.length - 1 ? RANKS[ri + 1].unlock : '— (max rank)'}</b></div>
      <h3>SAVE SLOTS (click to save · L+1/2/3 loads)</h3>
      ${[1, 2, 3].map((n) => `<button class="save-btn" data-slot="${n}">${slotSummary(n)} — SAVE HERE</button>`).join('')}
      <div class="dim">P or Esc closes · progress also autosaves to slot ${G.saveSlot} on MISSION PASSED</div>
    </div>
  </div>`;
  document.querySelectorAll('.save-btn').forEach((b) => b.addEventListener('click', () => {
    saveGame(Number(b.dataset.slot)); G.saveSlot = Number(b.dataset.slot); renderStats(); refreshTitleSlots(); sfx('coin');
  }));
}
export { addCash };
