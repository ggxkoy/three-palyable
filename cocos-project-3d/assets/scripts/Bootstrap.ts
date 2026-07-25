import {
  _decorator, Component, Node, director, Director, Canvas, Camera, UITransform,
  Widget, Layers, Color, Label, Vec2, Vec3, view, Button, ResolutionPolicy, math,
  DirectionalLight,
} from 'cc';
import { Prims } from './core/Prims';
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

const DESIGN_W = 720;
const DESIGN_H = 1280;

/**
 * 关卡布局（世界单位，主角朝 -Z 前进）。
 *
 * 两条必须保持的约束：
 *  - 资源区靠出生点一侧的边缘，与出生点的间距要 > 拾取半径，
 *    否则开局（以及每次重开）主角就立刻自动装货。
 *  - 倍率门要比中央安全通道窄，绕开才有意义 —— 这是玩家唯一的取舍。
 */
const L = {
  playHalfX: 4.0,
  wallX: 5.0,
  groundW: 12,
  groundLen: 46,
  groundCenterZ: -6,

  heroStartZ: 9,

  fieldZ: 0.5,
  fieldHalfX: 3.5,
  fieldHalfZ: 5.8,
  pickupRadius: 1.8,

  hazardZ: -8.5,
  hazardHalfZ: 1.2,
  hazardGapHalfX: 1.9,   // 中央安全通道半宽
  hazardBandHalfX: 1.6,

  gateZ: -13,
  gateHalfX: 2.1,
  gateHalfZ: 0.75,

  deliveryZ: -19,
  deliveryRadius: 2.6,

  heroMinZ: -21,
  heroMaxZ: 10,
};

/** 峡谷配色，沿用 three.js 原版 */
const M = {
  ground: { color: 0x8e5237, roughness: 0.95 },
  rock: [
    { color: 0xa95f3f, roughness: 0.9 },
    { color: 0x81412f, roughness: 0.9 },
    { color: 0xc07148, roughness: 0.9 },
  ],
  body: { color: 0xf0a30e, roughness: 0.55, metallic: 0.1 },
  bodyLight: { color: 0xffc52a, roughness: 0.5, metallic: 0.1 },
  glass: { color: 0x83d7d6, roughness: 0.18, metallic: 0.2 },
  track: { color: 0x332b27, roughness: 0.85 },
  blade: { color: 0xffbd16, roughness: 0.3, metallic: 0.65 },
  gold: { color: 0xf4b826, roughness: 0.4, metallic: 0.5 },
  goldRim: { color: 0xffd548, roughness: 0.3, metallic: 0.7 },
  purple: { color: 0x8c39dd, roughness: 0.5 },
  purpleLight: { color: 0xb34fff, roughness: 0.45 },
  lava: { color: 0xff3b0b, roughness: 0.5, emissive: 0xff5a12 },
  lavaHot: { color: 0xffa828, roughness: 0.5, emissive: 0xffa828 },
};

const COL = {
  sky: new Color(78, 44, 32, 255),
  chip: new Color(30, 22, 19, 205),
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
 * 启动器：运行时把整个 3D 游戏搭出来（相机、灯光、地形、玩法模块、UI）。
 *
 * 世界里没有任何 .fbx / .mesh 资源 —— 全部用 Cocos 内置参数化几何体生成，
 * 所以工程丢进编辑器打开就能跑，不需要美术管线，也不需要手工拼 Prefab。
 * 模块化拆分照旧保留（每个玩法元素是独立组件 + 可调 @property）。
 */
@ccclass('Bootstrap')
export class Bootstrap extends Component { }

let building = false;

async function build() {
  const scene = director.getScene();
  if (!scene || building) return;
  if (scene.getChildByName('GameRoot')) return;
  building = true;

  await Sprites.preload();
  view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.FIXED_HEIGHT);

  const root = new Node('GameRoot');
  root.layer = Layers.Enum.DEFAULT;
  scene.addChild(root);

  buildLights(root);
  const world = Prims.make({ name: 'World', parent: root });
  buildTerrain(world);
  buildHazards(world);
  buildGate(world);
  buildDelivery(world);

  const field = Prims.make({ name: 'ResourceField', parent: world, pos: [0, 0, L.fieldZ] });
  const rf = field.addComponent(ResourceField);
  rf.halfX = L.fieldHalfX;
  rf.halfZ = L.fieldHalfZ;
  rf.pickupRadius = L.pickupRadius;
  rf.nodeCount = 30;

  const hero = buildHero(world);
  const mainCam = buildMainCamera(root, hero);
  const hud = buildUI(root, mainCam);

  const systems = new Node('Systems');
  systems.layer = Layers.Enum.DEFAULT;
  root.addChild(systems);
  const flow = systems.addComponent(GameFlow);

  const joyBase = hud.node.getChildByName('JoyBase');
  const joyKnob = hud.node.getChildByName('JoyKnob');
  const move = systems.addComponent(MoveInput);
  move.joyBase = joyBase;
  move.joyKnob = joyKnob;

  hud.node.getChildByPath('Result/Card/RestartBtn')
    ?.on(Button.EventType.CLICK, () => flow.restart(), flow);

  building = false;
  console.log('[Bootstrap] Canyon Courier 3D 已启动');
}

// ---------------- 灯光 ----------------

function buildLights(root: Node) {
  // 主光：暖色，从左前上方打下来
  const key = new Node('KeyLight');
  key.layer = Layers.Enum.DEFAULT;
  root.addChild(key);
  key.setRotationFromEuler(-52, -38, 0);
  const keyLight = key.addComponent(DirectionalLight);
  keyLight.color = new Color(255, 226, 186, 255);
  keyLight.illuminance = 90000;

  // 补光：冷色、较弱，从后右方补出体积感（场景没开阴影，靠双光源塑形）
  const fill = new Node('FillLight');
  fill.layer = Layers.Enum.DEFAULT;
  root.addChild(fill);
  fill.setRotationFromEuler(-24, 150, 0);
  const fillLight = fill.addComponent(DirectionalLight);
  fillLight.color = new Color(150, 170, 220, 255);
  fillLight.illuminance = 26000;
}

// ---------------- 相机 ----------------

function buildMainCamera(root: Node, hero: Node): Camera {
  const node = new Node('MainCamera');
  node.layer = Layers.Enum.DEFAULT;
  root.addChild(node);
  // 俯角 60°：够俯视（贴近参考视频），同时 z 方向的透视拉伸小
  node.setRotationFromEuler(-60, 0, 0);

  const cam = node.addComponent(Camera);
  cam.projection = Camera.ProjectionType.ORTHO;
  cam.orthoHeight = 10;
  cam.near = 0.1;
  cam.far = 200;
  cam.clearFlags = Camera.ClearFlag.SOLID_COLOR;
  cam.clearColor = COL.sky;
  cam.visibility = Layers.Enum.DEFAULT;
  cam.priority = 0;

  const follow = node.addComponent(CameraFollow);
  follow.target = hero;
  // 俯角 60° 时，z 偏移 = 高度 / tan(60°)，相机才正对主角
  follow.offset = new Vec3(0, 14, 14 / Math.tan(60 * Math.PI / 180));
  follow.minZ = L.deliveryZ - 2;
  follow.maxZ = L.heroMaxZ;
  return cam;
}

// ---------------- 世界 ----------------

function buildTerrain(world: Node) {
  Prims.make({
    name: 'Ground', parent: world, mesh: Prims.planeMesh(), mat: M.ground,
    pos: [0, 0, L.groundCenterZ], scale: [L.groundW, 1, L.groundLen],
  });

  // 峡谷两侧的低多边形岩壁
  const rocks = Prims.make({ name: 'Rocks', parent: world });
  const zFrom = L.groundCenterZ - L.groundLen / 2 + 1;
  const zTo = L.groundCenterZ + L.groundLen / 2 - 1;
  let i = 0;
  for (let z = zFrom; z < zTo; z += 1.5) {
    for (const side of [-1, 1]) {
      const s = math.randomRange(1.1, 1.9);
      const rock = Prims.gem('Rock', rocks, s / 2,
        [side * (L.wallX + math.randomRange(-0.3, 0.5)),
         math.randomRange(0.05, 0.45),
         z + math.randomRange(-0.5, 0.5)],
        M.rock[i++ % M.rock.length], 5);
      rock.setRotationFromEuler(
        math.randomRange(0, 360), math.randomRange(0, 360), math.randomRange(0, 360));
      rock.setScale(s, s * math.randomRange(0.7, 1.15), s * math.randomRange(0.8, 1.2));
    }
  }
}

function buildHazards(world: Node) {
  // 左右两段岩浆，中间留出安全通道 —— 带货过河要走位
  for (const side of [-1, 1]) {
    const cx = side * (L.hazardGapHalfX + L.hazardBandHalfX);
    const node = Prims.make({ name: 'Hazard', parent: world, pos: [cx, 0, L.hazardZ] });

    Prims.make({
      name: 'Lava', parent: node, mesh: Prims.planeMesh(), mat: M.lava,
      pos: [0, 0.03, 0], scale: [L.hazardBandHalfX * 2, 1, L.hazardHalfZ * 2],
    });
    // 几处亮斑，让岩浆不至于是一块纯色板
    for (let i = 0; i < 4; i++) {
      Prims.gem('Blob', node, math.randomRange(0.18, 0.34), [
        math.randomRange(-L.hazardBandHalfX * 0.7, L.hazardBandHalfX * 0.7),
        0.06,
        math.randomRange(-L.hazardHalfZ * 0.6, L.hazardHalfZ * 0.6),
      ], M.lavaHot, 6);
    }

    const zone = node.addComponent(TriggerZone);
    zone.shape = ZoneShape.BOX;
    zone.halfX = L.hazardBandHalfX;
    zone.halfZ = L.hazardHalfZ;
    node.addComponent(Hazard).lossRatio = 1;
  }
}

function buildGate(world: Node) {
  const node = Prims.make({ name: 'Gate', parent: world, pos: [0, 0, L.gateZ] });
  for (const side of [-1, 1]) {
    Prims.box('Post', node, [0.28, 2.1, 0.28],
      [side * L.gateHalfX, 1.05, 0], M.purple);
  }
  Prims.box('Bar', node, [L.gateHalfX * 2 + 0.28, 0.3, 0.28], [0, 2.15, 0], M.purpleLight);
  // 门下的地面高亮，提示"从这里过"
  Prims.make({
    name: 'GateMark', parent: node, mesh: Prims.planeMesh(), mat: M.purpleLight,
    pos: [0, 0.02, 0], scale: [L.gateHalfX * 2, 1, L.gateHalfZ * 2],
  });

  const zone = node.addComponent(TriggerZone);
  zone.shape = ZoneShape.BOX;
  zone.halfX = L.gateHalfX;
  zone.halfZ = L.gateHalfZ;
  node.addComponent(MultiplierGate).multiplier = 2;
}

function buildDelivery(world: Node) {
  const node = Prims.make({ name: 'Delivery', parent: world, pos: [0, 0, L.deliveryZ] });
  Prims.disc('Pad', node, L.deliveryRadius, 0.16, [0, 0.08, 0], M.gold);
  Prims.make({
    name: 'Rim', parent: node, mesh: Prims.torusMesh(0.025), mat: M.goldRim,
    pos: [0, 0.17, 0], scale: [L.deliveryRadius * 2, L.deliveryRadius * 2, L.deliveryRadius * 2],
  });

  const zone = node.addComponent(TriggerZone);
  zone.shape = ZoneShape.CIRCLE;
  zone.radius = L.deliveryRadius * 0.9;
  node.addComponent(DeliveryZone).deliverRate = 170;
}

function buildHero(world: Node): Node {
  // 模型朝 +Z 搭（铲刀在 +Z），Hero 用 yaw = atan2(dirX, dirZ) 对准移动方向
  const node = Prims.make({ name: 'Hero', parent: world, pos: [0, 0, L.heroStartZ] });

  Prims.box('Body', node, [1.5, 0.55, 1.9], [0, 0.6, 0], M.body);
  Prims.box('Cab', node, [1.05, 0.55, 0.85], [0, 1.05, -0.1], M.bodyLight);
  Prims.box('Glass', node, [0.86, 0.34, 0.08], [0, 1.1, 0.32], M.glass);
  for (const side of [-1, 1]) {
    Prims.box('Track', node, [0.28, 0.44, 1.95], [side * 0.82, 0.4, 0], M.track);
  }
  Prims.box('Blade', node, [2.5, 0.72, 0.18], [0, 0.46, 1.25], M.blade);
  for (let i = 0; i < 7; i++) {
    Prims.box('Tooth', node, [0.1, 0.24, 0.4], [-0.9 + i * 0.3, 0.16, 1.42], M.blade);
  }

  const hero = node.addComponent(Hero);
  hero.boundX = L.playHalfX;
  hero.minZ = L.heroMinZ;
  hero.maxZ = L.heroMaxZ;
  node.addComponent(TriggerActor);

  // 携带堆锚点：铲刀正前方，货越多堆得越高越前
  const anchor = Prims.make({ name: 'CarryAnchor', parent: node, pos: [0, 0.2, 1.6] });
  anchor.addComponent(CarryStack);
  return node;
}

// ---------------- UI（2D 叠在 3D 之上） ----------------

function buildUI(root: Node, _mainCam: Camera): HUD {
  const vs = view.getVisibleSize();

  const canvasNode = new Node('UICanvas');
  canvasNode.layer = Layers.Enum.UI_2D;
  root.addChild(canvasNode);
  canvasNode.addComponent(UITransform).setContentSize(vs.width, vs.height);

  const camNode = new Node('UICamera');
  camNode.layer = Layers.Enum.UI_2D;
  canvasNode.addChild(camNode);
  camNode.setPosition(0, 0, 1000);
  const uiCam = camNode.addComponent(Camera);
  uiCam.projection = Camera.ProjectionType.ORTHO;
  uiCam.orthoHeight = vs.height / 2;
  uiCam.near = 1;
  uiCam.far = 3000;
  // 只清深度，否则会把 3D 画面整块盖掉
  uiCam.clearFlags = Camera.ClearFlag.DEPTH_ONLY;
  uiCam.visibility = Layers.Enum.UI_2D;
  uiCam.priority = 1;   // 高于主相机，最后绘制

  const canvas = canvasNode.addComponent(Canvas);
  canvas.cameraComponent = uiCam;
  const widget = canvasNode.addComponent(Widget);
  widget.isAlignLeft = widget.isAlignRight = widget.isAlignTop = widget.isAlignBottom = true;
  widget.left = widget.right = widget.top = widget.bottom = 0;
  widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

  return buildHUD(canvasNode, vs.width, vs.height);
}

function buildHUD(ui: Node, viewW: number, viewH: number): HUD {
  const hud = ui.addComponent(HUD);
  const halfW = viewW / 2, halfH = viewH / 2;

  makeLabel(ui, 'CANYON COURIER', 22, COL.text, -halfW + 118, halfH - 52);
  makeLabel(ui, 'LEVEL 01', 14, COL.gold, -halfW + 82, halfH - 78);

  const scoreChip = Sprites.makeNode({
    name: 'ScoreChip', sprite: 'panel', parent: ui,
    x: halfW - 118, y: halfH - 62, width: 176, height: 62, color: COL.chip,
  });
  makeLabel(scoreChip, '◆', 26, COL.cyan, -58, 0);
  hud.scoreLabel = makeLabel(scoreChip, '0', 34, COL.text, 14, 0);

  const carryY = halfH - 132;
  makeLabel(ui, '载货', 18, COL.text, -halfW + 52, carryY);
  const barBg = Sprites.makeNode({
    name: 'CarryBar', sprite: 'panel', parent: ui,
    x: -halfW + 208, y: carryY, width: 220, height: 22, color: COL.barBg,
  });
  const fill = Sprites.makeNode({
    name: 'Fill', sprite: 'panel', parent: barBg, width: 220, height: 22, color: COL.barFill,
  });
  // 以左边缘为轴缩放，进度条才会从左往右长
  fill.getComponent(UITransform)!.setAnchorPoint(new Vec2(0, 0.5));
  fill.setPosition(-110, 0);
  fill.setScale(0, 1, 1);
  hud.carryBarFill = fill;
  hud.carryLabel = makeLabel(ui, '0 / 0', 18, COL.text, -halfW + 356, carryY);

  hud.popLabel = makeLabel(ui, '', 76, COL.gold, 0, 40);
  hud.popLabel.node.active = false;

  const hint = Sprites.makeNode({
    name: 'Hint', sprite: 'panel', parent: ui,
    x: 0, y: -halfH + 150, width: 330, height: 56, color: COL.chip,
  });
  makeLabel(hint, '按住拖动 · 靠近自动装货', 22, COL.text, 0, 0);
  hud.hintNode = hint;

  const result = Sprites.makeNode({
    name: 'Result', sprite: 'panel', parent: ui,
    width: viewW, height: viewH, color: COL.dim,
  });
  const card = Sprites.makeNode({
    name: 'Card', sprite: 'panel', parent: result, width: 460, height: 330, color: COL.chip,
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

  // 摇杆视觉（MoveInput 按下时才显示）
  const joyBase = Sprites.makeNode({
    name: 'JoyBase', sprite: 'joy-base', parent: ui, width: 160, height: 160,
  });
  const joyKnob = Sprites.makeNode({
    name: 'JoyKnob', sprite: 'joy-knob', parent: ui, width: 88, height: 88,
  });
  joyBase.active = joyKnob.active = false;

  return hud;
}

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

// ---------------- 自启动 ----------------
// 脚本模块在首个场景启动前被加载并执行，这里挂监听即可自动搭场景，
// 因此工程里不需要任何手工拼好的场景节点。
director.on(Director.EVENT_AFTER_SCENE_LAUNCH, () => { void build(); });
if (director.getScene()) void build();
