// NEON PALMS — city construction: renderer, golden-hour / night grading, ground texture
// (shared with the minimap), instanced buildings with lit windows, neon club fronts,
// palm trees, street lamps with additive glow sprites, collectible neon palms, markers.
import { G, CFG, DISTRICTS, districtAt } from './config.js';
import { rng, rr, ri, pick, clamp, lerp } from './rng.js';

export let renderer, scene, camera, sun, hemi, ambient;
export const colliders = [];        // {x0,z0,x1,z1} building AABBs
export const glowSprites = [];
let skyMat, groundTex, windowMats = [], signMats = [];
export const markers = { mission: null, race: null, duel: null, checkpoint: null };

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  return t;
}
export function worldToMap(x, z, size) { return [((x + CFG.world) / (CFG.world * 2)) * size, ((z + CFG.world) / (CFG.world * 2)) * size]; }

// Ground texture doubles as the textured map/minimap base.
export function makeGroundTexture() {
  return canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#274b3a'; g.fillRect(0, 0, w, h);
    for (const d of DISTRICTS) {
      const [x0, y0] = worldToMap(d.x0, d.z0, w), [x1, y1] = worldToMap(d.x1, d.z1, w);
      g.fillStyle = d.tint; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
    // beach + sea along the south edge (Palms Strip shore)
    g.fillStyle = '#e8c98a'; g.fillRect(0, h - 26, w, 14);
    g.fillStyle = '#123a5e'; g.fillRect(0, h - 12, w, 12);
    // marina water inlet in Puerto Alba
    g.fillStyle = '#164a73'; g.fillRect(w * 0.78, h * 0.62, w * 0.2, h * 0.3);
    // roads
    for (const L of CFG.roadLines) {
      const [p] = worldToMap(L, 0, w);
      g.fillStyle = '#23232b'; g.fillRect(p - 11, 0, 22, h); g.fillRect(0, p - 11, w, 22);
    }
    g.strokeStyle = '#ffd94d'; g.lineWidth = 1.4; g.setLineDash([10, 8]);
    for (const L of CFG.roadLines) {
      const [p] = worldToMap(L, 0, w);
      g.beginPath(); g.moveTo(p, 0); g.lineTo(p, h); g.stroke();
      g.beginPath(); g.moveTo(0, p); g.lineTo(w, p); g.stroke();
    }
    g.setLineDash([]);
    // park blobs
    g.fillStyle = '#2f6b46';
    for (let i = 0; i < 26; i++) { const x = rng() * w, y = rng() * h; g.beginPath(); g.arc(x, y, rr(8, 22), 0, 7); g.fill(); }
  });
}

// Club fronts sit OFF the road grid (front block is 24 m wide — never on a carriageway).
const CLUBS = [
  { name: 'CLUB VÁLVULA', x: -204, z: 30, color: '#ff2e88' },
  { name: 'NEÓN PALACE', x: -240, z: 120, color: '#c44dff' },
  { name: 'LA BOMBA', x: -120, z: -6, color: '#ffb347' },
  { name: 'VELVET MAREA', x: -84, z: 90, color: '#37c8ff' },
  { name: 'HOTEL PALMA REAL', x: -96, z: 268, color: '#ffe066' },
  { name: 'MARINA ALBA BAR', x: 216, z: 130, color: '#7dff9a' },
  { name: 'UNDERPASS GARAGE', x: -250, z: -152, color: '#37c8ff' },
  { name: 'SAN VERDE DINER', x: 150, z: -152, color: '#ff5fa2' },
];

export function initCity() {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.getElementById('game-canvas').appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf7a56b, 90, 620);
  camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1500);

  // gradient sky dome
  skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x3b2a6e) }, mid: { value: new THREE.Color(0xe85d8a) }, bot: { value: new THREE.Color(0xffb347) } },
    vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float t=normalize(vP).y; vec3 c = t>0.25? mix(mid,top,smoothstep(0.25,0.85,t)) : mix(bot,mid,smoothstep(-0.05,0.25,t)); gl_FragColor=vec4(c,1.0); }',
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1100, 24, 12), skyMat));

  hemi = new THREE.HemisphereLight(0xffd9b0, 0x33415e, 0.85); scene.add(hemi);
  ambient = new THREE.AmbientLight(0x604a70, 0.5); scene.add(ambient);
  sun = new THREE.DirectionalLight(0xffb36b, 2.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -130; sun.shadow.camera.right = 130;
  sun.shadow.camera.top = 130; sun.shadow.camera.bottom = -130;
  sun.shadow.camera.far = 700;
  scene.add(sun); scene.add(sun.target);

  // ground
  groundTex = makeGroundTexture();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.world * 2, CFG.world * 2),
    new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  G.groundTexture = groundTex;

  buildBuildings();
  buildPalmsAndLamps();
  buildClubs();
  buildCollectibles();
  buildMarkers();
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}

function windowTextures(base, lit) {
  // one RNG pass drives both maps so the lit windows in the colour map are
  // exactly the windows that glow in the emissive map at night
  const cells = [];
  for (let y = 6; y < 128 - 6; y += 12) for (let x = 5; x < 64 - 5; x += 11) cells.push(rng() < 0.52);
  const map = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    let i = 0;
    for (let y = 6; y < h - 6; y += 12) for (let x = 5; x < w - 5; x += 11) {
      g.fillStyle = cells[i++] ? lit : 'rgba(20,22,34,0.9)';
      g.fillRect(x, y, 7, 8);
    }
  });
  const emissive = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#000000'; g.fillRect(0, 0, w, h);
    let i = 0;
    for (let y = 6; y < h - 6; y += 12) for (let x = 5; x < w - 5; x += 11) {
      if (cells[i++]) { g.fillStyle = lit; g.fillRect(x, y, 7, 8); }
    }
  });
  return { map, emissive };
}

function buildBuildings() {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const palette = ['#4a3f5e', '#5e4453', '#3d4a63', '#66503a', '#51425f', '#42565e'];
  const mats = palette.map((p, i) => {
    const lit = i % 2 ? '#ffd94d' : '#9adcff';
    const tex = windowTextures(p, lit);
    const m = new THREE.MeshStandardMaterial({ map: tex.map, roughness: 0.85, emissive: 0xffffff, emissiveIntensity: 0.0, emissiveMap: tex.emissive });
    m.map.colorSpace = THREE.SRGBColorSpace;
    windowMats.push(m);
    return m;
  });
  const spots = [];
  for (let bx = -330; bx < 330; bx += 30) for (let bz = -330; bz < 330; bz += 30) {
    const cx = bx + 15, cz = bz + 15;
    if (CFG.roadLines.some((L) => Math.abs(cx - L) < 24 || Math.abs(cz - L) < 24)) continue;
    if (cx > 190 && cz > 90 && cz < 330 && cx < 330) continue; // marina water
    if (rng() < 0.22) continue;
    spots.push({ x: cx + rr(-4, 4), z: cz + rr(-4, 4) });
  }
  const inst = new THREE.InstancedMesh(geo, mats[0], spots.length);
  // InstancedMesh takes one material; use vertex-color-free approach: several instanced meshes by palette.
  scene.remove(inst);
  const byMat = mats.map(() => []);
  spots.forEach((s, i) => byMat[i % mats.length].push(s));
  const dummy = new THREE.Object3D();
  byMat.forEach((list, mi) => {
    const im = new THREE.InstancedMesh(geo, mats[mi], list.length);
    list.forEach((s, i) => {
      const tall = districtAt(s.x, s.z).name === 'Heights of San Verde' ? rr(22, 52) : rr(9, 34);
      const wdt = rr(13, 22), dep = rr(13, 22);
      dummy.position.set(s.x, 0, s.z);
      dummy.scale.set(wdt, tall, dep);
      dummy.rotation.y = 0;
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      colliders.push({ x0: s.x - wdt / 2, z0: s.z - dep / 2, x1: s.x + wdt / 2, z1: s.z + dep / 2 });
    });
    im.castShadow = true; im.receiveShadow = true;
    scene.add(im);
  });
}

function glowTexture() {
  return canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
}
export let glowTex;
function addGlow(x, y, z, color, scale) {
  const m = new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 });
  const s = new THREE.Sprite(m); s.position.set(x, y, z); s.scale.set(scale, scale, 1);
  scene.add(s); glowSprites.push(s);
  return s;
}

function buildPalmsAndLamps() {
  glowTex = glowTexture();
  const trunkG = new THREE.CylinderGeometry(0.22, 0.34, 6, 6); trunkG.translate(0, 3, 0);
  const frondG = new THREE.ConeGeometry(3.2, 1.1, 7); frondG.translate(0, 6.2, 0);
  const trunkM = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 });
  const frondM = new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 1, emissive: 0x0d3a22, emissiveIntensity: 0.4 });
  const spots = [];
  for (let i = 0; i < 130; i++) {
    const x = rr(-325, 325), z = rr(-325, 325);
    if (CFG.roadLines.some((L) => Math.abs(x - L) < 13 || Math.abs(z - L) < 13)) continue;
    if (colliders.some((c) => x > c.x0 - 2 && x < c.x1 + 2 && z > c.z0 - 2 && z < c.z1 + 2)) continue;
    spots.push({ x, z });
  }
  const trunks = new THREE.InstancedMesh(trunkG, trunkM, spots.length);
  const fronds = new THREE.InstancedMesh(frondG, frondM, spots.length);
  const dummy = new THREE.Object3D();
  spots.forEach((s, i) => {
    dummy.position.set(s.x, 0, s.z); dummy.rotation.y = rng() * 6.28; dummy.scale.setScalar(rr(0.85, 1.3));
    dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix); fronds.setMatrixAt(i, dummy.matrix);
  });
  trunks.castShadow = true; scene.add(trunks); scene.add(fronds);
  // street lamps along roads
  const poleG = new THREE.CylinderGeometry(0.09, 0.09, 5.4, 5); poleG.translate(0, 2.7, 0);
  const poleM = new THREE.MeshStandardMaterial({ color: 0x22222c });
  const lampSpots = [];
  for (const L of CFG.roadLines) for (let p = -320; p <= 320; p += 40) { lampSpots.push({ x: L + 9, z: p }); lampSpots.push({ x: p, z: L - 9 }); }
  const poles = new THREE.InstancedMesh(poleG, poleM, lampSpots.length);
  lampSpots.forEach((s, i) => { dummy.position.set(s.x, 0, s.z); dummy.rotation.y = 0; dummy.scale.setScalar(1); dummy.updateMatrix(); poles.setMatrixAt(i, dummy.matrix); });
  scene.add(poles);
  lampSpots.forEach((s, i) => { if (i % 2 === 0) addGlow(s.x, 5.5, s.z, 0xffc37a, 5).material.opacity = 0.3; });
  G.lampGlows = glowSprites.length;
}

function buildClubs() {
  for (const club of CLUBS) {
    const tex = canvasTex(512, 96, (g, w, h) => {
      g.fillStyle = '#0b0b14'; g.fillRect(0, 0, w, h);
      g.font = 'bold 52px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = club.color; g.shadowBlur = 26;
      g.fillStyle = club.color; g.fillText(club.name, w / 2, h / 2);
      g.shadowBlur = 8; g.fillStyle = '#ffffff'; g.font = 'bold 50px Arial';
      g.globalAlpha = 0.85; g.fillText(club.name, w / 2, h / 2);
    });
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    signMats.push(mat);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(26, 4.9), mat);
    sign.position.set(club.x, 9, club.z);
    sign.rotation.y = Math.atan2(-club.x, -club.z) + Math.PI / 2;
    scene.add(sign);
    const hex = new THREE.Color(club.color).getHex();
    addGlow(club.x, 9, club.z, hex, 30);
    // club front block — dark glass with a neon-tinted emissive trim in the club colour
    const front = new THREE.Mesh(new THREE.BoxGeometry(24, 8, 3), new THREE.MeshStandardMaterial({ color: 0x23232f, roughness: 0.6, emissive: new THREE.Color(club.color), emissiveIntensity: 0.22 }));
    front.position.set(club.x, 4, club.z + 2); front.castShadow = true; scene.add(front);
  }
}

function buildCollectibles() {
  const geo = new THREE.ConeGeometry(1.1, 2.6, 6);
  for (let i = 0; i < G.stats.collectTotal; i++) {
    const d = DISTRICTS[i % 5];
    const x = rr(d.x0 + 25, d.x1 - 25), z = rr(d.z0 + 25, d.z1 - 25);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff2e88, emissive: 0xff2e88, emissiveIntensity: 1.6 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, 2.2, z); m.rotation.x = Math.PI;
    scene.add(m); addGlow(x, 2.2, z, 0xff2e88, 9);
    G.collectibles.push({ x, z, mesh: m, got: false });
  }
}

function ring(color) {
  // standing drive-through ring (torus in the vertical XY plane, base at ground)
  const m = new THREE.Mesh(
    new THREE.TorusGeometry(7, 0.55, 10, 36),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 })
  );
  m.position.y = 7; m.visible = false;
  scene.add(m);
  return m;
}
function buildMarkers() {
  markers.mission = ring(0xffd94d);
  markers.race = ring(0x37c8ff);
  markers.duel = ring(0xff4040);
  markers.checkpoint = ring(0x7dff9a);
}

export function collide(x, z, r = 1) {
  for (const c of colliders) {
    if (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) return c;
  }
  return null;
}
export function pushOut(p, r = 1) {
  const c = collide(p.x, p.z, r);
  if (!c) return;
  const dxl = p.x - (c.x0 - r), dxr = (c.x1 + r) - p.x, dzl = p.z - (c.z0 - r), dzr = (c.z1 + r) - p.z;
  const m = Math.min(dxl, dxr, dzl, dzr);
  if (m === dxl) p.x = c.x0 - r; else if (m === dxr) p.x = c.x1 + r;
  else if (m === dzl) p.z = c.z0 - r; else p.z = c.z1 + r;
}

// Golden-hour <-> night grading driven by time of day.
const C = (h) => new THREE.Color(h);
export function updateSky() {
  const h = G.tod;
  const nightF = (h >= 19.4 || h < 5.6) ? 1 : (h > 18.2 ? (h - 18.2) / 1.2 : 0);
  G.night = nightF > 0.55;
  const top = C(0x3b2a6e).lerp(C(0x05060f), nightF);
  const mid = C(0xe85d8a).lerp(C(0x0d1030), nightF);
  const bot = C(0xffb347).lerp(C(0x101a33), nightF);
  skyMat.uniforms.top.value.copy(top); skyMat.uniforms.mid.value.copy(mid); skyMat.uniforms.bot.value.copy(bot);
  scene.fog.color.copy(C(0xf7a56b).lerp(C(0x0a0e22), nightF));
  scene.fog.near = lerp(90, 55, nightF); scene.fog.far = lerp(620, 380, nightF);
  const sunA = ((h - 6) / 12) * Math.PI; // day arc
  const dayF = clamp(Math.sin(sunA), 0, 1);
  const px = G.player.inCar ? G.player.inCar.x : G.player.x;
  const pz = G.player.inCar ? G.player.inCar.z : G.player.z;
  sun.position.set(px + Math.cos(sunA) * 190, 26 + dayF * 150 + (G.night ? -60 : 0), pz + 90);
  sun.target.position.set(px, 0, pz);
  sun.intensity = lerp(0.12, 2.0, Math.max(dayF, G.night ? 0 : 0.35)) * (G.night ? 0.15 : 1);
  sun.color.copy(C(0xffb36b).lerp(C(0x8fb4ff), G.night ? 1 : 0));
  hemi.intensity = lerp(1.05, 0.3, nightF);
  ambient.intensity = lerp(0.65, 0.34, nightF);
  for (const m of windowMats) m.emissiveIntensity = lerp(0.12, 0.85, nightF);
  const glowO = lerp(0.35, 0.95, nightF);
  glowSprites.forEach((s, i) => { if (s.visible) s.material.opacity = i < (G.lampGlows || 0) ? lerp(0.18, 0.5, nightF) : glowO; });
  renderer.toneMappingExposure = lerp(1.25, 1.12, nightF);
}
