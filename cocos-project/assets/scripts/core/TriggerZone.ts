import { _decorator, Component, Node, Enum, EventHandler, Vec3 } from 'cc';
import { EventBus } from './EventBus';
const { ccclass, property, executionOrder } = _decorator;

export enum ZoneShape {
  CIRCLE = 0,
  RECT = 1,
}
Enum(ZoneShape);

/**
 * 可被触发区检测的目标标记（挂在主角身上）。
 * 不用物理系统 —— 2D playable 里靠距离/矩形判定更轻、更好调，
 * 也省掉了整套 PhysX 配置。
 */
@ccclass('TriggerActor')
export class TriggerActor extends Component {
  static readonly all: TriggerActor[] = [];

  onEnable() {
    if (TriggerActor.all.indexOf(this) < 0) TriggerActor.all.push(this);
  }

  onDisable() {
    const i = TriggerActor.all.indexOf(this);
    if (i >= 0) TriggerActor.all.splice(i, 1);
  }
}

/**
 * 通用触发区 —— 本项目的"蓝图积木"基座。
 * 资源点、投递区、倍率门、危险区、终点线全部由它 + 各自表现层拼装。
 *
 * 两类用法：
 *  - 离散事件（门 / 终点）：监听 TriggerZone.ENTER，或配 eventName / onEnterHandlers。
 *  - 持续检测（资源点 / 投递区）：读 `overlapping` 集合，在自己的 update 里按帧结算，
 *    "靠近即自动拾取"就靠这个。
 */
@ccclass('TriggerZone')
@executionOrder(-100) // 必须早于 ResourceNode / DeliveryZone 等读取 overlapping 的组件
export class TriggerZone extends Component {
  @property({ type: ZoneShape, tooltip: '判定形状' })
  shape: ZoneShape = ZoneShape.CIRCLE;

  @property({ tooltip: '圆形判定半径（世界像素）' })
  radius = 90;

  @property({ tooltip: '矩形判定半宽' })
  halfWidth = 160;

  @property({ tooltip: '矩形判定半高' })
  halfHeight = 60;

  @property({ tooltip: '离散事件时：同一对象只触发一次（持续检测请设 false）' })
  oncePerTarget = false;

  @property({ tooltip: '进入时向 EventBus 广播的事件名，留空则不广播' })
  eventName = '';

  @property({ type: [EventHandler], tooltip: '编辑器直连回调，参数为触发方节点' })
  onEnterHandlers: EventHandler[] = [];

  /** 同节点其它组件监听用的本地事件 */
  static readonly ENTER = 'trigger-enter';
  static readonly EXIT = 'trigger-exit';

  /** 当前仍在区域内的节点，供持续检测模块按帧读取 */
  readonly overlapping = new Set<Node>();

  private _triggeredOnce = new Set<Node>();
  private _selfPos = new Vec3();
  private _otherPos = new Vec3();

  /** 每帧在 update 里刷新重叠状态。优先级早于依赖它的玩法组件。 */
  update() {
    this.node.getWorldPosition(this._selfPos);
    const actors = TriggerActor.all;

    // 先检出已离开的
    for (const node of Array.from(this.overlapping)) {
      if (!node.isValid || !this.contains(node)) {
        this.overlapping.delete(node);
        this.node.emit(TriggerZone.EXIT, node, this);
      }
    }
    // 再检入新进来的
    for (const actor of actors) {
      const node = actor.node;
      if (!node.isValid || this.overlapping.has(node)) continue;
      if (!this.contains(node)) continue;
      this.overlapping.add(node);
      if (this.oncePerTarget) {
        if (this._triggeredOnce.has(node)) continue;
        this._triggeredOnce.add(node);
      }
      this.node.emit(TriggerZone.ENTER, node, this);
      if (this.eventName) EventBus.emit(this.eventName, node, this);
      for (const handler of this.onEnterHandlers) handler.emit([node]);
    }
  }

  /** 重开一局时由 GameFlow 调用 */
  resetTriggered() {
    this._triggeredOnce.clear();
    this.overlapping.clear();
  }

  private contains(node: Node): boolean {
    node.getWorldPosition(this._otherPos);
    const dx = this._otherPos.x - this._selfPos.x;
    const dy = this._otherPos.y - this._selfPos.y;
    if (this.shape === ZoneShape.CIRCLE) {
      return dx * dx + dy * dy <= this.radius * this.radius;
    }
    return Math.abs(dx) <= this.halfWidth && Math.abs(dy) <= this.halfHeight;
  }
}
