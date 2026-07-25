import { _decorator, Component, Node, Enum, math } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
import { Prims } from '../core/Prims';
import { TriggerZone, ZoneShape } from '../core/TriggerZone';
import { ResourceNode } from './ResourceNode';
const { ccclass, property } = _decorator;

export enum FieldShape {
  RECT = 0,
  CIRCLE = 1,
}
Enum(FieldShape);

/** 水晶配色 */
const CRYSTAL = { color: 0x24d8ff, roughness: 0.24, metallic: 0.35, emissive: 0x06456b };

/**
 * 资源点撒布器：把大量 ResourceNode 铺满场地 —— 直接解决"资源点太少"。
 * 调 nodeCount 就能让场面从稀疏变密集。每个点用代码组装
 * （TriggerZone + ResourceNode + 一簇低多边形水晶），不需要任何模型资源。
 */
@ccclass('ResourceField')
export class ResourceField extends Component {
  @property({ tooltip: '撒布数量（资源点个数）' })
  nodeCount = 30;

  @property({ type: FieldShape })
  shape: FieldShape = FieldShape.RECT;

  @property({ tooltip: '横向半宽 X' })
  halfX = 4.2;

  @property({ tooltip: '纵向半长 Z' })
  halfZ = 6.5;

  @property({ tooltip: '每个点的资源量下限' })
  amountMin = 26;

  @property({ tooltip: '每个点的资源量上限' })
  amountMax = 58;

  @property({ tooltip: '拾取范围半径' })
  pickupRadius = 1.8;

  @property({ tooltip: '每秒拾取速度' })
  pickupRate = 70;

  @property({ tooltip: '位置抖动强度 0..1，0 = 规整网格，1 = 完全随机' })
  jitter = 0.62;

  private _nodes: Node[] = [];

  onLoad() {
    EventBus.on(GameEvents.LEVEL_RESET, this.respawn, this);
  }

  start() { this.respawn(); }
  onDestroy() { EventBus.targetOff(this); }

  respawn() {
    if (this._nodes.length > 0) {
      // 已生成过：重开时只需重置各点资源量，省掉重建开销
      for (const n of this._nodes) {
        if (!n.isValid) continue;
        n.getComponent(ResourceNode)?.setup(this.randomAmount());
      }
      return;
    }
    for (const [x, z] of this.layout()) this._nodes.push(this.buildNode(x, z));
  }

  /** 组装一个资源点：容器 + TriggerZone + ResourceNode + 水晶簇 */
  private buildNode(x: number, z: number): Node {
    const root = Prims.make({ name: 'ResourceNode', parent: this.node, pos: [x, 0, z] });

    // 视觉：三颗大小不一的低多边形水晶
    const visual = Prims.make({ name: 'Pile', parent: root });
    visual.setRotationFromEuler(0, math.randomRange(0, 360), 0);
    const gems: [number, number, number, number][] = [
      [0, 0.34, 0, 0.34],
      [-0.3, 0.24, 0.16, 0.24],
      [0.28, 0.22, -0.18, 0.22],
    ];
    for (const [gx, gy, gz, r] of gems) {
      const gem = Prims.gem('Gem', visual, r, [gx, gy, gz], CRYSTAL, 4);
      gem.setRotationFromEuler(math.randomRange(0, 360), math.randomRange(0, 360), 0);
    }

    const zone = root.addComponent(TriggerZone);
    zone.shape = ZoneShape.CIRCLE;
    zone.radius = this.pickupRadius;
    zone.oncePerTarget = false;

    const rn = root.addComponent(ResourceNode);
    rn.pickupRate = this.pickupRate;
    rn.pileVisual = visual;
    rn.setup(this.randomAmount());
    return root;
  }

  private randomAmount(): number {
    return Math.round(math.randomRange(this.amountMin, this.amountMax));
  }

  /**
   * 抖动网格布点：保证撒满 nodeCount 个且分布均匀，同时看着够随机。
   * 早先用"随机取点 + 最小间距重试"，密集配置下会撒不满
   * （要 30 个只落 19 个），nodeCount 形同虚设，这里改掉。
   */
  private layout(): [number, number][] {
    const n = Math.max(0, Math.floor(this.nodeCount));
    if (n === 0) return [];
    const pts: [number, number][] = [];

    if (this.shape === FieldShape.CIRCLE) {
      const golden = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < n; i++) {
        const r = Math.sqrt((i + 0.5) / n);
        const a = i * golden;
        const j = this.jitter * 0.4 / Math.sqrt(n);
        pts.push([
          (Math.cos(a) * r + math.randomRange(-1, 1) * j) * this.halfX,
          (Math.sin(a) * r + math.randomRange(-1, 1) * j) * this.halfZ,
        ]);
      }
      return pts;
    }

    const aspect = this.halfX / Math.max(0.001, this.halfZ);
    const cols = Math.max(1, Math.round(Math.sqrt(n * aspect)));
    const rows = Math.max(1, Math.ceil(n / cols));
    const cellW = (this.halfX * 2) / cols;
    const cellH = (this.halfZ * 2) / rows;

    // 先枚举全部格子再打乱，格子多于点数时空缺不会挤在同一角
    const cells: [number, number][] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) cells.push([c, r]);
    }
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }

    for (const [c, r] of cells.slice(0, n)) {
      pts.push([
        -this.halfX + cellW * (c + 0.5) + math.randomRange(-1, 1) * this.jitter * cellW * 0.5,
        -this.halfZ + cellH * (r + 0.5) + math.randomRange(-1, 1) * this.jitter * cellH * 0.5,
      ]);
    }
    return pts;
  }
}
