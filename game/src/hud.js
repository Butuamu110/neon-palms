// NEON PALMS — HUD: four-sided layout.
// TL mission panel + dispatch, TR clock/cash/stars/weapon wheel, BL minimap block
// data, BR radio + vehicle panel, BC dialogue portrait, crew cards, banners, prompts.
import { G, WEAPONS, RADIO, CREW, RANKS, rankIdx, rankProgress, districtAt, feed } from './config.js';
import { currentStage, MISSIONS } from './missions.js';
import { clamp } from './rng.js';
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
let els = {};

export function buildHUD() {
  const root = $('hud');
  root.innerHTML = `
  <div id="hud-tl" class="hud-box">
    <div id="mission-title">FREE ROAM — SAN VERDE</div>
    <div id="mission-stage"></div>
    <div id="mission-next"></div>
    <div id="dispatch">
      <div class="dispatch-head">SAN VERDE PD — INTERDICTION DISPATCH</div>
      <div id="dispatch-units"></div>
      <div id="dispatch-feed"></div>
    </div>
  </div>
  <div id="hud-tr" class="hud-box">
    <div id="clock-line"><span id="clock">17:42</span> <span id="tod-label">GOLDEN HOUR</span></div>
    <div id="cash">$1,250</div>
    <div id="stars"></div>
    <div id="sight-line">SEARCHING</div>
    <div id="weapon-wheel"></div>
    <div id="health-line"><span id="hp-bar"><i></i></span><span id="armor-bar"><i></i></span></div>
  </div>
  <div id="hud-bl" class="hud-box">
    <canvas id="minimap" width="216" height="216"></canvas>
    <div id="district-name">Palms Strip</div>
    <div id="respect-line"></div>
    <div id="respect-bar"><i></i></div>
  </div>
  <div id="hud-br" class="hud-box">
    <div id="radio-line"></div>
    <div id="vehicle-panel"></div>
  </div>
  <div id="crew-cards"></div>
  <div id="dialogue" class="hidden">
    <div id="dlg-avatar">VR</div>
    <div id="dlg-body"><div id="dlg-name"></div><div id="dlg-role"></div><div id="dlg-line"></div></div>
  </div>
  <div id="banner" class="hidden"><div id="banner-title"></div><div id="banner-lines"></div></div>
  <div id="prompt"></div>
  <div id="center-msg"></div>
  <div id="race-line"></div>
  <div id="countdown"></div>
  <div id="autopilot-result"></div>`;
  els = {
    mTitle: $('mission-title'), mStage: $('mission-stage'), mNext: $('mission-next'),
    dUnits: $('dispatch-units'), dFeed: $('dispatch-feed'),
    clock: $('clock'), tod: $('tod-label'), cash: $('cash'), stars: $('stars'), sight: $('sight-line'),
    wheel: $('weapon-wheel'), hp: document.querySelector('#hp-bar i'), armor: document.querySelector('#armor-bar i'),
    district: $('district-name'), respect: $('respect-line'), respectBar: document.querySelector('#respect-bar i'),
    radio: $('radio-line'), vehicle: $('vehicle-panel'),
    crew: $('crew-cards'), dlg: $('dialogue'), dlgAvatar: $('dlg-avatar'), dlgName: $('dlg-name'), dlgRole: $('dlg-role'), dlgLine: $('dlg-line'),
    banner: $('banner'), bannerTitle: $('banner-title'), bannerLines: $('banner-lines'),
    prompt: $('prompt'), msg: $('center-msg'), race: $('race-line'), countdown: $('countdown'),
  };
  // weapon wheel slots
  els.wheel.innerHTML = WEAPONS.map((w, i) => `
    <div class="wslot ${w.locked ? 'locked' : ''}" data-i="${i}">
      <div class="wicon">${w.locked ? '🔒' : w.icon}</div>
      <div class="wname">${w.name}</div>
      <div class="wammo">${w.locked ? '$' + w.price : (w.ammo === Infinity ? '∞' : w.ammo)}</div>
    </div>`).join('');
  els.crew.innerHTML = CREW.map((c, i) => `
    <div class="crew-card" id="crew-${i}" style="border-color:${c.color}">
      <div class="crew-avatar" style="background:${c.color}">${c.name.slice(0, 2).toUpperCase()}</div>
      <div class="crew-info"><b>${c.name}</b> — ${c.label} <span class="crew-key">[${c.key}]</span></div>
      <div class="crew-cd"></div>
    </div>`).join('');
}

function fmt(n) { return '$' + Math.round(n).toLocaleString('en-US'); }

export function updateHUD() {
  const p = G.player;
  // TL — mission panel
  const m = G.mission, st = currentStage();
  if (m && st) {
    els.mTitle.textContent = m.def.name;
    els.mStage.textContent = `STAGE ${m.stage + 1}/${m.def.stages.length} — ${st.label}`;
    const next = m.def.stages[m.stage + 1];
    els.mNext.textContent = 'NEXT: ' + (next ? next.label : `Collect $${m.def.pay} + RESPECT ${m.def.respect} from Valentina`);
  } else if (G.race) {
    els.mTitle.textContent = G.race.def.name;
    els.mStage.textContent = `CHECKPOINT ${Math.min(G.race.cp + 1, G.race.def.cps.length)}/${G.race.def.cps.length} · POSITION ${G.race.pos}/6`;
    els.mNext.textContent = `NEXT: prize 1st $${G.race.def.prizes[0]} · 2nd $${G.race.def.prizes[1]} · 3rd $${G.race.def.prizes[2]}`;
  } else if (G.duel) {
    els.mTitle.textContent = 'PINK-SLIP DUEL';
    els.mStage.textContent = `CHECKPOINT ${Math.min(G.duel.cp + 1, 4)}/4 vs KENJI`;
    els.mNext.textContent = 'NEXT: winner takes the Ríos Special';
  } else {
    els.mTitle.textContent = G.missionIdx < MISSIONS.length ? 'FREE ROAM — NEXT: ' + MISSIONS[G.missionIdx].name : 'FREE ROAM — STORY COMPLETE';
    els.mStage.textContent = 'Visit Valentina at Club Válvula (gold ring) · races at blue rings · duel at red ring';
    els.mNext.textContent = 'NEXT: climb the RESPECT ladder to PALMS LEGEND';
  }
  // dispatch units
  if (G.cops.length) {
    els.dUnits.innerHTML = G.cops.slice(0, 4).map((u) =>
      `<div class="dunit"><b>${u.call}</b> ${u.role} · ${u.dist !== undefined ? u.dist + ' m' : '—'}</div>`).join('') +
      (G.heli ? '<div class="dunit"><b>CONDOR</b> AIR UNIT · SPOTLIGHT · overhead</div>' : '');
  } else {
    els.dUnits.innerHTML = '<div class="dunit dim">No units assigned — streets quiet</div>';
  }
  els.dFeed.innerHTML = G.feed.slice(0, 4).map((f) => `<div class="dfeed">${f.text}</div>`).join('');

  // TR
  const hh = Math.floor(G.clockMin / 60) % 24, mm = Math.floor(G.clockMin % 60);
  els.clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  els.tod.textContent = G.night ? 'NIGHT — NEON HOURS' : (hh >= 16 && hh < 19.4 ? 'GOLDEN HOUR' : 'DAY');
  els.cash.textContent = fmt(G.cash);
  els.stars.innerHTML = '★'.repeat(G.wanted) + '<span class="dim">' + '★'.repeat(5 - G.wanted) + '</span>';
  els.sight.textContent = G.wanted ? (G.sight === 'IN SIGHT' ? '● IN SIGHT' : '○ SEARCHING') : 'NO HEAT';
  els.sight.style.color = G.sight === 'IN SIGHT' && G.wanted ? '#ff4040' : '#ffe066';
  [...els.wheel.children].forEach((el, i) => {
    el.classList.toggle('active', i === G.weapon);
    const w = WEAPONS[i];
    el.querySelector('.wammo').textContent = w.locked ? '$' + w.price : (w.ammo === Infinity ? '∞' : w.ammo);
  });
  els.hp.style.width = clamp(G.health, 0, 100) + '%';
  els.armor.style.width = clamp(G.armor, 0, 100) + '%';

  // BL
  const d = districtAt(p.x, p.z);
  els.district.textContent = d.name;
  const rp = rankProgress();
  els.respect.innerHTML = `RESPECT — <b>${RANKS[rp.i].name}</b> · ${G.respect}/${rp.next} to ${RANKS[Math.min(rp.i + 1, RANKS.length - 1)].name}`;
  els.respectBar.style.width = Math.round(rp.frac * 100) + '%';

  // BR
  const st2 = RADIO[G.radio];
  els.radio.innerHTML = `📻 <b>${st2.name}</b><br><span class="dim">♪ ${st2.tracks[G.radioTrack % st2.tracks.length]}</span> <span class="dim">[R] switch</span>`;
  const car = G.player.inCar;
  if (car) {
    const kmh = Math.round(Math.abs(car.speed) * 3.6);
    const gear = car.speed < -0.5 ? 'R' : car.speed < 0.4 ? 'N' : kmh < 30 ? '1' : kmh < 60 ? '2' : kmh < 95 ? '3' : kmh < 135 ? '4' : '5';
    els.vehicle.innerHTML = `<div class="vmodel">${car.modelName}${car.nitro > 0 ? ' · NITRO!' : ''}</div>
      <div class="vcond">CONDITION <b style="color:${car.condition > 50 ? '#7dff9a' : car.condition > 25 ? '#ffe066' : '#ff4040'}">${Math.round(car.condition)}%</b></div>
      <div class="vspeed">${kmh}<span> km/h · gear ${gear}</span></div>`;
  } else {
    els.vehicle.innerHTML = `<div class="vmodel">ON FOOT</div><div class="vcond">E near a car — STEAL / ENTER · F fire · Shift sprint</div><div class="vspeed">—<span> km/h</span></div>`;
  }

  // crew cards
  CREW.forEach((c, i) => {
    const el = document.getElementById('crew-' + i);
    if (!el) return;
    const cd = G.crewCd[i];
    el.querySelector('.crew-cd').textContent = cd > 0 ? `cooldown ${cd.toFixed(0)}s` : 'READY';
    el.style.opacity = cd > 0 ? 0.55 : 1;
  });

  // dialogue
  if (G.dialogue && G.time < G.dialogue.until) {
    els.dlg.classList.remove('hidden');
    els.dlgAvatar.textContent = G.dialogue.initials;
    els.dlgAvatar.style.background = G.dialogue.color;
    els.dlgName.textContent = G.dialogue.who;
    els.dlgRole.textContent = G.dialogue.role;
    els.dlgLine.textContent = '"' + G.dialogue.line + '"';
  } else els.dlg.classList.add('hidden');

  // banner
  if (G.banner && G.time < G.banner.until) {
    els.banner.classList.remove('hidden');
    els.bannerTitle.textContent = G.banner.title;
    els.bannerLines.innerHTML = G.banner.lines.join('<br>');
  } else els.banner.classList.add('hidden');

  els.prompt.textContent = G.prompt || '';
  els.msg.textContent = G.time < G.msgUntil ? G.msg : '';

  // race centre line + countdown
  if (G.race || G.duel) {
    const rt = G.race || G.duel;
    if (!rt.started) {
      els.countdown.textContent = String(Math.max(1, Math.ceil(rt.countdown)));
      els.race.textContent = '';
    } else {
      els.countdown.textContent = rt.elapsed < 1 ? 'GO!' : '';
      els.race.textContent = G.race
        ? `POSITION ${G.race.pos}/6 · CHECKPOINT ${Math.min(G.race.cp + 1, G.race.def.cps.length)}/${G.race.def.cps.length} · ${rt.elapsed.toFixed(1)}s`
        : `DUEL · CHECKPOINT ${Math.min(G.duel.cp + 1, 4)}/4 · ${rt.elapsed.toFixed(1)}s`;
    }
  } else { els.countdown.textContent = ''; els.race.textContent = ''; }
}

// Crew abilities (called from main key handler).
export function useCrew(i) {
  if (G.crewCd[i] > 0) return;
  const car = G.player.inCar;
  if (i === 0) { // Dario — NITRO CACHE
    if (!car) { G.msg = 'Dario: "Nitro cache works in a car, genius."'; G.msgUntil = G.time + 2; return; }
    car.nitro = 4; G.crewCd[i] = CREW[i].cd; sfx('coin');
    feed('CREW — Dario cracked a NITRO CACHE [Z]: 4s boost');
  } else if (i === 1) { // Paz — QUICK FIX
    if (car) { car.condition = Math.min(100, car.condition + 45); if (car.dead && car.condition > 10) { car.dead = false; car.top = 34; } }
    G.health = Math.min(100, G.health + 25);
    G.crewCd[i] = CREW[i].cd; sfx('coin');
    feed('CREW — Paz QUICK FIX [X]: repairs + patch-up done');
  } else { // Ivo — EYES OUT
    G.eyesOut = 12;
    if (G.sight === 'IN SIGHT') { G.sight = 'SEARCHING'; G.sightTimer = Math.min(G.sightTimer, 4); }
    G.crewCd[i] = CREW[i].cd; sfx('coin');
    feed('CREW — Ivo EYES OUT [C]: police positions pinged, sight broken');
  }
}
