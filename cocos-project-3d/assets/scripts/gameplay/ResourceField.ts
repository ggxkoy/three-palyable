import { _decorator, Component, Prefab, instantiate, Node, Enum, math } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
import { ResourceNode } from './ResourceNode';
const { ccclass, property } = _decorator;

export enum FieldShape {
  CIRCLE = 0,
  RECT = 1,
}
Enum(FieldShape);

/**
 * 资源点撒布器。把很多 ResourceNode 铺满场地 —— 直接解决"资源点太少"。
 * 调 nodeCount 就能让场面从稀疏变密集；每个点的量随机，主角一路捡过去堆量飞涨。
 */
@ccclass('ResourceField')
export class ResourceField extends Component {
  @property({ type: Prefab, tooltip: '资源点 Prefab（带 ResourceNode + TriggerZone）' })
  nodePrefab: Prefab | null = null;

  @property({ tooltip: '撒布数量（资源点个数）' })
  nodeCount = 24;

  @property({ type: FieldShape })
  shape: FieldShape = FieldShape.RECT;

  @property({ tooltip: '横向半宽 / 圆形半径' })
  radiusX = 5.5;

  @property({ tooltip: '纵向半长 / 圆形纵向拉伸' })
  radiusZ = 9;

  @property({ tooltip: '每个资源点的量下限' })
  amountMin = 25;
  @property({ tooltip: '每个资源点的量上限' })
  amountMax = 55;

  @property({ tooltip: '相邻资源点的最小间距，避免重叠' })
  minSpacing = 1.6;

  private _nodes: Node[] = [];

  onLoad() {
    EventBus.on(GameEvents.LEVEL_RESET, this.respawn, this);
  }
  start() { this.respawn(); }
  onDestroy() { EventBus.targetOff(this); }

  respawn() {
    for (const n of this._nodes) if (n.isValid) n.destroy();
    this._nodes = [];
    if (!this.nodePrefab) return;
    const placed: [number, number][] = [];
    let guard = this.nodeCount * 20;
    while (this._nodes.length < this.nodeCount && guard-- > 0) {
      const [x, z] = this.randomPoint();
      if (placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < this.minSpacing)) continue;
      placed.push([x, z]);
      const node = instantiate(this.nodePrefab);
      node.setPosition(x, 0, z);
      const rn = node.getComponent(ResourceNode);
      if (rn) rn.amount = Math.round(math.randomRange(this.amountMin, this.amountMax));
      this.node.addChild(node);
      this._nodes.push(node);
    }
  }

  private randomPoint(): [number, number] {
    if (this.shape === FieldShape.CIRCLE) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random());
      return [Math.cos(a) * r * this.radiusX, Math.sin(a) * r * this.radiusZ];
    }
    return [math.randomRange(-this.radiusX, this.radiusX), math.randomRange(-this.radiusZ, this.radiusZ)];
  }
}
