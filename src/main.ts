import * as THREE from 'three';
import './style.css';

type Gem = { mesh: THREE.Mesh; velocity: THREE.Vector3; collected: boolean };

const stage = document.querySelector<HTMLDivElement>('#stage')!;
const scoreEl = document.querySelector<HTMLElement>('#score')!;
const finalScoreEl = document.querySelector<HTMLElement>('#final-score')!;
const resultEl = document.querySelector<HTMLElement>('#result')!;
const hintEl = document.querySelector<HTMLElement>('#hint')!;
const objectiveEl = document.querySelector<HTMLElement>('#objective')!;
const multiplierEl = document.querySelector<HTMLElement>('#multiplier')!;
const restartBtn = document.querySelector<HTMLButtonElement>('#restart')!;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8f4f33);
scene.fog = new THREE.Fog(0x8f4f33, 22, 46);

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
const goldMat = mat(0xffbd16, .28, .72);
const darkMat = mat(0x2c2421, .72);
const purpleMat = mat(0x7a32d8, .52);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(18, 52), groundMat);
ground.rotation.x = -Math.PI / 2; ground.position.z = -8; ground.receiveShadow = true; world.add(ground);

function box(size: [number, number, number], color: number, pos: [number, number, number], parent = world) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat(color));
  mesh.position.set(...pos); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

// Low-poly canyon walls.
const rockGeo = new THREE.DodecahedronGeometry(1, 0);
for (const side of [-1, 1]) {
  for (let z = -31; z <= 18; z += 2.1) {
    const rock = new THREE.Mesh(rockGeo, rockMats[Math.abs(Math.floor(z)) % rockMats.length]);
    rock.scale.set(1.4 + Math.random() * 1.2, 1.3 + Math.random() * 1.4, 1.2 + Math.random());
    rock.position.set(side * (7.5 + Math.random() * 1.15), .6 + Math.random() * .5, z + Math.random());
    rock.rotation.set(Math.random(), Math.random(), Math.random()); rock.castShadow = true; world.add(rock);
  }
}

// Lava channel and bridge.
const lava = new THREE.Mesh(new THREE.PlaneGeometry(18, 5.2), new THREE.MeshStandardMaterial({ color: 0xff3b0b, emissive: 0xff2400, emissiveIntensity: 1.35, roughness: .5 }));
lava.rotation.x = -Math.PI / 2; lava.position.set(0, .035, -11); world.add(lava);
for (let x = -5.8; x <= 5.8; x += .75) box([.62, .16, 5.5], 0xc58847, [x, .17, -11]);

// Multiplier gate.
box([.34, 2.8, .34], 0x8c39dd, [-3.9, 1.4, -5]);
box([.34, 2.8, .34], 0x8c39dd, [3.9, 1.4, -5]);
box([8.1, .32, .34], 0xb34fff, [0, 2.7, -5]);
const gateSign = makeTextSprite('×2', '#fff1a8', '#5e2395'); gateSign.position.set(0, 3.45, -5); gateSign.scale.set(3.2, 1.5, 1); world.add(gateSign);

// Collection platform.
const collection = new THREE.Mesh(new THREE.CircleGeometry(5.2, 48), new THREE.MeshStandardMaterial({ color: 0xf4b826, roughness: .5, metalness: .28 }));
collection.rotation.x = -Math.PI / 2; collection.position.set(0, .05, -24.5); world.add(collection);
const rim = new THREE.Mesh(new THREE.TorusGeometry(5.25, .17, 10, 48), goldMat); rim.rotation.x = Math.PI / 2; rim.position.set(0, .15, -24.5); world.add(rim);
const finishSign = makeTextSprite('COLLECT', '#2e170b', '#ffd548'); finishSign.position.set(0, .55, -29.2); finishSign.scale.set(4.5, 1.35, 1); world.add(finishSign);

function makeTextSprite(text: string, color: string, bg: string) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 192;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(8, 8, 496, 176, 32); ctx.fill();
  ctx.fillStyle = color; ctx.font = '900 96px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 102);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
}

// Dozer.
const dozer = new THREE.Group(); world.add(dozer);
const body = box([2.2, .85, 2.7], 0xf0a30e, [0, .86, 0], dozer);
box([1.55, .85, 1.25], 0xffc52a, [0, 1.52, .15], dozer);
const glass = box([1.25, .52, .08], 0x83d7d6, [0, 1.63, -.51], dozer); glass.material = mat(0x83d7d6, .22, .1);
for (const x of [-1.17, 1.17]) { box([.35, .58, 2.7], 0x332b27, [x, .62, 0], dozer); }
const blade = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.05, .28), goldMat); blade.position.set(0, .62, -1.8); blade.rotation.x = -.1; blade.castShadow = true; dozer.add(blade);
for (const x of [-1.7, -1.15, -.58, 0, .58, 1.15, 1.7]) box([.13, .34, .6], 0xffcf36, [x, .25, -2.04], dozer);
dozer.position.set(0, 0, 14);

let gems: Gem[] = [];
const gemGeo = new THREE.OctahedronGeometry(.3, 0);
const gemMat = new THREE.MeshStandardMaterial({ color: 0x24d8ff, emissive: 0x087cba, emissiveIntensity: .45, roughness: .24, metalness: .45 });
function spawnGems() {
  for (const gem of gems) world.remove(gem.mesh);
  gems = [];
  for (let i = 0; i < 145; i++) {
    const mesh = new THREE.Mesh(gemGeo, gemMat);
    const angle = Math.random() * Math.PI * 2; const radius = Math.sqrt(Math.random()) * 5.2;
    mesh.position.set(Math.cos(angle) * radius, .32, 7 + Math.sin(angle) * radius * 1.4);
    mesh.rotation.set(Math.random(), Math.random(), Math.random()); mesh.castShadow = true; world.add(mesh);
    gems.push({ mesh, velocity: new THREE.Vector3(), collected: false });
  }
}

let pointerDown = false, pointerX = 0, targetX = 0, started = false, finished = false, multiplier = 1, score = 0, last = performance.now();
renderer.domElement.addEventListener('pointerdown', (e) => { pointerDown = true; pointerX = e.clientX; started = true; hintEl.style.opacity = '0'; renderer.domElement.setPointerCapture(e.pointerId); });
renderer.domElement.addEventListener('pointermove', (e) => { if (!pointerDown) return; const dx = e.clientX - pointerX; pointerX = e.clientX; targetX = THREE.MathUtils.clamp(targetX + dx * .018, -5.4, 5.4); });
renderer.domElement.addEventListener('pointerup', () => pointerDown = false);
window.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft' || e.key === 'a') { started = true; targetX -= 1; } if (e.key === 'ArrowRight' || e.key === 'd') { started = true; targetX += 1; } targetX = THREE.MathUtils.clamp(targetX, -5.4, 5.4); });

function flashMultiplier(value: number) { multiplierEl.textContent = `×${value}`; multiplierEl.classList.remove('pop'); void multiplierEl.offsetWidth; multiplierEl.classList.add('pop'); }

function reset() {
  spawnGems(); dozer.position.set(0, 0, 14); targetX = 0; started = false; finished = false; multiplier = 1; score = 0;
  scoreEl.textContent = '0'; resultEl.hidden = true; hintEl.style.opacity = '1'; objectiveEl.textContent = '将蓝色宝石推入金色收集区'; objectiveEl.style.opacity = '1';
}
restartBtn.addEventListener('click', reset);

function update(dt: number) {
  if (finished) return;
  dozer.position.x += (targetX - dozer.position.x) * Math.min(1, dt * 8);
  if (started) dozer.position.z -= dt * 4.25;
  const bladeZ = dozer.position.z - 2.0;
  for (const gem of gems) {
    if (gem.collected) continue;
    const p = gem.mesh.position;
    const dz = p.z - bladeZ, dx = p.x - dozer.position.x;
    if (Math.abs(dx) < 2.15 && dz > -1.2 && dz < .9) {
      p.z = Math.min(p.z, bladeZ - .42);
      gem.velocity.z = Math.min(gem.velocity.z, -4.25);
      gem.velocity.x += dx * dt * 1.25;
    }
    p.addScaledVector(gem.velocity, dt); gem.velocity.multiplyScalar(Math.pow(.12, dt));
    p.x = THREE.MathUtils.clamp(p.x, -6.1, 6.1); p.y = .32 + Math.abs(Math.sin(performance.now() * .003 + p.x)) * .04;
    gem.mesh.rotation.x += dt * 1.4; gem.mesh.rotation.y += dt * 2.2;
    if (p.z < -19.3) { gem.collected = true; world.remove(gem.mesh); score += multiplier; scoreEl.textContent = String(score); }
  }
  if (dozer.position.z < -4.5 && multiplier === 1) { multiplier = 2; flashMultiplier(2); objectiveEl.textContent = '倍率提升！继续推向收集区'; }
  if (dozer.position.z < -25.5) {
    finished = true; finalScoreEl.textContent = String(score); objectiveEl.style.opacity = '0'; setTimeout(() => resultEl.hidden = false, 450);
  }
  camera.position.z += ((dozer.position.z + 9) - camera.position.z) * Math.min(1, dt * 2.2);
  camera.lookAt(0, 0, dozer.position.z - 6);
  lava.material instanceof THREE.MeshStandardMaterial && (lava.material.emissiveIntensity = 1.15 + Math.sin(performance.now() * .004) * .25);
}

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight, aspect = w / h;
  const vertical = 12.5; camera.left = -vertical * aspect; camera.right = vertical * aspect; camera.top = vertical; camera.bottom = -vertical; camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', resize); resize(); reset();

function loop(now: number) { const dt = Math.min((now - last) / 1000, .033); last = now; update(dt); renderer.render(scene, camera); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
