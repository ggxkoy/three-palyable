import * as THREE from 'three';
import './style.css';

type Tier = 0 | 1 | 2;
type Gem = { mesh: THREE.Mesh; velocity: THREE.Vector3; tier: Tier; value: number; collected: boolean; gateIndex: number; sinking: boolean };

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
scene.fog = new THREE.Fog(0x8f4f33, 22, 50);

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
const groundMat = mat(0x8e5237);
const rockMats = [mat(0xa95f3f), mat(0x81412f), mat(0xc07148)];

const ground = new THREE.Mesh(new THREE.PlaneGeometry(18, 86), groundMat);
ground.rotation.x = -Math.PI / 2; ground.position.z = -4; ground.receiveShadow = true; world.add(ground);

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

// A sprite whose canvas can be redrawn in place (for live-updating quota / level numbers).
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

// Low-poly canyon walls, spanning the whole crusher -> collection track.
const rockGeo = new THREE.DodecahedronGeometry(1, 0);
for (const side of [-1, 1]) {
  for (let z = -41; z <= 35; z += 2.1) {
    const rock = new THREE.Mesh(rockGeo, rockMats[Math.abs(Math.floor(z)) % rockMats.length]);
    rock.scale.set(1.4 + Math.random() * 1.2, 1.3 + Math.random() * 1.4, 1.2 + Math.random());
    rock.position.set(side * (7.5 + Math.random() * 1.15), .6 + Math.random() * .5, z + Math.random());
    rock.rotation.set(Math.random(), Math.random(), Math.random()); rock.castShadow = true; world.add(rock);
  }
}

// ---- Gem tiers: crushed ore starts blue, and gets upgraded a tier every time it funds a gate. ----
const TIER_VALUE = [1, 10, 50];
const tierGeo = [
  new THREE.OctahedronGeometry(.3, 0),
  new THREE.CylinderGeometry(.3, .3, .14, 14),
  new THREE.OctahedronGeometry(.34, 1),
];
const tierMat = [
  new THREE.MeshStandardMaterial({ color: 0x24d8ff, emissive: 0x087cba, emissiveIntensity: .45, roughness: .24, metalness: .45 }),
  new THREE.MeshStandardMaterial({ color: 0xffd23c, emissive: 0x8a5300, emissiveIntensity: .28, roughness: .32, metalness: .82 }),
  new THREE.MeshStandardMaterial({ color: 0xff59e6, emissive: 0x8a0d78, emissiveIntensity: .5, roughness: .22, metalness: .55 }),
];

// ---- Crusher: the ASMR "output" stage. Runs on its own timer, independent of the player. ----
const DOZER_START_Z = 20;
const CRUSHER_Z = DOZER_START_Z + 8;
const crusherGroup = new THREE.Group(); crusherGroup.position.set(0, 0, CRUSHER_Z); world.add(crusherGroup);
box([2.2, .3, 2.2], 0x5a3a86, [0, .15, 0], crusherGroup);
const drumL = new THREE.Mesh(new THREE.CylinderGeometry(.85, .85, 2.4, 16), mat(0x8c39dd, .4, .55));
drumL.rotation.z = Math.PI / 2; drumL.position.set(-.85, 1.05, 0); drumL.castShadow = true; crusherGroup.add(drumL);
const drumR = drumL.clone(); drumR.position.x = .85; crusherGroup.add(drumR);
const hopper = box([1.7, 1.3, 1.7], 0xb34fff, [0, 2.15, 0], crusherGroup);
const crusherSign = makeDynamicSprite('LV.1', '#3a2409', '#ffe27a');
crusherSign.sprite.position.set(0, 3.55, 0); crusherSign.sprite.scale.set(2.1, .85, 1); crusherGroup.add(crusherSign.sprite);

// ---- Dozer upgrade kiosk, sitting right before the first gate. ----
const KIOSK_Z = 9;
const kioskGroup = new THREE.Group(); kioskGroup.position.set(4.4, 0, KIOSK_Z); world.add(kioskGroup);
const kioskPad = box([1.3, .12, 1.3], 0x2e8f7a, [0, .06, 0], kioskGroup);
const kioskSign = makeDynamicSprite('UPGRADE', '#0d3a2e', '#7cf7c9');
kioskSign.sprite.position.set(0, 1.7, 0); kioskSign.sprite.scale.set(2.3, .93, 1); kioskGroup.add(kioskSign.sprite);

// ---- Multiplier gates: each demands a quota of gem-value be fed in before it unlocks. ----
type Gate = {
  z: number; quota: number; remaining: number; unlocked: boolean; toTier: Tier; label: string;
  pillarL: ReturnType<typeof box>; pillarR: ReturnType<typeof box>; bar: ReturnType<typeof box>;
  sign: ReturnType<typeof makeDynamicSprite>;
};
const BAR_WIDTH = 2.6;
function buildGate(z: number, quota: number, toTier: Tier, label: string): Gate {
  const pillarL = box([.34, 2.8, .34], 0x8c39dd, [-3.9, 1.4, z]);
  const pillarR = box([.34, 2.8, .34], 0x8c39dd, [3.9, 1.4, z]);
  box([8.1, .32, .34], 0xb34fff, [0, 2.7, z]);
  const labelSprite = makeTextSprite(label, '#fff1a8', '#5e2395');
  labelSprite.position.set(0, 3.45, z); labelSprite.scale.set(3.2, 1.5, 1); world.add(labelSprite);
  const bar = box([BAR_WIDTH, .18, .12], 0xffd23c, [0, 4.35, z]);
  const sign = makeDynamicSprite(String(quota), '#3a2409', '#ffe27a');
  sign.sprite.position.set(0, 5.05, z); sign.sprite.scale.set(2.6, 1.05, 1); world.add(sign.sprite);
  return { z, quota, remaining: quota, unlocked: false, toTier, label, pillarL, pillarR, bar, sign };
}
const gates: Gate[] = [
  buildGate(4, 150, 1, '×10'),
  buildGate(-14, 1800, 2, '×50'),
];

function updateGateVisual(gate: Gate) {
  gate.sign.draw(String(gate.remaining));
  const frac = Math.max(0, gate.remaining / gate.quota);
  gate.bar.scale.x = Math.max(.001, frac);
  gate.bar.position.x = -BAR_WIDTH / 2 * (1 - frac);
}
function unlockGate(gate: Gate) {
  gate.unlocked = true;
  gate.sign.draw('OPEN');
  gate.bar.scale.x = .001;
  gate.pillarL.material.color.set(0x35e07a); gate.pillarL.material.emissive.set(0x0c6b34);
  gate.pillarR.material.color.set(0x35e07a); gate.pillarR.material.emissive.set(0x0c6b34);
  flashPop(`${gate.label}!`);
}

// ---- Lava crossings: the bridge is narrower than the canyon, so a wandering pile spills over. ----
type LavaZone = { z: number; spanHalf: number; plank: number; mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> };
function buildLava(z: number, plank: number): LavaZone {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(18, 5.2), new THREE.MeshStandardMaterial({ color: 0xff3b0b, emissive: 0xff2400, emissiveIntensity: 1.35, roughness: .5 }));
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(0, .035, z); world.add(mesh);
  for (let x = -plank; x <= plank + .001; x += .75) box([.62, .16, 5.5], 0xc58847, [x, .17, z]);
  return { z, spanHalf: 2.6, plank, mesh };
}
const lavaZones = [buildLava(-4, 2), buildLava(-24, 1.8)];
function lavaZoneAt(z: number) { return lavaZones.find(l => Math.abs(z - l.z) < l.spanHalf) ?? null; }

// ---- Collection platform. ----
const COLLECT_Z = -34;
const collection = new THREE.Mesh(new THREE.CircleGeometry(5.2, 48), new THREE.MeshStandardMaterial({ color: 0xf4b826, roughness: .5, metalness: .28 }));
collection.rotation.x = -Math.PI / 2; collection.position.set(0, .05, COLLECT_Z); world.add(collection);
const rim = new THREE.Mesh(new THREE.TorusGeometry(5.25, .17, 10, 48), tierMat[1]); rim.rotation.x = Math.PI / 2; rim.position.set(0, .15, COLLECT_Z); world.add(rim);
const finishSign = makeTextSprite('COLLECT', '#2e170b', '#ffd548'); finishSign.position.set(0, .55, COLLECT_Z - 4.7); finishSign.scale.set(4.5, 1.35, 1); world.add(finishSign);

// ---- Dozer. ----
const dozer = new THREE.Group(); world.add(dozer);
box([2.2, .85, 2.7], 0xf0a30e, [0, .86, 0], dozer);
box([1.55, .85, 1.25], 0xffc52a, [0, 1.52, .15], dozer);
const glass = box([1.25, .52, .08], 0x83d7d6, [0, 1.63, -.51], dozer); glass.material = mat(0x83d7d6, .22, .1);
for (const x of [-1.17, 1.17]) { box([.35, .58, 2.7], 0x332b27, [x, .62, 0], dozer); }
const blade = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.05, .28), tierMat[1]); blade.position.set(0, .62, -1.8); blade.rotation.x = -.1; blade.castShadow = true; dozer.add(blade);
for (const x of [-1.7, -1.15, -.58, 0, .58, 1.15, 1.7]) box([.13, .34, .6], 0xffcf36, [x, .25, -2.04], dozer);
dozer.position.set(0, 0, DOZER_START_Z);

let gems: Gem[] = [];
function spawnGemBatch(count: number, centerZ: number) {
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(tierGeo[0], tierMat[0]);
    const angle = Math.random() * Math.PI * 2; const radius = Math.sqrt(Math.random()) * 3.6;
    mesh.position.set(Math.cos(angle) * radius, .3, centerZ + Math.sin(angle) * radius * 1.15);
    mesh.rotation.set(Math.random(), Math.random(), Math.random()); mesh.castShadow = true; world.add(mesh);
    gems.push({ mesh, velocity: new THREE.Vector3(), tier: 0, value: TIER_VALUE[0], collected: false, gateIndex: 0, sinking: false });
  }
}
function upgradeGem(gem: Gem, tier: Tier) {
  world.remove(gem.mesh);
  const mesh = new THREE.Mesh(tierGeo[tier], tierMat[tier]);
  mesh.position.copy(gem.mesh.position); mesh.rotation.copy(gem.mesh.rotation); mesh.castShadow = true;
  world.add(mesh);
  gem.mesh = mesh; gem.tier = tier; gem.value = TIER_VALUE[tier];
}

// A slow, deliberate crawl reads as ASMR; a fast runner-style pace does not.
const BASE_DOZER_SPEED = 2.6, BASE_BLADE_HALF = 3.2;
// Every burst spawns just ahead of wherever the dozer currently is, so the pile is always
// reachable no matter how far the player has already driven past the original crusher spot.
const BURST_LEAD = 5;
const CRUSHER_BURST_TIMES = [0, 4, 8, 12, 16];
const CRUSHER_BURST_COUNTS = [260, 60, 60, 60, 60];

let pointerDown = false, pointerX = 0, targetX = 0, started = false, finished = false, score = 0, last = performance.now();
let runTime = 0, crusherBurstsFired = 0, crusherPulse = 0;
let dozerSpeed = BASE_DOZER_SPEED, bladeHalfWidth = BASE_BLADE_HALF, kioskTriggered = false;
let bladeScale = 1, bladeScaleTarget = 1, lastObjective = '';

renderer.domElement.addEventListener('pointerdown', (e) => { pointerDown = true; pointerX = e.clientX; started = true; hintEl.style.opacity = '0'; renderer.domElement.setPointerCapture(e.pointerId); });
renderer.domElement.addEventListener('pointermove', (e) => { if (!pointerDown) return; const dx = e.clientX - pointerX; pointerX = e.clientX; targetX = THREE.MathUtils.clamp(targetX + dx * .018, -5.4, 5.4); });
renderer.domElement.addEventListener('pointerup', () => pointerDown = false);
window.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft' || e.key === 'a') { started = true; targetX -= 1; } if (e.key === 'ArrowRight' || e.key === 'd') { started = true; targetX += 1; } targetX = THREE.MathUtils.clamp(targetX, -5.4, 5.4); });

function flashPop(text: string) { popEl.textContent = text; popEl.classList.remove('pop'); void popEl.offsetWidth; popEl.classList.add('pop'); }

function reset() {
  for (const gem of gems) world.remove(gem.mesh);
  gems = [];
  dozer.position.set(0, 0, DOZER_START_Z); targetX = 0; started = false; finished = false; score = 0;
  runTime = 0; crusherBurstsFired = 0; crusherPulse = 0; crusherSign.draw('LV.1');
  dozerSpeed = BASE_DOZER_SPEED; bladeHalfWidth = BASE_BLADE_HALF; kioskTriggered = false;
  kioskSign.draw('UPGRADE'); kioskPad.material.color.set(0x2e8f7a);
  bladeScale = 1; bladeScaleTarget = 1; blade.scale.set(1, 1, 1);
  for (const gate of gates) {
    gate.remaining = gate.quota; gate.unlocked = false;
    gate.sign.draw(String(gate.quota)); gate.bar.scale.x = 1; gate.bar.position.x = 0;
    gate.pillarL.material.color.set(0x8c39dd); gate.pillarL.material.emissive.set(0x000000);
    gate.pillarR.material.color.set(0x8c39dd); gate.pillarR.material.emissive.set(0x000000);
  }
  lastObjective = '';
  scoreEl.textContent = '0'; resultEl.hidden = true; hintEl.style.opacity = '1';
  objectiveEl.textContent = '破碎机正在产出宝石…'; objectiveEl.style.opacity = '1';
}
restartBtn.addEventListener('click', reset);

function update(dt: number) {
  if (finished) return;
  runTime += dt;
  while (crusherBurstsFired < CRUSHER_BURST_TIMES.length && runTime >= CRUSHER_BURST_TIMES[crusherBurstsFired]) {
    // "Ahead" of the dozer means smaller z (forward is -z), so lead with a minus, not a plus.
    spawnGemBatch(CRUSHER_BURST_COUNTS[crusherBurstsFired], dozer.position.z - BURST_LEAD);
    crusherBurstsFired++;
    crusherSign.draw(`LV.${crusherBurstsFired}`);
    crusherPulse = .4;
    if (crusherBurstsFired > 1) flashPop(`破碎机 LV.${crusherBurstsFired}!`);
  }

  dozer.position.x += (targetX - dozer.position.x) * Math.min(1, dt * 8);
  if (started) dozer.position.z -= dt * dozerSpeed;

  if (!kioskTriggered && dozer.position.z < KIOSK_Z) {
    kioskTriggered = true; bladeHalfWidth = 4.0; dozerSpeed += .8; bladeScaleTarget = 1.3;
    kioskSign.draw('已升级'); kioskPad.material.color.set(0xffd23c); flashPop('铲斗升级!');
  }
  bladeScale += (bladeScaleTarget - bladeScale) * Math.min(1, dt * 5); blade.scale.set(bladeScale, bladeScale, 1);

  const bladeZ = dozer.position.z - 2.0;
  for (const gem of gems) {
    if (gem.collected) continue;
    const p = gem.mesh.position;

    if (gem.sinking) {
      gem.velocity.y -= dt * 9; p.addScaledVector(gem.velocity, dt);
      gem.mesh.rotation.x += dt * 3; gem.mesh.rotation.z += dt * 2;
      if (p.y < -1.3) { gem.collected = true; world.remove(gem.mesh); }
      continue;
    }

    const dz = p.z - bladeZ, dx = p.x - dozer.position.x;
    // Anything within reach rides forward at the same speed as the blade, so the gap to the
    // blade never grows: a gem can't be permanently "outrun" once it's part of the convoy.
    if (dz > -1.5 && dz < 12) {
      p.z -= dt * dozerSpeed;
      if (p.z < bladeZ - .4) p.z = bladeZ - .4;
      const pullRate = Math.abs(dx) < bladeHalfWidth ? 6 : 1.4;
      p.x += -dx * Math.min(1, dt * pullRate);
    }
    p.x = THREE.MathUtils.clamp(p.x, -6.1, 6.1); p.y = .3 + Math.abs(Math.sin(performance.now() * .003 + p.x)) * .04;
    gem.mesh.rotation.x += dt * 1.4; gem.mesh.rotation.y += dt * 2.2;

    const lava = lavaZoneAt(p.z);
    if (lava && Math.abs(p.x) > lava.plank) {
      gem.sinking = true; gem.velocity.set(gem.velocity.x * .2, -.5, gem.velocity.z * .2); continue;
    }

    if (gem.gateIndex < gates.length) {
      const gate = gates[gem.gateIndex];
      if (p.z < gate.z) {
        if (!gate.unlocked) {
          gate.remaining = Math.max(0, gate.remaining - gem.value);
          updateGateVisual(gate);
          if (gate.remaining <= 0) unlockGate(gate);
          gem.collected = true; world.remove(gem.mesh); continue;
        } else {
          upgradeGem(gem, gate.toTier); gem.gateIndex++;
        }
      }
    }

    if (p.z < COLLECT_Z + 5.2) {
      gem.collected = true; world.remove(gem.mesh); score += gem.value; scoreEl.textContent = String(score);
    }
  }
  gems = gems.filter(g => !g.collected);

  const activeGate = gates.find(g => !g.unlocked);
  const objective = activeGate ? `推向 ${activeGate.label} 门 · 还需投入 ${activeGate.remaining}` : '全部解锁！冲向终点收集区';
  if (objective !== lastObjective) { objectiveEl.textContent = objective; lastObjective = objective; }

  if (dozer.position.z < COLLECT_Z - 5) {
    finished = true; finalScoreEl.textContent = String(score); objectiveEl.style.opacity = '0'; setTimeout(() => resultEl.hidden = false, 450);
  }
  camera.position.z += ((dozer.position.z + 9) - camera.position.z) * Math.min(1, dt * 2.2);
  camera.lookAt(0, 0, dozer.position.z - 6);
  for (const lava of lavaZones) lava.mesh.material.emissiveIntensity = 1.15 + Math.sin(performance.now() * .004 + lava.z) * .25;

  drumL.rotation.x += dt * 6; drumR.rotation.x += dt * 6;
  crusherPulse = Math.max(0, crusherPulse - dt);
  hopper.scale.setScalar(1 + crusherPulse * .5);
}

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight, aspect = w / h;
  const vertical = 12.5; camera.left = -vertical * aspect; camera.right = vertical * aspect; camera.top = vertical; camera.bottom = -vertical; camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', resize); resize(); reset();

function loop(now: number) { const dt = Math.min((now - last) / 1000, .033); last = now; update(dt); renderer.render(scene, camera); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
