import {
  _decorator, Component, Node, director, Director, Canvas, Camera, UITransform,
  Widget, Layers, Color, Label, Vec2, view, Button, ResolutionPolicy, math,
} from 'cc';
import { Sprites } from './core/Sprites';
import { GameFlow } from './core/GameFlow';
import { MoveInput } from './core/MoveInput';
import { TriggerZone, TriggerActor, ZoneShape } from './core/TriggerZone';
import { Hero } from './gameplay/Hero';
import { ResourceField } from './gameplay/ResourceField';
import { DeliveryZone } from './gameplay/DeliveryZone';
import { MultiplierGate } from './gameplay/MultiplierGate';
import { Hazard } from './gameplay/Hazard';
import { CarryStack } from './gameplay/CarryStack';
import { CameraFollow } from './gameplay/CameraFollow';
import { HUD } from './ui/HUD';

const { ccclass } = _decorator;

/** 设计分辨率（竖屏 playable） */
const DESIGN_W = 720;
const DESIGN_H = 1280;

/** 关卡布局（World 局部坐标，y 向上） */
const L = {
  playHalfW: 300,       // 主角活动半宽
  wallX: 352,           // 峡谷岩壁位置
  groundW: 820,
  groundTop: 2150,      // 上下都留足余量，任何滚动位置都不会露出画布底色
  groundBottom: -1200,
  heroStartY: -520,
  // 资源区下缘要离主角出生点足够远（> 拾取半径），否则开局就自动装货
  fieldY: -60,          // 资源区中心
  fieldHalfW: 250,
  fieldHalfH: 340,
  hazardY: 470,         // 岩浆带（中间留安全通道）
  hazardHalfW: 95,
  hazardHalfH: 60,
  hazardGapHalf: 140,   // 中央安全通道半宽
  gateY: 800,           // 倍率门（比通道窄，绕开就吃不到）
  gateHalfW: 150,
  gateHalfH: 38,
  deliveryY: 1150,
  deliveryRadius: 150,
};

const COL = {
  bg: new Color(23, 16, 14, 255),
  chip: new Color(30, 22, 19, 205),
  chipLine: new Color(255, 255, 255, 70),
  gold: new Color(255, 215, 100, 255),
  cyan: new Color(95, 234, 255, 255),
  text: new Color(255, 247, 223, 255),
  dim: new Color(42, 18, 11, 190),
  barBg: new Color(0, 0, 0, 120),
  barFill: new Color(70, 214, 255, 255),
  btn: new Color(255, 206, 67, 255),
  btnText: new Color(42, 22, 14, 255),
};

/**
 * 启动器：在运行时把整个游戏搭出来（相机、场景、UI、玩法模块全部代码生成）。
 *
 * 这样做的好处：不依赖任何手工拼装的 .prefab / 场景节点树，
 * 把工程丢进 Cocos Creator 打开就能直接跑；模块化拆分仍然保持
 * （每个玩法模块是独立组件 + 可调 @property，见 docs/design.md）。
 */
@ccclass('Bootstrap')
export class Bootstrap extends Component { }

let building = false;

async function build() {
  const scene = director.getScene();
  if (!scene || building) return;
  if (scene.getChildByName('GameRoot')) return;   // 已搭好，避免重复
  building = true;

  await Sprites.preload();

  // 竖屏 playable：锁定高度，宽度随设备比例伸缩
  view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.FIXED_HEIGHT);
  const vs = view.getVisibleSize();

  // ---------- 画布与相机 ----------
  const root = new Node('GameRoot');
  scene.addChild(root);
  const rootUI = root.addComponent(UITransform);
  rootUI.setContentSize(vs.width, vs.height);

  const camNode = new Node('UICamera');
  root.addChild(camNode);
  camNode.setPosition(0, 0, 1000);
  const camera = camNode.addComponent(Camera);
  camera.projection = Camera.ProjectionType.ORTHO;
  camera.orthoHeight = vs.height / 2;
  camera.near = 1;
  camera.far = 3000;
  camera.clearFlags = Camera.ClearFlag.SOLID_COLOR;
  camera.clearColor = COL.bg;
  camera.visibility = Layers.Enum.UI_2D;

  const canvas = root.addComponent(Canvas);
  canvas.cameraComponent = camera;
  const widget = root.addComponent(Widget);
  widget.isAlignLeft = widget.isAlignRight = widget.isAlignTop = widget.isAlignBottom = true;
  widget.left = widget.right = widget.top = widget.bottom = 0;
  widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

  // ---------- 世界 ----------
  const world = Sprites.makeNode({ name: 'World', parent: root });
  buildTerrain(world);

  const field = Sprites.makeNode({ name: 'ResourceField', parent: world, y: L.fieldY });
  const rf = field.addComponent(ResourceField);
  rf.halfWidth = L.fieldHalfW;
  rf.halfHeight = L.fieldHalfH;
  rf.nodeCount = 30;

  buildHazards(world);
  buildGate(world);
  buildDelivery(world);
  const hero = buildHero(world);

  const follow = world.addComponent(CameraFollow);
  follow.target = hero;
  follow.screenAnchorY = -180;
  follow.minWorldY = -(L.deliveryY + 220);
  follow.maxWorldY = -(L.heroStartY) - 180 + 260;

  // ---------- UI ----------
  const ui = Sprites.makeNode({ name: 'UI', parent: root });
  const hud = buildHUD(ui, vs.width, vs.height);

  // ---------- 系统组件 ----------
  const systems = new Node('Systems');
  root.addChild(systems);
  const flow = systems.addComponent(GameFlow);
  flow.targetScore = 0;
  flow.timeLimit = 0;

  const joyBase = Sprites.makeNode({ name: 'JoyBase', sprite: 'joy-base', parent: ui, width: 160, height: 160 });
  const joyKnob = Sprites.makeNode({ name: 'JoyKnob', sprite: 'joy-knob', parent: ui, width: 88, height: 88 });
  joyBase.active = joyKnob.active = false;
  const move = systems.addComponent(MoveInput);
  move.joyBase = joyBase;
  move.joyKnob = joyKnob;

  // 结算面板的"再来一次"绑到 GameFlow.restart
  const restartBtn = hud.node.getChildByPath('Result/Card/RestartBtn');
  restartBtn?.on(Button.EventType.CLICK, () => flow.restart(), flow);

  setLayerRecursive(root, Layers.Enum.UI_2D);
  building = false;
  console.log('[Bootstrap] Canyon Courier 已启动');
}

// ---------------- 场景装配 ----------------

function buildTerrain(world: Node) {
  const h = L.groundTop - L.groundBottom;
  Sprites.makeNode({
    name: 'Ground', sprite: 'ground', parent: world,
    y: (L.groundTop + L.groundBottom) / 2,
    width: L.groundW, height: h, tiled: true,
  });

  // 峡谷两侧岩壁
  const rocks = Sprites.makeNode({ name: 'Rocks', parent: world });
  for (let y = L.groundBottom + 60; y < L.groundTop; y += 155) {
    for (const side of [-1, 1]) {
      const rock = Sprites.makeNode({
        name: 'Rock', sprite: 'rock', parent: rocks,
        x: side * (L.wallX + math.randomRange(-14, 14)),
        y: y + math.randomRange(-30, 30),
        width: 130, height: 130,
      });
      rock.angle = math.randomRange(0, 360);
      const s = math.randomRange(0.85, 1.2);
      rock.setScale(s, s, 1);
    }
  }
}

function buildHazards(world: Node) {
  // 左右两段岩浆，中间留出安全通道 —— 带货过河要走位
  for (const side of [-1, 1]) {
    const cx = side * (L.hazardGapHalf + L.hazardHalfW);
    const node = Sprites.makeNode({ name: 'Hazard', parent: world, x: cx, y: L.hazardY });
    Sprites.makeNode({
      name: 'Lava', sprite: 'hazard', parent: node,
      width: L.hazardHalfW * 2, height: L.hazardHalfH * 2,
    });
    const zone = node.addComponent(TriggerZone);
    zone.shape = ZoneShape.RECT;
    zone.halfWidth = L.hazardHalfW;
    zone.halfHeight = L.hazardHalfH;
    const hz = node.addComponent(Hazard);
    hz.lossRatio = 1;
  }
}

function buildGate(world: Node) {
  const node = Sprites.makeNode({ name: 'Gate', parent: world, y: L.gateY });
  Sprites.makeNode({
    name: 'Frame', sprite: 'gate', parent: node,
    width: L.gateHalfW * 2 + 40, height: 120,
  });
  const zone = node.addComponent(TriggerZone);
  zone.shape = ZoneShape.RECT;
  zone.halfWidth = L.gateHalfW;
  zone.halfHeight = L.gateHalfH;
  const gate = node.addComponent(MultiplierGate);
  gate.multiplier = 2;
  makeLabel(node, '×2', 46, COL.gold, 0, -34);
}

function buildDelivery(world: Node) {
  const node = Sprites.makeNode({ name: 'Delivery', parent: world, y: L.deliveryY });
  Sprites.makeNode({
    name: 'Pad', sprite: 'delivery-pad', parent: node,
    width: L.deliveryRadius * 2, height: L.deliveryRadius * 2,
  });
  const zone = node.addComponent(TriggerZone);
  zone.shape = ZoneShape.CIRCLE;
  zone.radius = L.deliveryRadius * 0.86;
  const dz = node.addComponent(DeliveryZone);
  dz.deliverRate = 170;
  makeLabel(node, '投递区', 30, COL.text, 0, -L.deliveryRadius - 34);
}

function buildHero(world: Node): Node {
  const node = Sprites.makeNode({
    name: 'Hero', parent: world, y: L.heroStartY,
    width: 96, height: 112, sprite: 'hero',
  });
  const hero = node.addComponent(Hero);
  hero.boundX = L.playHalfW;
  hero.minY = L.heroStartY - 100;
  hero.maxY = L.deliveryY + 170;
  node.addComponent(TriggerActor);

  // 携带堆锚点：车头前方，货越多堆得越前
  const stackAnchor = Sprites.makeNode({ name: 'CarryAnchor', parent: node, y: 76 });
  stackAnchor.addComponent(CarryStack);
  return node;
}

// ---------------- UI 装配 ----------------

function buildHUD(ui: Node, viewW: number, viewH: number): HUD {
  const hud = ui.addComponent(HUD);
  const halfW = viewW / 2, halfH = viewH / 2;

  // 顶部标题
  makeLabel(ui, 'CANYON COURIER', 22, COL.text, -halfW + 118, halfH - 52);
  makeLabel(ui, 'LEVEL 01', 14, COL.gold, -halfW + 82, halfH - 78);

  // 分数条
  const scoreChip = Sprites.makeNode({
    name: 'ScoreChip', sprite: 'panel', parent: ui,
    x: halfW - 118, y: halfH - 62, width: 176, height: 62, color: COL.chip,
  });
  makeLabel(scoreChip, '◆', 26, COL.cyan, -58, 0);
  hud.scoreLabel = makeLabel(scoreChip, '0', 34, COL.text, 14, 0);

  // 携带量条
  const carryY = halfH - 132;
  makeLabel(ui, '载货', 18, COL.text, -halfW + 52, carryY);
  const barBg = Sprites.makeNode({
    name: 'CarryBar', sprite: 'panel', parent: ui,
    x: -halfW + 208, y: carryY, width: 220, height: 22, color: COL.barBg,
  });
  const fill = Sprites.makeNode({
    name: 'Fill', sprite: 'panel', parent: barBg,
    width: 220, height: 22, color: COL.barFill,
  });
  // 以左边缘为轴缩放，进度条才会从左往右长
  fill.getComponent(UITransform)!.setAnchorPoint(new Vec2(0, 0.5));
  fill.setPosition(-110, 0);
  fill.setScale(0, 1, 1);
  hud.carryBarFill = fill;
  hud.carryLabel = makeLabel(ui, '0 / 0', 18, COL.text, -halfW + 208 + 148, carryY);

  // 中央飘字
  hud.popLabel = makeLabel(ui, '', 76, COL.gold, 0, 40);
  hud.popLabel.node.active = false;

  // 底部提示
  const hint = Sprites.makeNode({
    name: 'Hint', sprite: 'panel', parent: ui,
    x: 0, y: -halfH + 150, width: 330, height: 56, color: COL.chip,
  });
  makeLabel(hint, '按住拖动 · 靠近自动装货', 22, COL.text, 0, 0);
  hud.hintNode = hint;

  // 结算面板
  const result = Sprites.makeNode({
    name: 'Result', sprite: 'panel', parent: ui,
    width: viewW, height: viewH, color: COL.dim,
  });
  const card = Sprites.makeNode({
    name: 'Card', sprite: 'panel', parent: result,
    width: 460, height: 330, color: COL.chip,
  });
  makeLabel(card, '本轮收集', 22, COL.gold, 0, 106);
  hud.finalScoreLabel = makeLabel(card, '0', 76, COL.text, 0, 26);
  const btn = Sprites.makeNode({
    name: 'RestartBtn', sprite: 'panel', parent: card,
    y: -96, width: 260, height: 74, color: COL.btn,
  });
  makeLabel(btn, '再来一次', 28, COL.btnText, 0, 0);
  btn.addComponent(Button);
  result.active = false;
  hud.resultPanel = result;

  return hud;
}

// ---------------- 工具 ----------------

function makeLabel(parent: Node, text: string, size: number, color: Color, x = 0, y = 0): Label {
  const node = new Node('Label');
  node.layer = Layers.Enum.UI_2D;
  node.addComponent(UITransform).setAnchorPoint(new Vec2(0.5, 0.5));
  parent.addChild(node);
  node.setPosition(x, y);
  const label = node.addComponent(Label);
  label.string = text;
  label.fontSize = size;
  label.lineHeight = size * 1.25;
  label.useSystemFont = true;
  label.horizontalAlign = Label.HorizontalAlign.CENTER;
  label.verticalAlign = Label.VerticalAlign.CENTER;
  label.color = color;
  return label;
}

function setLayerRecursive(node: Node, layer: number) {
  node.layer = layer;
  for (const child of node.children) setLayerRecursive(child, layer);
}

// ---------------- 自启动 ----------------
// 脚本模块在首个场景启动前被加载并执行，这里挂监听即可自动搭场景，
// 因此工程里不需要任何手工拼好的场景节点。
director.on(Director.EVENT_AFTER_SCENE_LAUNCH, () => { void build(); });
if (director.getScene()) void build();
