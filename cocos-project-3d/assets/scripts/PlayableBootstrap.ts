import {
  _decorator,
  BoxCollider,
  Camera,
  Canvas,
  Color,
  Component,
  DirectionalLight,
  director,
  Director,
  Label,
  Layers,
  Material,
  Mesh,
  MeshRenderer,
  Node,
  PhysicsSystem,
  primitives,
  profiler,
  RigidBody,
  UITransform,
  utils,
  Vec3,
} from 'cc';
import { EDITOR } from 'cc/env';
import { EventBus } from './core/EventBus';
import { GameEvents } from './core/GameEvents';
import { MoveInput } from './core/MoveInput';
import { CameraFollow } from './gameplay/CameraFollow';
import { BridgeCollector } from './reference/BridgeCollector';
import { DozerController } from './reference/DozerController';
import { MultiplierBrushGate } from './reference/MultiplierBrushGate';
import { PushToken } from './reference/PushToken';
import { ReferenceGoal } from './reference/ReferenceGoal';
import { ReferenceHUD } from './reference/ReferenceHUD';

const { ccclass } = _decorator;
const UI_LAYER = Layers.Enum.UI_2D;

/**
 * 参考 source.mp4 重做的可玩原型：
 * 黄色推土机直接推动大量蓝色宝石，宝石穿过 ×10 刷门变成金币，
 * 再把金币推入收集槽逐段铺桥，完成后进入下一区域。
 */
@ccclass('PlayableBootstrap')
export class PlayableBootstrap extends Component {
  private _materials: Material[] = [];
  private _tokenMesh: Mesh | null = null;
  private _gemMaterial: Material | null = null;
  private _goldMaterial: Material | null = null;
  private _dozer: DozerController | null = null;
  private _bridge: BridgeCollector | null = null;
  private _autoElapsed = 0;
  private _autoRunning = false;
  private _autoFinished = false;

  start() {
    if (this.node.getChildByName('ReferenceWorld')) return;
    profiler.hideStats();
    PhysicsSystem.instance.enable = true;
    PhysicsSystem.instance.gravity = new Vec3(0, -12, 0);

    this._tokenMesh = utils.MeshUtils.createMesh(primitives.box());
    this._gemMaterial = this.makeMaterial(new Color(33, 205, 255));
    this._goldMaterial = this.makeMaterial(new Color(255, 184, 22));

    const world = new Node('ReferenceWorld');
    this.node.addChild(world);
    this.createEnvironment(world);
    const dozerNode = this.createDozer(world);
    this.createResourceSource(world);
    this.createTokenField(world);
    this.createMultiplierGate(world);
    this.createBridgeArea(world);
    this.createUpgradeArea(world);
    this.createCameraAndLight(world, dozerNode);
    this.createUI();
    this.node.addComponent(MoveInput);

    if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('autotest')) {
      this._autoRunning = true;
      EventBus.emit(GameEvents.INPUT_START);
      console.log('[REFERENCE_TEST] START');
    }
  }

  update(dt: number) {
    if (!this._autoRunning || this._autoFinished || !this._dozer || !this._bridge) return;
    this._autoElapsed += dt;

    if (!this._bridge.complete) {
      const weave = this._autoElapsed > 3.2 && this._autoElapsed < 4.1 ? 0.35 : 0;
      EventBus.emit(GameEvents.MOVE_DIR, weave, -1);
    } else if (this._dozer.node.position.z > -19.5) {
      EventBus.emit(GameEvents.MOVE_DIR, 0, -1);
    } else {
      this.finishAutoTest(true);
    }

    if (this._autoElapsed > 20) this.finishAutoTest(false);
  }

  onDestroy() {
    for (const material of this._materials) material.destroy();
    this._materials.length = 0;
  }

  private finishAutoTest(passed: boolean) {
    if (!this._dozer || !this._bridge) return;
    this._autoFinished = true;
    EventBus.emit(GameEvents.MOVE_STOP);
    console.log(
      `[REFERENCE_TEST] ${passed ? 'PASS' : 'FAIL'} `
      + `bridge=${this._bridge.total}/${this._bridge.target} `
      + `position=${this._dozer.node.position.x.toFixed(2)},${this._dozer.node.position.z.toFixed(2)}`,
    );
  }

  private createEnvironment(parent: Node) {
    const sand = new Color(151, 93, 61);
    const rock = new Color(105, 57, 49);
    const lava = new Color(246, 62, 25);

    this.createStaticBox('StartGround', parent, new Vec3(0, -0.3, 2), new Vec3(13, 0.6, 20), sand);
    this.createStaticBox('FarGround', parent, new Vec3(0, -0.3, -18), new Vec3(13, 0.6, 12), sand);
    this.createBox('Lava', parent, new Vec3(0, -0.25, -10), new Vec3(12.8, 0.28, 4), lava);

    this.createStaticBox('LeftCliffA', parent, new Vec3(-7, 1.2, 2), new Vec3(1.2, 3, 20), rock);
    this.createStaticBox('RightCliffA', parent, new Vec3(7, 1.2, 2), new Vec3(1.2, 3, 20), rock);
    this.createStaticBox('LeftCliffB', parent, new Vec3(-7, 1.2, -18), new Vec3(1.2, 3, 12), rock);
    this.createStaticBox('RightCliffB', parent, new Vec3(7, 1.2, -18), new Vec3(1.2, 3, 12), rock);

    for (let i = 0; i < 18; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const z = 10 - Math.floor(i / 2) * 2.4;
      this.createBox(`Rock${i}`, parent, new Vec3(side * (5.9 + Math.random() * 0.45), 0.45, z), new Vec3(0.7, 0.9, 0.8), new Color(126, 69, 54));
    }
  }

  private createDozer(parent: Node): Node {
    const dozer = new Node('Bulldozer');
    dozer.active = false;
    parent.addChild(dozer);
    dozer.setPosition(0, 0.62, 8.8);

    const bodyVisual = dozer.addComponent(MeshRenderer);
    bodyVisual.mesh = utils.MeshUtils.createMesh(primitives.box({ width: 1.55, height: 0.72, length: 1.8 }));
    bodyVisual.material = this.makeMaterial(new Color(255, 181, 24));

    const body = dozer.addComponent(RigidBody);
    body.type = RigidBody.Type.KINEMATIC;
    body.useGravity = false;
    const collider = dozer.addComponent(BoxCollider);
    collider.size = new Vec3(2.9, 0.9, 2.55);

    this.createBox('Cabin', dozer, new Vec3(0, 0.72, 0.2), new Vec3(0.95, 0.72, 0.95), new Color(55, 77, 88));
    this.createBox('Blade', dozer, new Vec3(0, -0.02, -1.18), new Vec3(2.9, 0.62, 0.34), new Color(255, 203, 46));
    this.createBox('BladeLip', dozer, new Vec3(0, -0.28, -1.34), new Vec3(3.05, 0.16, 0.4), new Color(235, 139, 16));
    this.createBox('LeftTrack', dozer, new Vec3(-0.88, -0.28, 0.12), new Vec3(0.38, 0.35, 1.85), new Color(43, 45, 47));
    this.createBox('RightTrack', dozer, new Vec3(0.88, -0.28, 0.12), new Vec3(0.38, 0.35, 1.85), new Color(43, 45, 47));

    this._dozer = dozer.addComponent(DozerController);
    dozer.active = true;
    return dozer;
  }

  private createResourceSource(parent: Node) {
    const purple = new Color(179, 54, 220);
    this.createBox('SourceBase', parent, new Vec3(0, 0.45, 10.8), new Vec3(4.8, 0.65, 1.5), purple);
    this.createBox('PipeLeft', parent, new Vec3(-1.35, 1.1, 9.9), new Vec3(0.85, 1.65, 0.85), new Color(230, 65, 194));
    this.createBox('PipeCenter', parent, new Vec3(0, 1.1, 9.9), new Vec3(0.85, 1.65, 0.85), new Color(230, 65, 194));
    this.createBox('PipeRight', parent, new Vec3(1.35, 1.1, 9.9), new Vec3(0.85, 1.65, 0.85), new Color(230, 65, 194));
  }

  private createTokenField(parent: Node) {
    for (let i = 0; i < 135; i++) {
      const row = Math.floor(i / 15);
      const col = i % 15;
      const x = (col - 7) * 0.42 + (Math.random() - 0.5) * 0.16;
      const z = 6.4 - row * 0.54 + (Math.random() - 0.5) * 0.18;
      this.createToken(parent, x, z);
    }
  }

  private createToken(parent: Node, x: number, z: number) {
    if (!this._tokenMesh || !this._gemMaterial || !this._goldMaterial) return;
    const token = new Node('BlueGem');
    token.active = false;
    parent.addChild(token);
    token.setPosition(x, 0.24 + Math.random() * 0.08, z);
    token.setScale(0.28, 0.28, 0.28);
    token.setRotationFromEuler(Math.random() * 35, Math.random() * 180, Math.random() * 35);

    const renderer = token.addComponent(MeshRenderer);
    renderer.mesh = this._tokenMesh;
    renderer.material = this._gemMaterial;
    const body = token.addComponent(RigidBody);
    body.type = RigidBody.Type.DYNAMIC;
    body.mass = 0.12;
    body.linearDamping = 0.42;
    body.angularDamping = 0.72;
    const collider = token.addComponent(BoxCollider);
    collider.size = new Vec3(0.92, 0.92, 0.92);
    const tokenLogic = token.addComponent(PushToken);
    tokenLogic.setup(renderer, this._goldMaterial);
    token.active = true;
  }

  private createMultiplierGate(parent: Node) {
    const gate = new Node('MultiplierX10');
    gate.active = false;
    parent.addChild(gate);
    gate.setPosition(0, 0.7, -2.2);
    const collider = gate.addComponent(BoxCollider);
    collider.isTrigger = true;
    collider.size = new Vec3(11.2, 1.5, 0.8);
    gate.addComponent(MultiplierBrushGate);

    const orange = new Color(255, 83, 41);
    const purple = new Color(130, 42, 189);
    this.createBox('GateLeft', gate, new Vec3(-5.45, 0.2, 0), new Vec3(0.5, 2.1, 0.65), purple);
    this.createBox('GateRight', gate, new Vec3(5.45, 0.2, 0), new Vec3(0.5, 2.1, 0.65), purple);
    for (let i = 0; i < 15; i++) {
      this.createBox(`Brush${i}`, gate, new Vec3(-4.9 + i * 0.7, 0, 0), new Vec3(0.18, 1.45, 0.52), orange);
    }
    gate.active = true;
  }

  private createBridgeArea(parent: Node) {
    if (!this._dozer) return;
    const planks: Node[] = [];
    for (let i = 0; i < 10; i++) {
      const plank = this.createBox(
        `BridgePlank${i + 1}`,
        parent,
        new Vec3(0, 0.02, -8.25 - i * 0.39),
        new Vec3(5.2, 0.16, 0.32),
        new Color(225, 164, 77),
      );
      plank.active = false;
      planks.push(plank);
    }

    const collector = new Node('BridgeDeposit');
    collector.active = false;
    parent.addChild(collector);
    collector.setPosition(0, 0.45, -7.45);
    const collider = collector.addComponent(BoxCollider);
    collider.isTrigger = true;
    collider.size = new Vec3(11.2, 1.2, 0.8);
    const bridge = collector.addComponent(BridgeCollector);
    bridge.target = 250;
    bridge.setup(planks, this._dozer);
    this._bridge = bridge;
    this.createBox('DepositRail', collector, new Vec3(0, -0.32, 0), new Vec3(11.2, 0.22, 0.75), new Color(37, 42, 47));
    collector.active = true;
  }

  private createUpgradeArea(parent: Node) {
    this.createBox('UpgradePad', parent, new Vec3(3.9, 0.06, -15.2), new Vec3(3.1, 0.18, 3.2), new Color(145, 63, 207));
    this.createBox('UpgradeGlow', parent, new Vec3(3.9, 0.18, -15.2), new Vec3(2.55, 0.12, 2.55), new Color(56, 239, 195));
    this.createBox('NextResourcePile', parent, new Vec3(-2.2, 0.45, -17.4), new Vec3(3.8, 0.8, 3.8), new Color(238, 54, 216));

    const goal = new Node('NextAreaGoal');
    goal.active = false;
    parent.addChild(goal);
    goal.setPosition(0, 0.7, -20.5);
    const collider = goal.addComponent(BoxCollider);
    collider.isTrigger = true;
    collider.size = new Vec3(11, 1.5, 1.2);
    goal.addComponent(ReferenceGoal);
    goal.active = true;
  }

  private createCameraAndLight(parent: Node, dozer: Node) {
    const cameraNode = new Node('MainCamera');
    parent.addChild(cameraNode);
    cameraNode.setPosition(10.5, 17.5, 20.5);
    cameraNode.lookAt(new Vec3(0, 0, 1.5));
    const camera = cameraNode.addComponent(Camera);
    camera.fov = 46;
    camera.near = 0.3;
    camera.far = 120;
    camera.priority = -10;
    camera.visibility = (0xffffffff & ~UI_LAYER) >>> 0;
    camera.clearColor = new Color(41, 32, 48);
    const follow = cameraNode.addComponent(CameraFollow);
    follow.target = dozer;
    follow.followLerp = 4.8;

    const lightNode = new Node('Sun');
    parent.addChild(lightNode);
    lightNode.setRotationFromEuler(-58, 30, 0);
    const light = lightNode.addComponent(DirectionalLight);
    light.illuminance = 68000;
  }

  private createUI() {
    const canvasNode = new Node('Canvas');
    canvasNode.active = false;
    canvasNode.layer = UI_LAYER;
    this.node.addChild(canvasNode);
    canvasNode.addComponent(UITransform);

    const cameraNode = new Node('UICamera');
    cameraNode.layer = UI_LAYER;
    canvasNode.addChild(cameraNode);
    const uiCamera = cameraNode.addComponent(Camera);
    uiCamera.projection = Camera.ProjectionType.ORTHO;
    uiCamera.priority = 10;
    uiCamera.visibility = UI_LAYER;
    uiCamera.clearFlags = 6;
    const canvas = canvasNode.addComponent(Canvas);
    canvas.cameraComponent = uiCamera;
    canvas.alignCanvasWithScreen = true;

    const coins = this.createLabel('Coins', canvasNode, new Vec3(0, 274), '0', 38, new Color(255, 208, 48));
    const bridge = this.createLabel('BridgeProgress', canvasNode, new Vec3(0, 228), '铺桥 0/250', 24, new Color(255, 255, 255));
    const multiplier = this.createLabel('Multiplier', canvasNode, new Vec3(0, 110), '×10', 64, new Color(255, 94, 56));
    const hint = this.createLabel('Hint', canvasNode, new Vec3(0, -258), '拖动或使用 WASD 驾驶推土机', 24, new Color(255, 255, 255));
    const banner = this.createLabel('Banner', canvasNode, new Vec3(0, 12), '', 48, new Color(255, 224, 72));
    multiplier.node.active = false;
    banner.node.active = false;

    const hud = canvasNode.addComponent(ReferenceHUD);
    hud.setup(coins, bridge, multiplier, hint.node, banner);
    canvasNode.active = true;
  }

  private createLabel(name: string, parent: Node, position: Vec3, text: string, fontSize: number, color: Color): Label {
    const node = new Node(name);
    node.layer = UI_LAYER;
    parent.addChild(node);
    node.setPosition(position);
    const transform = node.addComponent(UITransform);
    transform.setContentSize(680, fontSize + 18);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 8;
    label.color = color;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.SHRINK;
    label.isBold = true;
    return label;
  }

  private createStaticBox(name: string, parent: Node, position: Vec3, size: Vec3, color: Color): Node {
    const node = this.createBox(name, parent, position, size, color);
    const collider = node.addComponent(BoxCollider);
    collider.size = size;
    return node;
  }

  private createBox(name: string, parent: Node, position: Vec3, size: Vec3, color: Color): Node {
    const node = new Node(name);
    parent.addChild(node);
    node.setPosition(position);
    const renderer = node.addComponent(MeshRenderer);
    renderer.mesh = utils.MeshUtils.createMesh(primitives.box({ width: size.x, height: size.y, length: size.z }));
    renderer.material = this.makeMaterial(color);
    return node;
  }

  private makeMaterial(color: Color): Material {
    const material = new Material();
    material.initialize({ effectName: 'builtin-unlit' });
    material.setProperty('mainColor', color);
    this._materials.push(material);
    return material;
  }
}

function installRuntimeBootstrap() {
  const scene = director.getScene();
  if (!scene || scene.getChildByName('PlayableBootstrapHost')) return;
  const host = new Node('PlayableBootstrapHost');
  scene.addChild(host);
  host.addComponent(PlayableBootstrap);
}

if (!EDITOR) {
  director.on(Director.EVENT_AFTER_SCENE_LAUNCH, installRuntimeBootstrap);
  if (director.getScene()) installRuntimeBootstrap();
}
