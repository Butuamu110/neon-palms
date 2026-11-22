// NEON PALMS — the 8-mission story campaign for Valentina 'Válvula' Ríos.
// Stage types: goto | drive (goto in a car) | checkpoints | shoot | escape | duel.
import { G, addCash, addRespect, feed, say, BOSS } from './config.js';
import { markers } from './city.js';
import { clamp } from './rng.js';
import { spawnPed } from './pedestrians.js';
import { commitCrime } from './police.js';
import { sfx } from './audio.js';

const V = BOSS;
const CREW_NPC = {
  dario: { name: 'Dario', role: 'Wheelman — Ríos Crew', initials: 'DA', color: '#37c8ff' },
  paz: { name: 'Paz', role: 'Wrench — Ríos Crew', initials: 'PA', color: '#7dff9a' },
  ivo: { name: 'Ivo', role: 'Lookout — Ríos Crew', initials: 'IV', color: '#ffe066' },
  kenji: { name: "Kenji 'Kingslip' Aoki", role: 'Rival — Kingslip Crew', initials: 'KA', color: '#ff4040' },
};

export const MISSIONS = [
  { id: 'm1', name: 'GROCERY RUN FOR THE QUEEN', giver: 'Valentina', pay: 600, respect: 45, unlock: 'Neón Comet available at Club Válvula lot',
    stages: [
      { type: 'goto', x: -168, z: 44, label: 'Meet Valentina outside Club Válvula', who: V, line: 'New blood. I run the Ríos crew — tonight you run my groceries. First rule: the crew eats before the city does.' },
      { type: 'drive', x: -104, z: 236, label: 'Take a car and reach the Palms Strip market', who: CREW_NPC.dario, line: 'Dario here. Press E by any parked car to take it — wheels are wheels. Market is south on the Strip.' },
      { type: 'drive', x: 196, z: 150, label: 'Deliver the groceries to the Marina Alba bar, Puerto Alba', who: V, line: 'Groceries ride shotgun. Puerto Alba, Marina Alba bar — and if Interdiction sniffs you, lose them, do not lead them to me.' },
      { type: 'drive', x: -120, z: 246, label: 'Park up at the Ríos garage on Palms Strip', who: CREW_NPC.paz, line: 'Paz, wrench. Bring my baby back in one piece and I will keep her purring. Garage is on the Strip.' },
    ] },
  { id: 'm2', name: 'STICKER SHOCK', giver: 'Valentina', pay: 850, respect: 55, unlock: 'Crew hotline — Ivo EYES OUT upgraded',
    stages: [
      { type: 'goto', x: -168, z: 44, label: 'Pick up the decal crate at Club Válvula', who: V, line: 'Fresh Ríos decals. Every racer on Club Mile wears my palm by Friday — start with the Underpass crew.' },
      { type: 'drive', x: -252, z: -168, label: 'Deliver decals to the Underpass Garage', who: CREW_NPC.ivo, line: 'Ivo on lookout. The Underpass is quiet… too quiet. Keep your headlights honest.' },
      { type: 'escape', x: -120, z: 246, label: 'Lose the heat and reach the Ríos garage', stars: 2, who: V, line: 'Interdiction rolled up on the drop! Break their sight line, let the stars cool, then come home.' },
    ] },
  { id: 'm3', name: 'QUALIFYING HEAT', giver: 'Valentina', pay: 1000, respect: 65, unlock: 'Street races open — 6 events on the map',
    stages: [
      { type: 'goto', x: -168, z: 44, label: 'Get your race brief at Club Válvula', who: V, line: 'Talk is cheap. The ladder is real: six races, six districts of pride. Show me a qualifying line first.' },
      { type: 'checkpoints', cps: [[-60, 120], [60, 66], [186, 126], [66, 240], [-60, 246]], label: 'Hit all 5 qualifying checkpoints', who: CREW_NPC.dario, line: 'Rings are live. Thread them clean — position is tracked against the whole grid, so drive like it counts.' },
    ] },
  { id: 'm4', name: 'PARTS & RECKLESSNESS', giver: 'Paz', pay: 1300, respect: 75, unlock: 'Marea Lowrider unlocked in the garage list',
    stages: [
      { type: 'drive', x: 210, z: -160, label: 'Steal the parts-hauler in the Heights of San Verde', who: CREW_NPC.paz, line: 'A Kingslip hauler full of OUR parts sits in the Heights. Take the car, take the parts back. Simple theft, honest work.' },
      { type: 'shoot', count: 3, x: 210, z: -160, label: 'Drop 3 Kingslip scouts guarding the hauler', who: CREW_NPC.ivo, line: 'Scouts on the hauler — three of them, all armed. F to fire. Make it loud, make it quick.' },
      { type: 'drive', x: -252, z: -168, label: 'Deliver the hauler to the Underpass Garage', who: CREW_NPC.paz, line: 'Hauler is rolling. Underpass Garage, and try not to gift-wrap it for VIPER-3 on the way.' },
    ] },
  { id: 'm5', name: 'HARBOR LIGHTS', giver: 'Valentina', pay: 1600, respect: 85, unlock: 'Alba Interceptor bait car unlocked',
    stages: [
      { type: 'goto', x: 196, z: 150, label: 'Meet the harbour contact at Marina Alba', who: V, line: 'A package came in with the tide at Puerto Alba. No questions, no names — just drive it home.' },
      { type: 'checkpoints', cps: [[120, 66], [60, 120], [-60, 66], [-120, 150]], label: 'Run the harbour route — 4 rings before the tide turns', who: CREW_NPC.dario, line: 'Harbour route is lit. Four rings, no shortcuts through the marina water, entendido?' },
      { type: 'drive', x: -168, z: 44, label: 'Deliver the package to Club Válvula', who: V, line: 'Club Válvula. Back door. If the package ticks, drive faster.' },
    ] },
  { id: 'm6', name: 'PINK SLIP PRELUDE', giver: 'Valentina', pay: 2000, respect: 100, unlock: 'Pink-slip duels open on Palms Strip',
    stages: [
      { type: 'goto', x: -228, z: 228, label: 'Face Kenji at the Strip duel marker', who: CREW_NPC.kenji, line: 'Ríos errand-runner. My Ríos Special says your whole crew is a grocery list with headlights.' },
      { type: 'duel', cps: [[-66, 186], [66, 126], [186, 186], [246, 294]], label: 'Beat Kenji to the marina finish — pink slip rules', who: V, line: 'He insulted my crew on my Strip. Take his slip, or do not come back to my club.' },
    ] },
  { id: 'm7', name: 'INTERDICTION BLUES', giver: 'Ivo', pay: 2400, respect: 110, unlock: 'CONDOR evasion training — sight decays faster',
    stages: [
      { type: 'goto', x: -240, z: 110, label: 'Meet Ivo on Club Mile', who: CREW_NPC.ivo, line: 'Interdiction built a case on the whole crew. Tonight they raid — I need you loud and visible, a decoy with a smile.' },
      { type: 'escape', x: -252, z: -168, label: 'Draw 3 stars of heat, then vanish to the Underpass Garage', stars: 3, who: CREW_NPC.ivo, line: 'CONDOR will be up at four stars. Break sight, kill the clock, vanish into the Underpass.' },
    ] },
  { id: 'm8', name: 'THE MIDNIGHT GRAND PRIX', giver: 'Valentina', pay: 6000, respect: 250, unlock: 'PALMS LEGEND ceremony + Golden Neón livery',
    stages: [
      { type: 'goto', x: -168, z: 44, label: 'Take the crown brief at Club Válvula', who: V, line: 'One race left between you and legend. The whole city starts at midnight — every district, every rival, my crown on the line.' },
      { type: 'checkpoints', cps: [[60, 126], [186, 66], [294, -66], [186, -186], [66, -294], [-66, -186], [-186, -66], [-294, 66], [-186, 186], [-60, 246]], label: 'Win the Midnight Grand Prix — 10 rings across all five districts', who: V, line: 'Ten rings. Five districts. One legend. GO.' },
    ] },
];

export function startMission(idx) {
  const def = MISSIONS[idx];
  if (!def) return false;
  G.mission = { def, idx, stage: 0, shotsHit: 0, spawned: false, cp: 0, duelRival: null, elapsed: 0 };
  const st = def.stages[0];
  say(st.who, st.line, 9);
  feed(`MISSION — ${def.name} started (Valentina 'Válvula' Ríos)`);
  return true;
}

export function currentStage() {
  return G.mission ? G.mission.def.stages[G.mission.stage] : null;
}

function advance() {
  const m = G.mission;
  m.stage++; m.shotsHit = 0; m.cp = 0; m.spawned = false;
  if (m.stage >= m.def.stages.length) { completeMission(); return; }
  const st = m.def.stages[m.stage];
  say(st.who, st.line, 9);
  feed(`OBJECTIVE — ${st.label}`);
}

function completeMission() {
  const m = G.mission;
  const def = m.def;
  addCash(def.pay);
  const dName = 'Palms Strip';
  addRespect(def.respect, dName);
  G.stats.missionsDone++;
  const medal = m.elapsed < 240 ? 'GOLD' : m.elapsed < 480 ? 'SILVER' : 'BRONZE';
  G.stats.medals[def.id] = medal;
  G.banner = {
    title: 'MISSION PASSED',
    lines: [`${def.name}`, `+$${def.pay} · RESPECT +${def.respect} · Medal ${medal}`, `Unlock: ${def.unlock}`],
    until: G.time + 7,
  };
  say(V, def.id === 'm8' ? 'PALMS LEGEND. The city is yours — the crew is family. Neón forever.' : `Paid in full: $${def.pay}. ${def.unlock}. Come see me for the next rung.`, 8);
  feed(`MISSION PASSED — ${def.name}: +$${def.pay}, RESPECT +${def.respect}`);
  sfx('passed');
  G.mission = null;
  G.missionIdx = m.idx + 1;
}

export function updateMissions(dt) {
  const m = G.mission;
  markers.mission.visible = false;
  if (!m) {
    // offer next mission at Club Válvula
    if (G.missionIdx < MISSIONS.length && !G.race && !G.duel) {
      markers.mission.visible = true;
      markers.mission.position.set(-168, 7, 44);
      markers.mission.rotation.y = Math.atan2(G.player.x + 168, G.player.z - 44);
      const dx = G.player.x + 168, dz = G.player.z - 44;
      if (dx * dx + dz * dz < 36 && !G.player.inCar) {
        G.prompt = `E — TALK TO VALENTINA (${MISSIONS[G.missionIdx].name})`;
        if (G.consumeE) startMission(G.missionIdx);
      }
    }
    return;
  }
  m.elapsed += dt;
  const st = m.def.stages[m.stage];
  const p = G.player;
  const showMarker = (x, z) => {
    markers.mission.visible = true;
    markers.mission.position.set(x, 7, z);
    markers.mission.rotation.y = Math.atan2(p.x - x, p.z - z);
  };
  if (st.type === 'goto' || st.type === 'drive') {
    showMarker(st.x, st.z);
    const d2 = (p.x - st.x) ** 2 + (p.z - st.z) ** 2;
    const ok = st.type === 'goto' ? d2 < 30 : (G.player.inCar && d2 < 64);
    if (ok) advance();
  } else if (st.type === 'checkpoints') {
    const [tx, tz] = st.cps[Math.min(m.cp, st.cps.length - 1)];
    showMarker(tx, tz);
    markers.checkpoint.visible = true;
    markers.checkpoint.position.set(tx, 7, tz);
    markers.checkpoint.rotation.y = Math.atan2(p.x - tx, p.z - tz);
    if (Math.hypot(p.x - tx, p.z - tz) < 11 && G.player.inCar) {
      m.cp++; sfx('coin'); feed(`CHECKPOINT ${m.cp}/${st.cps.length}`);
      if (m.cp >= st.cps.length) { markers.checkpoint.visible = false; advance(); }
    }
  } else if (st.type === 'shoot') {
    showMarker(st.x, st.z);
    if (!m.spawned) {
      m.spawned = true;
      for (let i = 0; i < st.count; i++) {
        const ped = spawnPed(st.x + (i - 1) * 7, st.z + (i % 2) * 6 - 3, { hostile: true, name: 'Kingslip Scout' });
        ped.health = 50;
      }
      feed('KINGSLIP SCOUTS — hostiles on site');
    }
    const alive = G.peds.filter((q) => q.hostile && !q.dead).length;
    if (alive === 0 && m.spawned) advance();
  } else if (st.type === 'escape') {
    if (!m.spawned) { m.spawned = true; commitCrime(st.stars, 'INTERDICTION RAID — decoy run'); }
    showMarker(st.x, st.z);
    const d2 = (p.x - st.x) ** 2 + (p.z - st.z) ** 2;
    if (d2 < 64 && G.wanted === 0) advance();
    else if (d2 < 64 && G.wanted > 0) { G.prompt = 'LOSE THE HEAT — break police sight until the stars are gone'; }
  } else if (st.type === 'duel') {
    const [tx, tz] = st.cps[Math.min(m.cp, st.cps.length - 1)];
    showMarker(tx, tz);
    if (G.player.inCar && Math.hypot(p.x - tx, p.z - tz) < 11) {
      m.cp++; sfx('coin'); feed(`DUEL CHECKPOINT ${m.cp}/${st.cps.length} — ahead of Kenji`);
      if (m.cp >= st.cps.length) advance();
    } else if (!G.player.inCar) {
      G.prompt = 'PINK-SLIP DUEL — you need to be driving';
    }
  }
}
