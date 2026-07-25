// 端到端玩法验证：拾取 → 翻倍 → 掉货 → 投递 → 通关 → 重开
//
// 用假的 cc 运行时在 Node 里跑玩法逻辑，不需要打开 Cocos Creator。
//   cd cocos-project/tools/sim && npm i && npm test
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
const { DeliveryZone } = require('./out/gameplay/DeliveryZone');
const { MultiplierGate } = require('./out/gameplay/MultiplierGate');
const { Hazard } = require('./out/gameplay/Hazard');

let failures = 0;
function check(label, cond, extra = '') {
  const tag = cond ? 'PASS' : 'FAIL';
  if (!cond) failures++;
  console.log(`  [${tag}] ${label}${extra ? '  → ' + extra : ''}`);
}

// ---------- 搭一个与 Bootstrap 同布局的迷你场景 ----------
const L = {
  heroStartY: -520, fieldY: -60, fieldHalfW: 250, fieldHalfH: 340,
  hazardY: 470, hazardHalfW: 95, hazardHalfH: 60, hazardGapHalf: 140,
  gateY: 800, gateHalfW: 150, gateHalfH: 38,
  deliveryY: 1150, deliveryRadius: 150,
};

const world = new Node('World');
__sim.scene.addChild(world);

const fieldNode = new Node('Field');
fieldNode.setPosition(0, L.fieldY);
world.addChild(fieldNode);
const field = fieldNode.addComponent(ResourceField);
field.halfWidth = L.fieldHalfW;
field.halfHeight = L.fieldHalfH;
field.nodeCount = 30;

for (const side of [-1, 1]) {
  const n = new Node('Hazard');
  n.setPosition(side * (L.hazardGapHalf + L.hazardHalfW), L.hazardY);
  world.addChild(n);
  const z = n.addComponent(TriggerZone);
  z.shape = ZoneShape.RECT; z.halfWidth = L.hazardHalfW; z.halfHeight = L.hazardHalfH;
  n.addComponent(Hazard).lossRatio = 1;
}

const gateNode = new Node('Gate');
gateNode.setPosition(0, L.gateY);
world.addChild(gateNode);
const gz = gateNode.addComponent(TriggerZone);
gz.shape = ZoneShape.RECT; gz.halfWidth = L.gateHalfW; gz.halfHeight = L.gateHalfH;
gateNode.addComponent(MultiplierGate).multiplier = 2;

const delNode = new Node('Delivery');
delNode.setPosition(0, L.deliveryY);
world.addChild(delNode);
const dz = delNode.addComponent(TriggerZone);
dz.shape = ZoneShape.CIRCLE; dz.radius = L.deliveryRadius * 0.86;
delNode.addComponent(DeliveryZone).deliverRate = 170;

const heroNode = new Node('Hero');
heroNode.setPosition(0, L.heroStartY);
world.addChild(heroNode);
const hero = heroNode.addComponent(Hero);
hero.minY = L.heroStartY - 100;
hero.maxY = L.deliveryY + 170;
heroNode.addComponent(TriggerActor);

const flow = new Node('Systems').addComponent
  ? (() => { const n = new Node('Systems'); __sim.scene.addChild(n); return n.addComponent(GameFlow); })()
  : null;

// ---------- 驱动 ----------
const DT = 1 / 60;
function tick(n = 1) { for (let i = 0; i < n; i++) __sim.step(DT); }
/** 朝目标点走，直到到达或超时；返回实际用掉的帧数 */
function walkTo(tx, ty, maxFrames = 1200) {
  let f = 0;
  while (f++ < maxFrames) {
    const p = heroNode.position;
    const dx = tx - p.x, dy = ty - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 6) break;
    EventBus.emit(GameEvents.MOVE_DIR, dx / d, dy / d);
    tick(1);
  }
  EventBus.emit(GameEvents.MOVE_STOP);
  return f;
}

console.log('\n=== Canyon Courier 玩法验证 ===\n');
tick(2);  // 触发 start()，生成资源点

console.log('1) 资源撒布');
const piles = fieldNode.children.length;
check(`撒出 ${piles} 个资源点（目标 30）`, piles >= 25 && piles <= 30);
EventBus.emit(GameEvents.INPUT_START);

console.log('\n2) 靠近资源自动拾取');
check('起步时空手', hero.carrying === 0);
// 走到最近的资源点上
const nearest = fieldNode.children
  .map((n) => ({ n, d: Math.hypot(n.position.x, n.position.y - (L.heroStartY - L.fieldY)) }))
  .sort((a, b) => a.d - b.d)[0].n;
walkTo(nearest.position.x, L.fieldY + nearest.position.y);
tick(40);
check('走到资源点后自动装货', hero.carrying > 0, `carrying=${hero.carrying.toFixed(1)}`);

console.log('\n3) 装满上限');
// 在资源区里来回扫，直到装满
for (const p of fieldNode.children.slice(0, 14)) {
  walkTo(p.position.x, L.fieldY + p.position.y, 400);
  tick(30);
  if (hero.freeSpace <= 0) break;
}
check('携带量不超过 capacity', hero.carrying <= hero.capacity + 1e-6,
  `carrying=${hero.carrying.toFixed(1)} / cap=${hero.capacity}`);
const loaded = hero.carrying;
check('已装到相当的量', loaded > 60, `carrying=${loaded.toFixed(1)}`);

console.log('\n4) 岩浆掉货（带货踩左侧岩浆）');
let lostEvent = 0;
EventBus.on(GameEvents.CARRY_LOST, (v) => { lostEvent = v; });
walkTo(-(L.hazardGapHalf + L.hazardHalfW), L.hazardY);
tick(3);
check('踩岩浆后携带清零', hero.carrying === 0, `carrying=${hero.carrying}`);
check('广播了 CARRY_LOST', lostEvent > 0, `lost=${lostEvent.toFixed(1)}`);

console.log('\n5) 安全通道不掉货');
walkTo(0, L.fieldY + 200);
tick(5);
for (const p of fieldNode.children.slice(0, 8)) {
  walkTo(p.position.x, L.fieldY + p.position.y, 400);
  tick(25);
  if (hero.carrying > 80) break;
}
// 先走到资源区上缘（离开资源点），再直上通道，避免路上继续捡货干扰判定
walkTo(0, L.fieldY + L.fieldHalfH + 90);
tick(3);
const beforeCross = hero.carrying;
check('过河前有货', beforeCross > 0, `carrying=${beforeCross.toFixed(1)}`);
walkTo(0, L.hazardY);          // 走中央安全通道
tick(3);
check('走通道未掉货', hero.carrying === beforeCross,
  `carrying=${hero.carrying.toFixed(1)}`);

console.log('\n6) 倍率门翻倍');
let gateEvt = null;
EventBus.on(GameEvents.GATE_PASSED, (f, c) => { gateEvt = { f, c }; });
const ceiling = hero.capacity * hero.overflowFactor;
const beforeGate = hero.carrying;
walkTo(0, L.gateY);
tick(3);
check('穿门后携带翻倍（可超出 capacity）',
  Math.abs(hero.carrying - Math.min(beforeGate * 2, ceiling)) < 1e-6,
  `${beforeGate.toFixed(1)} → ${hero.carrying.toFixed(1)}`);
check('满载穿门确有收益', hero.carrying > beforeGate);
check('广播了 GATE_PASSED', gateEvt && gateEvt.f === 2);

// 反复进出刷门必须被封顶
for (let i = 0; i < 8; i++) {
  walkTo(0, L.gateY - 200, 300);
  walkTo(0, L.gateY, 300);
  tick(2);
}
check('反复刷门被封顶', hero.carrying <= ceiling + 1e-6,
  `carrying=${hero.carrying.toFixed(1)} / 上限=${ceiling}`);

console.log('\n7) 绕开门则不翻倍');
walkTo(0, L.gateY - 200);      // 退出门的判定
tick(2);
const beforeBypass = hero.carrying;
walkTo(280, L.gateY);          // 从门右侧空档绕过
tick(3);
check('绕开门携带不变', hero.carrying === beforeBypass,
  `carrying=${hero.carrying.toFixed(1)}`);

console.log('\n8) 投递区自动计分');
let scoreNow = 0;
EventBus.on(GameEvents.SCORE_CHANGED, (s) => { scoreNow = s; });
const toDeliver = hero.carrying;
walkTo(0, L.deliveryY);
tick(300);                     // 停在投递区上持续卸货（480 货 / 170每秒 ≈ 3s）
check('携带被卸空', hero.carrying < 0.5, `carrying=${hero.carrying.toFixed(2)}`);
check('分数约等于投递量', Math.abs(scoreNow - Math.floor(toDeliver)) <= 1,
  `score=${scoreNow} vs 投递=${toDeliver.toFixed(1)}`);

console.log('\n9) 资源点捡空后自动补充');
const { ResourceNode } = require('./out/gameplay/ResourceNode');
// 挑一个点，空手站上去把它彻底捡空
hero.dropAll();
const target = fieldNode.children[0];
const trn = target.getComponent(ResourceNode);
const fullAmount = trn['_max'];   // 该点的满量（amount 可能已被路过时捡掉一部分）
walkTo(target.position.x, L.fieldY + target.position.y);
let guard = 600;
while (trn.amount > 0 && guard-- > 0) tick(1);
check('资源点被捡空', trn.amount === 0, `amount=${trn.amount}`);
check('捡空后堆的视觉隐藏', trn.pileVisual.active === false);
// 走开，否则补满的瞬间又被站着的主角捡走
walkTo(0, L.heroStartY);
tick(Math.ceil(60 * (trn.respawnDelay + 0.5)));
check('过了补充延时后自动补满', trn.amount === fullAmount,
  `amount=${trn.amount} / max=${fullAmount}`);
check('补充后堆的视觉恢复', trn.pileVisual.active === true);

console.log('\n10) 通关与重开');
EventBus.emit(GameEvents.LEVEL_FINISHED);
tick(2);
check('状态变为 finished', flow.state === 'finished');
const posBefore = { x: heroNode.position.x, y: heroNode.position.y };
EventBus.emit(GameEvents.MOVE_DIR, 0, 1);
tick(30);
check('通关后主角被冻结',
  heroNode.position.x === posBefore.x && heroNode.position.y === posBefore.y);

flow.restart();
tick(3);
check('重开后分数归零', flow.score === 0);
check('重开后携带归零', hero.carrying === 0);
check('重开后主角回到起点', Math.abs(heroNode.position.y - L.heroStartY) < 1e-6,
  `y=${heroNode.position.y}`);
EventBus.emit(GameEvents.MOVE_DIR, 0, 1);
tick(30);
check('重开后可以再次移动', heroNode.position.y > L.heroStartY,
  `y=${heroNode.position.y.toFixed(1)}`);

console.log(`\n=== ${failures === 0 ? '全部通过' : failures + ' 项失败'} ===\n`);
process.exit(failures === 0 ? 0 : 1);
