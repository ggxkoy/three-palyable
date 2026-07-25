import { _decorator, Component, Node, Enum, EventHandler, Vec3 } from 'cc';
import { EventBus } from './EventBus';
const { ccclass, property, executionOrder } = _decorator;

export enum ZoneShape {
  /** 圆柱：按 XZ 平面距离判定，忽略高度 */
  CIRCLE = 0,
  /** 长方体：按 XZ 平面的半宽/半长判定 */
  BOX = 1,
}
Enum(ZoneShape);

/**
 * 可被触发区检测的目标标记（挂在主角身上）。
 * 不用物理系统 —— 这是一个贴地行走的游戏，判定都发生在 XZ 平面上，
 * 圆/矩形距离判定比挂一整套 PhysX 更轻、更好调，也省掉碰撞分组配置。
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
 * 资源点、投递区、倍率门、危险区全部由它 + 各自的几何体表现拼装。
 *
 * 两类用法：
 *  - 离散事件（门 / 危险区）：监听 TriggerZone.ENTER，或配 eventName / onEnterHandlers。
 *  - 持续检测（资源点 / 投递区）：读 `overlapping` 集合，在自己的 update 里按帧结算，
 *    "靠近即自动拾取"就靠这个。
 */
@ccclass('TriggerZone')
@executionOrder(-100) // 必须早于 ResourceNode / DeliveryZone 等读取 overlapping 的组件
export class TriggerZone extends Component {
  @property({ type: ZoneShape, tooltip: '判定形状（都在 XZ 平面上）' })
  shape: ZoneShape = ZoneShape.CIRCLE;

  @property({ tooltip: '圆柱判定半径（世界单位）' })
  radius = 2;

  @property({ tooltip: '长方体判定半宽（X）' })
  halfX = 3;

  @property({ tooltip: '长方体判定半长（Z）' })
  halfZ = 1;

  @property({ tooltip: '离散事件时：同一对象只触发一次（持续检测请设 false）' })
  oncePerTarget = false;

  @property({ tooltip: '进入时向 EventBus 广播的事件名，留空则不广播' })
  eventName = '';

  @property({ type: [EventHandler], tooltip: '编辑器直连回调，参数为触发方节点' })
  onEnterHandlers: EventHandler[] = [];

  static readonly ENTER = 'trigger-enter';
  static readonly EXIT = 'trigger-exit';

  /** 当前仍在区域内的节点，供持续检测模块按帧读取 */
  readonly overlapping = new Set<Node>();

  private _triggeredOnce = new Set<Node>();
  private _selfPos = new Vec3();
  private _otherPos = new Vec3();

  update() {
    this.node.getWorldPosition(this._selfPos);

    for (const node of Array.from(this.overlapping)) {
      if (!node.isValid || !this.contains(node)) {
        this.overlapping.delete(node);
        this.node.emit(TriggerZone.EXIT, node, this);
      }
    }
    for (const actor of TriggerActor.all) {
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
    const dz = this._otherPos.z - this._selfPos.z;
    if (this.shape === ZoneShape.CIRCLE) {
      return dx * dx + dz * dz <= this.radius * this.radius;
    }
    return Math.abs(dx) <= this.halfX && Math.abs(dz) <= this.halfZ;
  }
}
