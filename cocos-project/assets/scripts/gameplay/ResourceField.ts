import { _decorator, Component, Node, Enum, math } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
import { Sprites } from '../core/Sprites';
import { TriggerZone, ZoneShape } from '../core/TriggerZone';
import { ResourceNode } from './ResourceNode';
const { ccclass, property } = _decorator;

export enum FieldShape {
  RECT = 0,
  CIRCLE = 1,
}
Enum(FieldShape);

/**
 * 资源点撒布器：把大量 ResourceNode 铺满场地 —— 直接解决"资源点太少"。
 * 调 nodeCount 就能让场面从稀疏变密集。每个点用代码组装
 * （TriggerZone + ResourceNode + sprite 子节点），不需要手工做 Prefab。
 */
@ccclass('ResourceField')
export class ResourceField extends Component {
  @property({ tooltip: '撒布数量（资源点个数）' })
  nodeCount = 30;

  @property({ type: FieldShape })
  shape: FieldShape = FieldShape.RECT;

  @property({ tooltip: '横向半宽' })
  halfWidth = 265;

  @property({ tooltip: '纵向半高' })
  halfHeight = 380;

  @property({ tooltip: '每个点的资源量下限' })
  amountMin = 26;

  @property({ tooltip: '每个点的资源量上限' })
  amountMax = 58;

  @property({ tooltip: '拾取范围半径' })
  pickupRadius = 95;

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
    for (const [x, y] of this.layout()) this._nodes.push(this.buildNode(x, y));
  }

  /**
   * 抖动网格布点：保证撒满 nodeCount 个且分布均匀，同时看着够随机。
   * 早先用"随机取点 + 最小间距重试"，在密集配置下会撒不满
   * （要 30 个只落 19 个），nodeCount 形同虚设，这里改掉。
   */
  private layout(): [number, number][] {
    const n = Math.max(0, Math.floor(this.nodeCount));
    if (n === 0) return [];
    const pts: [number, number][] = [];

    if (this.shape === FieldShape.CIRCLE) {
      // 向日葵螺旋：点数精确、疏密均匀
      const golden = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < n; i++) {
        const r = Math.sqrt((i + 0.5) / n);
        const a = i * golden;
        const jx = math.randomRange(-1, 1) * this.jitter * 0.4 / Math.sqrt(n);
        const jy = math.randomRange(-1, 1) * this.jitter * 0.4 / Math.sqrt(n);
        pts.push([(Math.cos(a) * r + jx) * this.halfWidth,
                  (Math.sin(a) * r + jy) * this.halfHeight]);
      }
      return pts;
    }

    const aspect = this.halfWidth / Math.max(1, this.halfHeight);
    const cols = Math.max(1, Math.round(Math.sqrt(n * aspect)));
    const rows = Math.max(1, Math.ceil(n / cols));
    const cellW = (this.halfWidth * 2) / cols;
    const cellH = (this.halfHeight * 2) / rows;

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
      const cx = -this.halfWidth + cellW * (c + 0.5);
      const cy = -this.halfHeight + cellH * (r + 0.5);
      pts.push([
        cx + math.randomRange(-1, 1) * this.jitter * cellW * 0.5,
        cy + math.randomRange(-1, 1) * this.jitter * cellH * 0.5,
      ]);
    }
    return pts;
  }

  /** 组装一个资源点：容器 + TriggerZone + ResourceNode + 视觉子节点 */
  private buildNode(x: number, y: number): Node {
    const root = Sprites.makeNode({ name: 'ResourceNode', parent: this.node, x, y });

    const visual = Sprites.makeNode({
      name: 'Pile', sprite: 'resource-pile', parent: root,
      width: 96, height: 96,
    });
    visual.angle = math.randomRange(-12, 12);

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
}
