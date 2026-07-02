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

const CAMERA_OFFSET = new THREE.Vector3(10, 17, 23);
const camera = new THREE.OrthographicCamera(-7, 7, 12.5, -12.5, 0.1, 100);
camera.position.copy(CAMERA_OFFSET);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld(true); // force it now: matrixWorld would otherwise still be stale (identity) until the first render

// The camera keeps this exact fixed offset/angle forever (translate-only, never rotated), so its
// right/forward directions in world space are constant — compute them once and reuse for mapping
// joystick drag input to world movement, instead of a fixed z-axis "forward" like a corridor game.
const worldRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0); worldRight.y = 0; worldRight.normalize();
const worldForward = new THREE.Vector3(); camera.getWorldDirection(worldForward); worldForward.y = 0; worldForward.normalize();

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

// ---- Open 2D map (placeholder layout, to be replaced against a hand-drawn map): a big arena the
// carrier freely roams, split into three concentric zones by rock rings, each ring having a single
// gap guarded by a toll gate. Bigger and genuinely 2D, not a single traversed path. ----
const MAP_SOFT_RADIUS = 62;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), mat(0x8e5237));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; world.add(ground);

const rockGeo = new THREE.DodecahedronGeometry(1, 0);
function buildRing(radius: number, gapAngle: number | null, gapWidth: number) {
  const gapHalf = gapAngle === null ? 0 : Math.atan2(gapWidth / 2, radius);
  const count = Math.round(radius * 0.95);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    if (gapAngle !== null) {
      const da = Math.atan2(Math.sin(angle - gapAngle), Math.cos(angle - gapAngle));
      if (Math.abs(da) < gapHalf) continue;
    }
    const r = radius + (Math.random() - .5) * 3;
    const rock = new THREE.Mesh(rockGeo, rockMats[i % rockMats.length]);
    rock.scale.set(1.4 + Math.random() * 1.2, 1.3 + Math.random() * 1.6, 1.2 + Math.random());
    rock.position.set(Math.cos(angle) * r, .6 + Math.random() * .5, Math.sin(angle) * r);
    rock.rotation.set(Math.random(), Math.random(), Math.random()); rock.castShadow = true; world.add(rock);
  }
}
const GATE1_ANGLE = Math.PI / 2, GATE1_RADIUS = 20;
const GATE2_ANGLE = 0, GATE2_RADIUS = 40;
buildRing(GATE1_RADIUS, GATE1_ANGLE, 16);
buildRing(GATE2_RADIUS, GATE2_ANGLE, 16);
buildRing(MAP_SOFT_RADIUS, null, 0);

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

// ---- Ore deposits: fixed points on the map, auto-mined when the carrier gets close enough. ----
const MINE_RADIUS = 2;
type OreTier = 0 | 1 | 2 | 3;
type OreDeposit = { x: number; z: number; tier: OreTier; mesh: THREE.Mesh; collected: boolean };
function buildDeposit(x: number, z: number, tier: OreTier): OreDeposit {
  const mesh = new THREE.Mesh(tierGeo[tier], tierMat[tier]);
  mesh.position.set(x, .34, z);
  mesh.rotation.set(Math.random(), Math.random(), Math.random()); mesh.castShadow = true; world.add(mesh);
  return { x, z, tier, mesh, collected: false };
}
const oreDepositDefs: { x: number; z: number; tier: OreTier }[] = [
  // Zone 1 (inner ring, radius < 20): tier 0, with a couple of tier-1 baits near the gate.
  { x: 4, z: 3, tier: 0 }, { x: -6, z: 5, tier: 0 }, { x: -9, z: -4, tier: 0 }, { x: 3, z: -9, tier: 0 },
  { x: 10, z: -6, tier: 0 }, { x: -4, z: 12, tier: 0 }, { x: 8, z: 10, tier: 0 },
  { x: -3, z: 17, tier: 1 }, { x: 4, z: 18, tier: 1 },
  // Zone 2 (between the two rings, radius 20-40): tier 1/2.
  { x: 12, z: 24, tier: 1 }, { x: -14, z: 22, tier: 1 }, { x: 22, z: 18, tier: 2 },
  { x: 20, z: -14, tier: 2 }, { x: 28, z: 8, tier: 2 },
  // Zone 3 (beyond the outer ring, radius > 40): tier 2/3, near the chest.
  { x: 46, z: 10, tier: 2 }, { x: 44, z: -18, tier: 3 }, { x: 34, z: -30, tier: 2 }, { x: 30, z: -42, tier: 3 },
];
const oreDeposits: OreDeposit[] = oreDepositDefs.map(d => buildDeposit(d.x, d.z, d.tier));

// ---- Upgrade kiosks: soft/missable, tap to spend currency and raise tool level. ----
type Kiosk = {
  cost: number; toToolLevel: number; purchased: boolean;
  group: THREE.Group; padMesh: ReturnType<typeof box>; toolIconMesh: THREE.Mesh; costSign: ReturnType<typeof makeDynamicSprite>;
};
function buildKiosk(x: number, z: number, cost: number, toToolLevel: number): Kiosk {
  const group = new THREE.Group(); group.position.set(x, 0, z); world.add(group);
  const padMesh = box([1.3, .14, 1.3], 0x2e8f7a, [0, .07, 0], group);
  padMesh.userData.kind = 'kiosk';
  const toolIconMesh = new THREE.Mesh(new THREE.ConeGeometry(.32, .6, 6), mat(0xffcf36, .35, .6));
  toolIconMesh.position.set(0, .5, 0); toolIconMesh.castShadow = true; group.add(toolIconMesh);
  const costSign = makeDynamicSprite(String(cost), '#0d3a2e', '#7cf7c9');
  costSign.sprite.position.set(0, 1.55, 0); costSign.sprite.scale.set(2.2, .9, 1); group.add(costSign.sprite);
  return { cost, toToolLevel, purchased: false, group, padMesh, toolIconMesh, costSign };
}
const kiosks: Kiosk[] = [
  buildKiosk(6, 8, 50, 1),
  buildKiosk(26, -10, 90, 2),
];

// ---- Toll gates: block the *entire* ring radius (not just a small circle at the visual gap —
// the rock rings are decorative only, with no collision of their own, so a localized blocker would
// let the player just walk around it through the gap) until paid; grant a lump-sum bonus after. ----
type TollGate = {
  x: number; z: number; ringRadius: number; cost: number; rewardLumpSum: number; purchased: boolean;
  group: THREE.Group; barMesh: ReturnType<typeof box>; padMesh: ReturnType<typeof box>; costSign: ReturnType<typeof makeDynamicSprite>;
};
function buildGate(ringRadius: number, angle: number, cost: number, rewardLumpSum: number): TollGate {
  const x = Math.cos(angle) * ringRadius, z = Math.sin(angle) * ringRadius;
  const yaw = angle + Math.PI / 2; // face across the gap, not along the radius
  const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = -yaw; world.add(group);
  const barMesh = box([7, 2.6, .4], 0xcc3b2e, [0, 1.3, 0], group);
  barMesh.userData.kind = 'gate';
  const padMesh = box([1.1, .14, 1.1], 0x8c39dd, [0, .07, 1.6], group);
  padMesh.userData.kind = 'gate';
  const costSign = makeDynamicSprite(String(cost), '#3a2409', '#ffe27a');
  costSign.sprite.position.set(0, 3.2, 0); costSign.sprite.scale.set(2.6, 1.05, 1); group.add(costSign.sprite);
  return { x, z, ringRadius, cost, rewardLumpSum, purchased: false, group, barMesh, padMesh, costSign };
}
const tollGates: TollGate[] = [
  buildGate(GATE1_RADIUS, GATE1_ANGLE, 80, 60),
  buildGate(GATE2_RADIUS, GATE2_ANGLE, 100, 90),
];

// ---- Opening beat: mash-tap a glowing ore capsule to crack it before the carrier can move. ----
type OpeningOre = { mesh: THREE.Mesh; hitsRequired: number; hitsSoFar: number; cracked: boolean };
const OPENING_HITS_REQUIRED = 5;
const OPENING_REWARD_CURRENCY = 40;
const openingOreMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), new THREE.MeshStandardMaterial({ color: 0x5fd0ff, emissive: 0x1a8fd6, emissiveIntensity: .55, roughness: .2, metalness: .35 }));
openingOreMesh.position.set(0, 1.1, 4); openingOreMesh.castShadow = true;
openingOreMesh.userData.kind = 'openingOre'; world.add(openingOreMesh);
const openingOre: OpeningOre = { mesh: openingOreMesh, hitsRequired: OPENING_HITS_REQUIRED, hitsSoFar: 0, cracked: false };

// ---- Chest / ending, out past the second ring. ----
const CHEST_POS = new THREE.Vector3(26, 0, -45);
const CHEST_RADIUS = 3;
const chestGroup = new THREE.Group(); chestGroup.position.copy(CHEST_POS); world.add(chestGroup);
box([1.7, 1, 1.2], 0x8a5a2e, [0, .5, 0], chestGroup);
box([1.8, .4, 1.3], 0xffd23c, [0, 1.15, 0], chestGroup);

// ---- Carrier: the small vehicle the player drives with a joystick-style drag. ----
const carrierGroup = new THREE.Group(); world.add(carrierGroup);
box([1.5, .55, 2], 0x2e8f7a, [0, .5, 0], carrierGroup);
box([1.1, .5, 1], 0x7cf7c9, [0, .95, -.2], carrierGroup);
box([.16, .5, .16], 0x1c1c1c, [-.6, .3, .8], carrierGroup);
box([.16, .5, .16], 0x1c1c1c, [.6, .3, .8], carrierGroup);
box([.16, .5, .16], 0x1c1c1c, [-.6, .3, -.8], carrierGroup);
box([.16, .5, .16], 0x1c1c1c, [.6, .3, -.8], carrierGroup);
const carrierPos = new THREE.Vector3(0, 0, 0);

// ---- Raycaster-based tap handling for kiosks, gates, and the opening ore. ----
const raycaster = new THREE.Raycaster();
const interactables: THREE.Object3D[] = [openingOreMesh, ...kiosks.map(k => k.padMesh), ...tollGates.flatMap(g => [g.barMesh, g.padMesh])];
kiosks.forEach((k, i) => { k.padMesh.userData.index = i; });
tollGates.forEach((g, i) => { g.barMesh.userData.index = i; g.padMesh.userData.index = i; });

function raycastAt(clientX: number, clientY: number) {
  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObjects(interactables, false)[0]?.object ?? null;
}

// ---- Joystick-style drag: touch empty ground to move, release to stop dead. Tapping a button
// (kiosk/gate/opening ore) is handled as a tap instead and never engages the joystick. ----
let joystickActive = false, joystickDX = 0, joystickDY = 0, joystickOriginX = 0, joystickOriginY = 0;
const JOYSTICK_RADIUS = 60;

renderer.domElement.addEventListener('pointerdown', (e) => {
  const hit = raycastAt(e.clientX, e.clientY);
  if (hit) {
    const kind = hit.userData.kind as 'kiosk' | 'gate' | 'openingOre';
    if (kind === 'openingOre') handleOpeningOreTap();
    else if (kind === 'kiosk') tryPurchaseKiosk(hit.userData.index as number);
    else tryPurchaseGate(hit.userData.index as number);
    return;
  }
  joystickActive = true; joystickOriginX = e.clientX; joystickOriginY = e.clientY; joystickDX = 0; joystickDY = 0;
  hintEl.style.opacity = '0';
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!joystickActive) return;
  const dx = THREE.MathUtils.clamp(e.clientX - joystickOriginX, -JOYSTICK_RADIUS, JOYSTICK_RADIUS);
  const dy = THREE.MathUtils.clamp(e.clientY - joystickOriginY, -JOYSTICK_RADIUS, JOYSTICK_RADIUS);
  joystickDX = dx / JOYSTICK_RADIUS; joystickDY = dy / JOYSTICK_RADIUS;
});
function stopJoystick() { joystickActive = false; joystickDX = 0; joystickDY = 0; }
renderer.domElement.addEventListener('pointerup', stopJoystick);
renderer.domElement.addEventListener('pointercancel', stopJoystick);

// ---- Run state. ----
type RunState = { currency: number; toolLevel: number; phase: 'opening' | 'traveling' | 'finished' };
const CARRIER_SPEED = 6.5;
const run: RunState = { currency: 0, toolLevel: 0, phase: 'opening' };
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
  g.barMesh.userData.retract = true; // eased down out of the way in update()
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
  carrierPos.set(0, 0, 0); carrierGroup.position.copy(carrierPos); carrierGroup.rotation.y = 0;
  stopJoystick();
  camera.position.copy(carrierPos).add(CAMERA_OFFSET);
  refreshDepositLockVisuals();
  lastObjective = '';
  scoreEl.textContent = '0'; resultEl.hidden = true; hintEl.style.opacity = '1';
  objectiveEl.textContent = '敲碎晶石，开始旅程'; objectiveEl.style.opacity = '1';
}
restartBtn.addEventListener('click', reset);

function updateCarrier(dt: number) {
  if (run.phase !== 'traveling') return;
  const strength = Math.min(1, Math.hypot(joystickDX, joystickDY));
  if (strength < .02) return;
  const moveDir = worldRight.clone().multiplyScalar(joystickDX).add(worldForward.clone().multiplyScalar(-joystickDY));
  if (moveDir.lengthSq() < 1e-6) return;
  moveDir.normalize();
  let nextX = carrierPos.x + moveDir.x * CARRIER_SPEED * strength * dt;
  let nextZ = carrierPos.z + moveDir.z * CARRIER_SPEED * strength * dt;

  // Unpaid gates block the whole ring's circumference, not just the visual gap — otherwise the
  // player could just walk around the small blocker through the rock-free gap next to it.
  for (const g of tollGates) {
    if (g.purchased) continue;
    const distFromOrigin = Math.hypot(nextX, nextZ);
    if (distFromOrigin >= g.ringRadius) { const s = (g.ringRadius - .05) / distFromOrigin; nextX *= s; nextZ *= s; }
  }
  const distFromCenter = Math.hypot(nextX, nextZ);
  if (distFromCenter > MAP_SOFT_RADIUS) { const s = MAP_SOFT_RADIUS / distFromCenter; nextX *= s; nextZ *= s; }

  carrierPos.set(nextX, 0, nextZ);
  carrierGroup.position.copy(carrierPos);
  carrierGroup.rotation.y = Math.atan2(moveDir.x, moveDir.z);
}

function updateMining() {
  for (const d of oreDeposits) {
    if (d.collected || carrierPos.distanceTo(d.mesh.position) > MINE_RADIUS) continue;
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

function updateCamera(dt: number) {
  camera.position.lerp(carrierPos.clone().add(CAMERA_OFFSET), Math.min(1, dt * 4));
  camera.lookAt(carrierPos);
}

function update(dt: number) {
  if (run.phase === 'finished') { updateParticles(dt); return; }

  updateCarrier(dt);
  if (run.phase === 'traveling') updateMining();
  updateStationAffordability();
  updateParticles(dt);

  openingOre.mesh.rotation.y += dt * .6;
  for (const k of kiosks) k.group.position.y = Math.sin(performance.now() * .002 + k.cost) * .05;
  for (const g of tollGates) if (g.barMesh.userData.retract) g.barMesh.position.y += (-3 - g.barMesh.position.y) * Math.min(1, dt * 3);

  let objective = '';
  if (run.phase === 'opening') objective = '敲碎晶石，开始旅程';
  else {
    const gate = tollGates.find(g => !g.purchased);
    if (gate) { const need = gate.cost - run.currency; objective = need > 0 ? `还需 ${need} 金币解锁下一区域` : '资金充足，点击关卡通行！'; }
    else objective = '前往宝箱，收集本轮成果！';
  }
  if (objective !== lastObjective) { objectiveEl.textContent = objective; lastObjective = objective; }

  if (run.phase === 'traveling' && carrierPos.distanceTo(CHEST_POS) < CHEST_RADIUS) {
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
