import * as THREE from 'three';
import './style.css';

const stage = document.querySelector<HTMLDivElement>('#stage')!;
const scoreEl = document.querySelector<HTMLElement>('#score')!;
const finalScoreEl = document.querySelector<HTMLElement>('#final-score')!;
const resultEl = document.querySelector<HTMLElement>('#result')!;
const hintEl = document.querySelector<HTMLElement>('#hint')!;
const objectiveEl = document.querySelector<HTMLElement>('#objective')!;
const popEl = document.querySelector<HTMLElement>('#multiplier')!;
const restartBtn = document.querySelector<HTMLButtonElement>('#restart')!;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8f4f33);
scene.fog = new THREE.Fog(0x8f4f33, 24, 55);

const camera = new THREE.OrthographicCamera(-7, 7, 12.5, -12.5, 0.1, 100);
camera.position.set(10, 17, 23);
camera.lookAt(0, 0, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffe4bd, 0x522921, 2.7));
const sun = new THREE.DirectionalLight(0xffd6a2, 3.2);
sun.position.set(-6, 16, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -12; sun.shadow.camera.right = 12; sun.shadow.camera.top = 20; sun.shadow.camera.bottom = -20;
scene.add(sun);

const world = new THREE.Group();
scene.add(world);

const mat = (color: number, roughness = .8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const rockMats = [mat(0xa95f3f), mat(0x81412f), mat(0xc07148)];

function box(size: [number, number, number], color: number, pos: [number, number, number], parent = world) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat(color));
  mesh.position.set(...pos); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

function makeTextSprite(text: string, color: string, bg: string) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 192;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(8, 8, 496, 176, 32); ctx.fill();
  ctx.fillStyle = color; ctx.font = '900 96px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 102);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
}

// A sprite whose canvas can be redrawn in place (for live-updating cost / status labels).
function makeDynamicSprite(initial: string, color: string, bg: string, w = 420, h = 170) {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  function draw(text: string) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(6, 6, w - 12, h - 12, 26); ctx.fill();
    ctx.fillStyle = color; ctx.font = `900 ${Math.floor(h * .46)}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h * .54);
    texture.needsUpdate = true;
  }
  draw(initial);
  return { sprite, draw };
}

function flashPop(text: string) { popEl.textContent = text; popEl.classList.remove('pop'); void popEl.offsetWidth; popEl.classList.add('pop'); }

// ---- Path: a winding polyline the carrier travels at constant speed via arc-length lookup. ----
type Waypoint = { x: number; z: number };
type PathSample = { point: THREE.Vector3; tangent: THREE.Vector3 };
type PathTable = { waypoints: THREE.Vector3[]; cumulative: number[]; totalLength: number };

function buildPathTable(pts: Waypoint[]): PathTable {
  const waypoints = pts.map(w => new THREE.Vector3(w.x, 0, w.z));
  const cumulative = [0];
  for (let i = 1; i < waypoints.length; i++) cumulative.push(cumulative[i - 1] + waypoints[i].distanceTo(waypoints[i - 1]));
  return { waypoints, cumulative, totalLength: cumulative[cumulative.length - 1] };
}
function sampleAtDistance(table: PathTable, distance: number): PathSample {
  const d = THREE.MathUtils.clamp(distance, 0, table.totalLength);
  let lo = 0, hi = table.cumulative.length - 1;
  while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (table.cumulative[mid] <= d) lo = mid; else hi = mid; }
  const segLen = table.cumulative[hi] - table.cumulative[lo];
  const frac = segLen > 1e-6 ? (d - table.cumulative[lo]) / segLen : 0;
  const point = table.waypoints[lo].clone().lerp(table.waypoints[hi], frac);
  const tangent = table.waypoints[hi].clone().sub(table.waypoints[lo]).normalize();
  return { point, tangent };
}
function perpOf(tangent: THREE.Vector3) { return new THREE.Vector3(-tangent.z, 0, tangent.x); }

const LEVEL_WAYPOINTS: Waypoint[] = [
  { x: 0, z: 14 }, { x: 0, z: 4 }, { x: 5, z: -4 }, { x: 5, z: -16 },
  { x: -3, z: -24 }, { x: -3, z: -38 }, { x: 4, z: -46 }, { x: 4, z: -60 },
  { x: -2, z: -68 }, { x: -2, z: -82 }, { x: 0, z: -92 },
  { x: 4, z: -104 }, { x: -2, z: -118 }, { x: 0, z: -130 },
];
const pathTable = buildPathTable(LEVEL_WAYPOINTS);

// ---- Terrain: ground + canyon walls that hug the winding path. ----
const groundBounds = LEVEL_WAYPOINTS.reduce((b, w) => ({
  minX: Math.min(b.minX, w.x), maxX: Math.max(b.maxX, w.x), minZ: Math.min(b.minZ, w.z), maxZ: Math.max(b.maxZ, w.z),
}), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(groundBounds.maxX - groundBounds.minX + 26, groundBounds.maxZ - groundBounds.minZ + 26),
  mat(0x8e5237),
);
ground.rotation.x = -Math.PI / 2;
ground.position.set((groundBounds.minX + groundBounds.maxX) / 2, 0, (groundBounds.minZ + groundBounds.maxZ) / 2);
ground.receiveShadow = true; world.add(ground);

const rockGeo = new THREE.DodecahedronGeometry(1, 0);
for (let d = 0; d <= pathTable.totalLength; d += 2.3) {
  const s = sampleAtDistance(pathTable, d);
  const perp = perpOf(s.tangent);
  for (const side of [-1, 1]) {
    const rock = new THREE.Mesh(rockGeo, rockMats[Math.abs(Math.floor(d)) % rockMats.length]);
    const off = 7.4 + Math.random() * 1.3;
    const p = s.point.clone().addScaledVector(perp, side * off);
    rock.scale.set(1.4 + Math.random() * 1.2, 1.3 + Math.random() * 1.4, 1.2 + Math.random());
    rock.position.set(p.x, .6 + Math.random() * .5, p.z);
    rock.rotation.set(Math.random(), Math.random(), Math.random()); rock.castShadow = true; world.add(rock);
  }
}

// ---- Ore tiers: blue -> gold -> pink -> white-diamond. ----
const TOOL_YIELD_MULTIPLIER = [1, 1.6, 2.4, 3.6];
const LOCKED_YIELD_FRACTION = .15;
const DEPOSIT_BASE_VALUE = [8, 25, 60, 140];
const tierGeo = [
  new THREE.OctahedronGeometry(.32, 0),
  new THREE.CylinderGeometry(.32, .32, .15, 14),
  new THREE.OctahedronGeometry(.36, 1),
  new THREE.IcosahedronGeometry(.38, 0),
];
const tierMat = [
  new THREE.MeshStandardMaterial({ color: 0x24d8ff, emissive: 0x087cba, emissiveIntensity: .45, roughness: .24, metalness: .45 }),
  new THREE.MeshStandardMaterial({ color: 0xffd23c, emissive: 0x8a5300, emissiveIntensity: .28, roughness: .32, metalness: .82 }),
  new THREE.MeshStandardMaterial({ color: 0xff59e6, emissive: 0x8a0d78, emissiveIntensity: .5, roughness: .22, metalness: .55 }),
  new THREE.MeshStandardMaterial({ color: 0xeaf6ff, emissive: 0x6fb8ff, emissiveIntensity: .55, roughness: .15, metalness: .6 }),
];
const lockedMat = mat(0x4a4640, .95, .05);

// ---- Lightweight particle burst for mining/purchase feedback. ----
type Particle = { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number; maxLife: number };
let particles: Particle[] = [];
const particleGeo = new THREE.TetrahedronGeometry(.13);
function spawnBurst(pos: THREE.Vector3, color: number, count = 9) {
  const pm = mat(color, .4, .3);
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(particleGeo, pm);
    mesh.position.copy(pos); mesh.position.y += .35; mesh.castShadow = false; world.add(mesh);
    const angle = Math.random() * Math.PI * 2, speed = 1.4 + Math.random() * 1.6;
    particles.push({ mesh, velocity: new THREE.Vector3(Math.cos(angle) * speed, 2.2 + Math.random() * 1.6, Math.sin(angle) * speed), life: .55, maxLife: .55 });
  }
}
function updateParticles(dt: number) {
  for (const p of particles) {
    p.velocity.y -= dt * 7; p.mesh.position.addScaledVector(p.velocity, dt);
    p.life -= dt; p.mesh.scale.setScalar(Math.max(0, p.life / p.maxLife));
  }
  for (const p of particles) if (p.life <= 0) world.remove(p.mesh);
  particles = particles.filter(p => p.life > 0);
}

// ---- Ore deposits: sit on the path centerline, auto-mined as the carrier passes. ----
type OreTier = 0 | 1 | 2 | 3;
type OreDeposit = { t: number; tier: OreTier; mesh: THREE.Mesh; collected: boolean };
function buildDeposit(t: number, tier: OreTier): OreDeposit {
  const s = sampleAtDistance(pathTable, t);
  const perp = perpOf(s.tangent);
  const mesh = new THREE.Mesh(tierGeo[tier], tierMat[tier]);
  const jitter = (Math.random() - .5) * .6;
  mesh.position.copy(s.point).addScaledVector(perp, jitter); mesh.position.y = .34;
  mesh.rotation.set(Math.random(), Math.random(), Math.random()); mesh.castShadow = true; world.add(mesh);
  return { t, tier, mesh, collected: false };
}
const oreDepositDefs: { t: number; tier: OreTier }[] = [
  { t: 6, tier: 0 }, { t: 10, tier: 0 }, { t: 14, tier: 0 }, { t: 18, tier: 0 }, { t: 24, tier: 0 },
  { t: 30, tier: 1 }, { t: 36, tier: 1 },
  { t: 55, tier: 2 }, { t: 60, tier: 1 }, { t: 65, tier: 2 }, { t: 70, tier: 1 }, { t: 85, tier: 2 },
  { t: 110, tier: 2 }, { t: 120, tier: 3 }, { t: 125, tier: 2 }, { t: 140, tier: 3 },
];
const oreDeposits: OreDeposit[] = oreDepositDefs.map(d => buildDeposit(d.t, d.tier));

// ---- Upgrade kiosks: soft/missable, tap to spend currency and raise tool level. ----
type Kiosk = {
  t: number; cost: number; toToolLevel: number; purchased: boolean;
  group: THREE.Group; padMesh: ReturnType<typeof box>; toolIconMesh: THREE.Mesh; costSign: ReturnType<typeof makeDynamicSprite>;
};
function buildKiosk(t: number, cost: number, toToolLevel: number, side: 1 | -1): Kiosk {
  const s = sampleAtDistance(pathTable, t);
  const perp = perpOf(s.tangent);
  const pos = s.point.clone().addScaledVector(perp, side * 2.7);
  const group = new THREE.Group(); group.position.copy(pos); world.add(group);
  const padMesh = box([1.3, .14, 1.3], 0x2e8f7a, [0, .07, 0], group);
  padMesh.userData.kind = 'kiosk';
  const toolIconMesh = new THREE.Mesh(new THREE.ConeGeometry(.32, .6, 6), mat(0xffcf36, .35, .6));
  toolIconMesh.position.set(0, .5, 0); toolIconMesh.castShadow = true; group.add(toolIconMesh);
  const costSign = makeDynamicSprite(String(cost), '#0d3a2e', '#7cf7c9');
  costSign.sprite.position.set(0, 1.55, 0); costSign.sprite.scale.set(2.2, .9, 1); group.add(costSign.sprite);
  return { t, cost, toToolLevel, purchased: false, group, padMesh, toolIconMesh, costSign };
}
const kiosks: Kiosk[] = [
  buildKiosk(20, 50, 1, 1),
  buildKiosk(65, 90, 2, -1),
];

// ---- Toll gates: hard-blocking, must be paid to continue; grants a lump-sum bonus after. ----
type TollGate = {
  t: number; cost: number; rewardLumpSum: number; purchased: boolean;
  group: THREE.Group; barMesh: ReturnType<typeof box>; padMesh: ReturnType<typeof box>; costSign: ReturnType<typeof makeDynamicSprite>;
};
const STOP_STANDOFF = 1.5;
function buildGate(t: number, cost: number, rewardLumpSum: number): TollGate {
  const s = sampleAtDistance(pathTable, t);
  const yaw = Math.atan2(s.tangent.x, s.tangent.z);
  const group = new THREE.Group(); group.position.copy(s.point); group.rotation.y = yaw; world.add(group);
  const barMesh = box([6.5, 2.6, .4], 0xcc3b2e, [0, 1.3, 0], group);
  barMesh.userData.kind = 'gate';
  const padMesh = box([1.1, .14, 1.1], 0x8c39dd, [0, .07, 1.1], group);
  padMesh.userData.kind = 'gate';
  const costSign = makeDynamicSprite(String(cost), '#3a2409', '#ffe27a');
  costSign.sprite.position.set(0, 3.2, 0); costSign.sprite.scale.set(2.6, 1.05, 1); group.add(costSign.sprite);
  return { t, cost, rewardLumpSum, purchased: false, group, barMesh, padMesh, costSign };
}
const tollGates: TollGate[] = [
  buildGate(45, 80, 60),
  buildGate(100, 100, 90),
];

// ---- Opening beat: mash-tap a glowing ore capsule to crack it and kick off the run. ----
type OpeningOre = { mesh: THREE.Mesh; hitsRequired: number; hitsSoFar: number; cracked: boolean };
const OPENING_HITS_REQUIRED = 5;
const OPENING_REWARD_CURRENCY = 40;
const openingOreStart = sampleAtDistance(pathTable, 0).point.clone().add(new THREE.Vector3(0, 0, 3));
const openingOreMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), new THREE.MeshStandardMaterial({ color: 0x5fd0ff, emissive: 0x1a8fd6, emissiveIntensity: .55, roughness: .2, metalness: .35 }));
openingOreMesh.position.copy(openingOreStart); openingOreMesh.position.y = 1.1; openingOreMesh.castShadow = true;
openingOreMesh.userData.kind = 'openingOre'; world.add(openingOreMesh);
const openingOre: OpeningOre = { mesh: openingOreMesh, hitsRequired: OPENING_HITS_REQUIRED, hitsSoFar: 0, cracked: false };

// ---- Chest / ending. ----
const chestPos = sampleAtDistance(pathTable, pathTable.totalLength).point;
const chestGroup = new THREE.Group(); chestGroup.position.copy(chestPos); world.add(chestGroup);
box([1.7, 1, 1.2], 0x8a5a2e, [0, .5, 0], chestGroup);
box([1.8, .4, 1.3], 0xffd23c, [0, 1.15, 0], chestGroup);

// ---- Carrier: the small vehicle the camera follows; the player never steers it. ----
const carrierGroup = new THREE.Group(); world.add(carrierGroup);
box([1.5, .55, 2], 0x2e8f7a, [0, .5, 0], carrierGroup);
box([1.1, .5, 1], 0x7cf7c9, [0, .95, -.2], carrierGroup);
box([.16, .5, .16], 0x1c1c1c, [-.6, .3, .8], carrierGroup);
box([.16, .5, .16], 0x1c1c1c, [.6, .3, .8], carrierGroup);
box([.16, .5, .16], 0x1c1c1c, [-.6, .3, -.8], carrierGroup);
box([.16, .5, .16], 0x1c1c1c, [.6, .3, -.8], carrierGroup);

// ---- Raycaster-based tap handling for kiosks, gates, and the opening ore. ----
const raycaster = new THREE.Raycaster();
const interactables: THREE.Object3D[] = [openingOreMesh, ...kiosks.map(k => k.padMesh), ...tollGates.flatMap(g => [g.barMesh, g.padMesh])];
kiosks.forEach((k, i) => { k.padMesh.userData.index = i; });
tollGates.forEach((g, i) => { g.barMesh.userData.index = i; g.padMesh.userData.index = i; });

function handleTap(clientX: number, clientY: number) {
  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(interactables, false)[0]?.object;
  if (!hit) return;
  const kind = hit.userData.kind as 'kiosk' | 'gate' | 'openingOre';
  if (kind === 'openingOre') handleOpeningOreTap();
  else if (kind === 'kiosk') tryPurchaseKiosk(hit.userData.index as number);
  else tryPurchaseGate(hit.userData.index as number);
}
renderer.domElement.addEventListener('pointerdown', (e) => handleTap(e.clientX, e.clientY));

// ---- Run state. ----
type RunState = { currency: number; toolLevel: number; phase: 'opening' | 'traveling' | 'finished' };
type CarrierState = { distance: number; speed: number; baseSpeed: number; stoppedAtGate: number | null };
const BASE_SPEED = 3.2;
const run: RunState = { currency: 0, toolLevel: 0, phase: 'opening' };
const carrier: CarrierState = { distance: 0, speed: 0, baseSpeed: BASE_SPEED, stoppedAtGate: null };
let lastObjective = '', last = performance.now();

function refreshDepositLockVisuals() {
  for (const d of oreDeposits) if (!d.collected) d.mesh.material = d.tier <= run.toolLevel ? tierMat[d.tier] : lockedMat;
}

function handleOpeningOreTap() {
  if (openingOre.cracked) return;
  openingOre.hitsSoFar++;
  const frac = openingOre.hitsSoFar / openingOre.hitsRequired;
  openingOre.mesh.scale.setScalar(1 + Math.sin(frac * Math.PI) * .1);
  spawnBurst(openingOre.mesh.position, 0x5fd0ff, 5);
  if (openingOre.hitsSoFar >= openingOre.hitsRequired) {
    openingOre.cracked = true;
    world.remove(openingOre.mesh);
    spawnBurst(openingOre.mesh.position, 0x5fd0ff, 22);
    run.currency += OPENING_REWARD_CURRENCY;
    scoreEl.textContent = String(run.currency);
    flashPop('出发!');
    hintEl.style.opacity = '0';
    run.phase = 'traveling';
    carrier.speed = carrier.baseSpeed;
  }
}

function tryPurchaseKiosk(index: number) {
  const k = kiosks[index];
  if (k.purchased) return;
  if (run.currency < k.cost) { flashPop(`还需 ${k.cost - run.currency}`); return; }
  run.currency -= k.cost; scoreEl.textContent = String(run.currency);
  k.purchased = true; run.toolLevel = Math.max(run.toolLevel, k.toToolLevel);
  k.costSign.draw('已升级'); k.padMesh.material.color.set(0xffd23c);
  k.toolIconMesh.scale.setScalar(1.5); flashPop('升级!');
  refreshDepositLockVisuals();
  spawnBurst(k.group.position, 0xffd23c, 14);
}

function tryPurchaseGate(index: number) {
  const g = tollGates[index];
  if (g.purchased) return;
  if (run.currency < g.cost) { flashPop(`还需 ${g.cost - run.currency}`); return; }
  run.currency -= g.cost; scoreEl.textContent = String(run.currency);
  g.purchased = true;
  g.costSign.draw('通过!'); g.padMesh.material.color.set(0x35e07a);
  flashPop('通行!');
  spawnBurst(g.group.position, 0xcc3b2e, 12);
  g.barMesh.userData.retract = true; // eased down out of the way in updateGateBarriers()
  if (carrier.stoppedAtGate === index) carrier.stoppedAtGate = null;
  setTimeout(() => {
    run.currency += g.rewardLumpSum; scoreEl.textContent = String(run.currency);
    flashPop(`+${g.rewardLumpSum}`);
  }, 320);
}

function reset() {
  for (const d of oreDeposits) { d.collected = false; world.add(d.mesh); }
  for (const k of kiosks) { k.purchased = false; k.costSign.draw(String(k.cost)); k.padMesh.material.color.set(0x2e8f7a); k.toolIconMesh.scale.setScalar(1); }
  for (const g of tollGates) { g.purchased = false; g.costSign.draw(String(g.cost)); g.padMesh.material.color.set(0x8c39dd); g.barMesh.userData.retract = false; g.barMesh.position.y = 1.3; }
  openingOre.cracked = false; openingOre.hitsSoFar = 0; openingOre.mesh.scale.setScalar(1); world.add(openingOre.mesh);
  for (const p of particles) world.remove(p.mesh); particles = [];
  run.currency = 0; run.toolLevel = 0; run.phase = 'opening';
  carrier.distance = 0; carrier.speed = 0; carrier.stoppedAtGate = null;
  const start = sampleAtDistance(pathTable, 0);
  carrierGroup.position.copy(start.point); carrierGroup.rotation.y = Math.atan2(start.tangent.x, start.tangent.z);
  const startPerp = perpOf(start.tangent);
  camera.position.copy(start.point).add(new THREE.Vector3(0, CAMERA_UP, 0)).addScaledVector(start.tangent, -CAMERA_BACK).addScaledVector(startPerp, CAMERA_SIDE);
  refreshDepositLockVisuals();
  lastObjective = '';
  scoreEl.textContent = '0'; resultEl.hidden = true; hintEl.style.opacity = '1';
  objectiveEl.textContent = '敲碎晶石，开始旅程'; objectiveEl.style.opacity = '1';
}
restartBtn.addEventListener('click', reset);

function updateCarrier(dt: number) {
  if (run.phase !== 'traveling') return;
  if (carrier.stoppedAtGate !== null) return;
  let next = carrier.distance + carrier.speed * dt;
  for (let i = 0; i < tollGates.length; i++) {
    const g = tollGates[i];
    if (g.purchased) continue;
    const stopAt = g.t - STOP_STANDOFF;
    if (carrier.distance < stopAt && next >= stopAt) { next = stopAt; carrier.stoppedAtGate = i; break; }
  }
  carrier.distance = Math.min(next, pathTable.totalLength);
  const s = sampleAtDistance(pathTable, carrier.distance);
  carrierGroup.position.copy(s.point);
  carrierGroup.rotation.y = Math.atan2(s.tangent.x, s.tangent.z);
}

function updateMining() {
  for (const d of oreDeposits) {
    if (d.collected || carrier.distance < d.t) continue;
    d.collected = true;
    const mult = run.toolLevel >= d.tier ? TOOL_YIELD_MULTIPLIER[run.toolLevel] : LOCKED_YIELD_FRACTION;
    run.currency += Math.round(DEPOSIT_BASE_VALUE[d.tier] * mult);
    scoreEl.textContent = String(run.currency);
    spawnBurst(d.mesh.position, (tierMat[d.tier] as THREE.MeshStandardMaterial).color.getHex());
    world.remove(d.mesh);
  }
}

function updateStationAffordability() {
  for (const k of kiosks) if (!k.purchased) k.padMesh.material.emissiveIntensity = run.currency >= k.cost ? .6 : 0;
  for (const g of tollGates) if (!g.purchased) g.padMesh.material.emissiveIntensity = run.currency >= g.cost ? .6 : 0;
}

// Same iso "up + behind + to one side" offset as before, but expressed in the path's own local
// frame (tangent/perpendicular) instead of fixed world axes. Anything placed using perpOf(tangent)
// (kiosks, gates, deposits) then stays at a consistent relative screen position as the path turns —
// with a world-fixed offset, the camera's "left/right" would drift away from the path's "left/right"
// on a turn and side-placed kiosks could end up off-screen. Still translate-only; no camera rotation.
const CAMERA_UP = 17, CAMERA_BACK = 23, CAMERA_SIDE = 10;
const LOOKAHEAD_DISTANCE = 6;
function updateCamera(dt: number) {
  const s = sampleAtDistance(pathTable, carrier.distance);
  const perp = perpOf(s.tangent);
  const offset = new THREE.Vector3(0, CAMERA_UP, 0).addScaledVector(s.tangent, -CAMERA_BACK).addScaledVector(perp, CAMERA_SIDE);
  camera.position.lerp(s.point.clone().add(offset), Math.min(1, dt * 2.2));
  camera.lookAt(s.point.clone().addScaledVector(s.tangent, LOOKAHEAD_DISTANCE));
}

function update(dt: number) {
  if (run.phase === 'finished') { updateParticles(dt); return; }

  updateCarrier(dt);
  if (run.phase === 'traveling') updateMining();
  updateStationAffordability();
  updateParticles(dt);

  openingOre.mesh.rotation.y += dt * .6;
  for (const k of kiosks) k.group.position.y = Math.sin(performance.now() * .002 + k.t) * .05;
  for (const g of tollGates) if (g.barMesh.userData.retract) g.barMesh.position.y += (-3 - g.barMesh.position.y) * Math.min(1, dt * 3);

  let objective = '';
  if (run.phase === 'opening') objective = '敲碎晶石，开始旅程';
  else {
    const gate = tollGates.find(g => !g.purchased);
    if (gate) { const need = gate.cost - run.currency; objective = need > 0 ? `还需 ${need} 金币解锁下一区域` : '资金充足，点击关卡通行！'; }
    else objective = '冲向终点，收集宝箱！';
  }
  if (objective !== lastObjective) { objectiveEl.textContent = objective; lastObjective = objective; }

  if (run.phase === 'traveling' && carrier.distance >= pathTable.totalLength - 3) {
    run.phase = 'finished';
    finalScoreEl.textContent = String(run.currency);
    objectiveEl.style.opacity = '0';
    setTimeout(() => resultEl.hidden = false, 450);
  }

  updateCamera(dt);
}

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight, aspect = w / h;
  const vertical = 12.5; camera.left = -vertical * aspect; camera.right = vertical * aspect; camera.top = vertical; camera.bottom = -vertical; camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', resize); resize(); reset();

function loop(now: number) { const dt = Math.min((now - last) / 1000, .033); last = now; update(dt); renderer.render(scene, camera); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
