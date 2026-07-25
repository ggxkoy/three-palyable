// 端到端玩法验证（3D / XZ 平面）：拾取 → 翻倍 → 掉货 → 投递 → 通关 → 重开
//
// 用假的 cc 运行时在 Node 里跑玩法逻辑，不需要打开 Cocos Creator。
//   cd cocos-project-3d/tools/sim && npm i && npm test
'use strict';
const Module = require('module');
const path = require('path');

// 把编译产物里的 require('cc') 指到本地的假运行时
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === 'cc') request = path.join(__dirname, 'fake-cc', 'index.js');
  return origResolve.call(this, request, ...args);
};

const cc = require('cc');
const { __sim, Node } = cc;

const { EventBus } = require('./out/core/EventBus');
const { GameEvents } = require('./out/core/GameEvents');
const { GameFlow } = require('./out/core/GameFlow');
const { TriggerZone, TriggerActor, ZoneShape } = require('./out/core/TriggerZone');
const { Hero } = require('./out/gameplay/Hero');
const { ResourceField } = require('./out/gameplay/ResourceField');
const { ResourceNode } = require('./out/gameplay/ResourceNode');
const { DeliveryZone } = require('./out/gameplay/DeliveryZone');
const { MultiplierGate } = require('./out/gameplay/MultiplierGate');
const { Hazard } = require('./out/gameplay/Hazard');

let failures = 0;
function check(label, cond, extra = '') {
  if (!cond) failures++;
  console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label}${extra ? '  → ' + extra : ''}`);
}

// ---------- 与 Bootstrap 同布局的迷你场景（3D，单位=世界单位） ----------
const L = {
  playHalfX: 4.0,
  heroStartZ: 9,
  fieldZ: 0.5, fieldHalfX: 3.5, fieldHalfZ: 5.8, pickupRadius: 1.8,
  hazardZ: -8.5, hazardHalfZ: 1.2, hazardGapHalfX: 1.9, hazardBandHalfX: 1.6,
  gateZ: -13, gateHalfX: 2.1, gateHalfZ: 0.75,
  deliveryZ: -19, deliveryRadius: 2.6,
  heroMinZ: -21, heroMaxZ: 10,
};

const world = new Node('World');
__sim.scene.addChild(world);

const fieldNode = new Node('Field');
fieldNode.setPosition(0, 0, L.fieldZ);
world.addChild(fieldNode);
const field = fieldNode.addComponent(ResourceField);
field.halfX = L.fieldHalfX;
field.halfZ = L.fieldHalfZ;
field.pickupRadius = L.pickupRadius;
field.nodeCount = 30;

for (const side of [-1, 1]) {
  const n = new Node('Hazard');
  n.setPosition(side * (L.hazardGapHalfX + L.hazardBandHalfX), 0, L.hazardZ);
  world.addChild(n);
  const z = n.addComponent(TriggerZone);
  z.shape = ZoneShape.BOX; z.halfX = L.hazardBandHalfX; z.halfZ = L.hazardHalfZ;
  n.addComponent(Hazard).lossRatio = 1;
}

const gateNode = new Node('Gate');
gateNode.setPosition(0, 0, L.gateZ);
world.addChild(gateNode);
const gz = gateNode.addComponent(TriggerZone);
gz.shape = ZoneShape.BOX; gz.halfX = L.gateHalfX; gz.halfZ = L.gateHalfZ;
gateNode.addComponent(MultiplierGate).multiplier = 2;

const delNode = new Node('Delivery');
delNode.setPosition(0, 0, L.deliveryZ);
world.addChild(delNode);
const dz = delNode.addComponent(TriggerZone);
dz.shape = ZoneShape.CIRCLE; dz.radius = L.deliveryRadius * 0.9;
delNode.addComponent(DeliveryZone).deliverRate = 170;

const heroNode = new Node('Hero');
heroNode.setPosition(0, 0, L.heroStartZ);
world.addChild(heroNode);
const hero = heroNode.addComponent(Hero);
hero.boundX = L.playHalfX;
hero.minZ = L.heroMinZ;
hero.maxZ = L.heroMaxZ;
heroNode.addComponent(TriggerActor);

const sysNode = new Node('Systems');
__sim.scene.addChild(sysNode);
const flow = sysNode.addComponent(GameFlow);

// ---------- 驱动 ----------
const DT = 1 / 60;
function tick(n = 1) { for (let i = 0; i < n; i++) __sim.step(DT); }

/**
 * 朝目标点走。摇杆事件里 y 是屏幕向上，Hero 内部映射为 -Z，
 * 所以世界 dz 要取负号后再发出去。
 */
function walkTo(tx, tz, maxFrames = 1200) {
  let f = 0;
  while (f++ < maxFrames) {
    const p = heroNode.position;
    const dx = tx - p.x, dz = tz - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.12) break;
    EventBus.emit(GameEvents.MOVE_DIR, dx / d, -dz / d);
    tick(1);
  }
  EventBus.emit(GameEvents.MOVE_STOP);
  return f;
}
/** 依次经过多个途经点 */
function walkPath(points) { for (const [x, z] of points) walkTo(x, z); }

console.log('\n=== Canyon Courier 3D 玩法验证 ===\n');
tick(2);   // 触发 start()，生成资源点

console.log('1) 资源撒布');
check(`撒出 ${fieldNode.children.length} 个资源点（目标 30）`,
  fieldNode.children.length === 30);
EventBus.emit(GameEvents.INPUT_START);

console.log('\n2) 靠近资源自动拾取');
check('起步时空手', hero.carrying === 0);
const nearest = fieldNode.children
  .map((n) => ({ n, d: Math.hypot(n.position.x, L.fieldZ + n.position.z - L.heroStartZ) }))
  .sort((a, b) => a.d - b.d)[0].n;
walkTo(nearest.position.x, L.fieldZ + nearest.position.z);
tick(40);
check('走到资源点后自动装货', hero.carrying > 0, `carrying=${hero.carrying.toFixed(1)}`);

console.log('\n3) 装满上限');
for (const p of fieldNode.children.slice(0, 16)) {
  walkTo(p.position.x, L.fieldZ + p.position.z, 400);
  tick(30);
  if (hero.freeSpace <= 0) break;
}
check('携带量不超过 capacity', hero.carrying <= hero.capacity + 1e-6,
  `carrying=${hero.carrying.toFixed(1)} / cap=${hero.capacity}`);
check('已装到相当的量', hero.carrying > 60, `carrying=${hero.carrying.toFixed(1)}`);

console.log('\n4) 岩浆掉货（带货踩左侧岩浆）');
let lostEvent = 0;
EventBus.on(GameEvents.CARRY_LOST, (v) => { lostEvent = v; });
walkTo(-(L.hazardGapHalfX + L.hazardBandHalfX), L.hazardZ);
tick(3);
check('踩岩浆后携带清零', hero.carrying === 0, `carrying=${hero.carrying}`);
check('广播了 CARRY_LOST', lostEvent > 0, `lost=${lostEvent.toFixed(1)}`);

console.log('\n5) 中央安全通道不掉货');
walkPath([[0, L.hazardZ + 3], [0, L.fieldZ]]);
for (const p of fieldNode.children.slice(0, 10)) {
  walkTo(p.position.x, L.fieldZ + p.position.z, 400);
  tick(25);
  if (hero.carrying > 80) break;
}
// 先回到资源区上缘再直上，避免路上继续捡货干扰判定
walkTo(0, L.fieldZ - L.fieldHalfZ - 0.9);
tick(3);
const beforeCross = hero.carrying;
check('过河前有货', beforeCross > 0, `carrying=${beforeCross.toFixed(1)}`);
walkTo(0, L.hazardZ);
tick(3);
check('走通道未掉货', hero.carrying === beforeCross, `carrying=${hero.carrying.toFixed(1)}`);

console.log('\n6) 倍率门翻倍');
let gateEvt = null;
EventBus.on(GameEvents.GATE_PASSED, (f, c) => { gateEvt = { f, c }; });
const ceiling = hero.capacity * hero.overflowFactor;
const beforeGate = hero.carrying;
walkTo(0, L.gateZ);
tick(3);
check('穿门后携带翻倍（可超出 capacity）',
  Math.abs(hero.carrying - Math.min(beforeGate * 2, ceiling)) < 1e-6,
  `${beforeGate.toFixed(1)} → ${hero.carrying.toFixed(1)}`);
check('满载穿门确有收益', hero.carrying > beforeGate);
check('广播了 GATE_PASSED', gateEvt && gateEvt.f === 2);

for (let i = 0; i < 8; i++) {          // 反复进出刷门必须被封顶
  walkTo(0, L.gateZ + 2.5, 300);
  walkTo(0, L.gateZ, 300);
  tick(2);
}
check('反复刷门被封顶', hero.carrying <= ceiling + 1e-6,
  `carrying=${hero.carrying.toFixed(1)} / 上限=${ceiling}`);

console.log('\n7) 从侧面绕开门则不翻倍');
// 退到岩浆与门之间的空档（z=-11 处两侧都没有岩浆），横move 到门的外侧再向前
walkPath([[0, L.gateZ + 2.5], [3.5, L.gateZ + 2.5]]);
tick(2);
const beforeBypass = hero.carrying;
walkTo(3.5, L.gateZ);
tick(3);
check('绕开门携带不变', hero.carrying === beforeBypass,
  `carrying=${hero.carrying.toFixed(1)}`);

console.log('\n8) 投递区自动计分');
let scoreNow = 0;
EventBus.on(GameEvents.SCORE_CHANGED, (s) => { scoreNow = s; });
const toDeliver = hero.carrying;
walkPath([[0, L.gateZ - 2], [0, L.deliveryZ]]);
tick(300);
check('携带被卸空', hero.carrying < 0.5, `carrying=${hero.carrying.toFixed(2)}`);
check('分数约等于投递量', Math.abs(scoreNow - Math.floor(toDeliver)) <= 1,
  `score=${scoreNow} vs 投递=${toDeliver.toFixed(1)}`);

console.log('\n9) 资源点捡空后自动补充');
hero.dropAll();
const target = fieldNode.children[0];
const trn = target.getComponent(ResourceNode);
const fullAmount = trn['_max'];
walkPath([[0, L.gateZ + 2.5], [0, L.fieldZ], [target.position.x, L.fieldZ + target.position.z]]);
// 途中会路过别的资源点而装满，这里持续清空携带，保证有余量把目标点抽干
let guard = 900;
while (trn.amount > 0 && guard-- > 0) { hero.carrying = 0; tick(1); }
check('资源点被捡空', trn.amount === 0, `amount=${trn.amount}`);
check('捡空后堆的视觉隐藏', trn.pileVisual.active === false);
walkTo(0, L.heroStartZ);           // 走开，否则补满瞬间又被站着的主角捡走
tick(Math.ceil(60 * (trn.respawnDelay + 0.5)));
check('过了补充延时后自动补满', trn.amount === fullAmount,
  `amount=${trn.amount} / max=${fullAmount}`);
check('补充后堆的视觉恢复', trn.pileVisual.active === true);

console.log('\n10) 朝向、通关与重开');
EventBus.emit(GameEvents.MOVE_DIR, 0, 1);   // 屏幕向上 = 世界 -Z
tick(20);
check('摇杆向上 → 朝 -Z 前进（投递区方向）',
  heroNode.position.z < L.heroStartZ, `z=${heroNode.position.z.toFixed(2)}`);
EventBus.emit(GameEvents.MOVE_DIR, 1, 0);
tick(20);
check('摇杆向右 → 朝 +X 前进', heroNode.position.x > 0,
  `x=${heroNode.position.x.toFixed(2)}`);
EventBus.emit(GameEvents.MOVE_STOP);

EventBus.emit(GameEvents.LEVEL_FINISHED);
tick(2);
check('状态变为 finished', flow.state === 'finished');
const before = { x: heroNode.position.x, z: heroNode.position.z };
EventBus.emit(GameEvents.MOVE_DIR, 0, 1);
tick(30);
check('通关后主角被冻结',
  heroNode.position.x === before.x && heroNode.position.z === before.z);

flow.restart();
tick(3);
check('重开后分数归零', flow.score === 0);
check('重开后携带归零', hero.carrying === 0);
check('重开后主角回到起点',
  Math.abs(heroNode.position.z - L.heroStartZ) < 1e-6 && Math.abs(heroNode.position.x) < 1e-6,
  `x=${heroNode.position.x}, z=${heroNode.position.z}`);
EventBus.emit(GameEvents.MOVE_DIR, 0, 1);
tick(30);
check('重开后可以再次移动', heroNode.position.z < L.heroStartZ,
  `z=${heroNode.position.z.toFixed(2)}`);

console.log(`\n=== ${failures === 0 ? '全部通过' : failures + ' 项失败'} ===\n`);
process.exit(failures === 0 ? 0 : 1);
