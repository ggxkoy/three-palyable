import { _decorator, Component, Collider, ITriggerEvent, Node, Enum, EventHandler } from 'cc';
import { EventBus } from './EventBus';
const { ccclass, property, requireComponent } = _decorator;

/** 触发对象过滤。按节点上挂的标记组件判断。 */
export enum TriggerFilter {
  ANY = 0,
  HERO = 1,
  RESOURCE = 2,
}
Enum(TriggerFilter);

/**
 * 通用触发区 —— 本项目的"蓝图积木"基座。
 * 资源点、投递区、倍率门、危险区、终点线全部由它 + 各自表现层拼装。
 *
 * 两类用法：
 *  - 离散事件（门 / 终点）：监听 onEnter，配 eventName 或 onEnterHandlers。
 *  - 持续检测（资源点 / 投递区 / 危险区）：读 `overlapping` 集合，
 *    在自己的 update 里按帧结算（"靠近即自动"就靠这个）。
 *
 * 节点要求：同节点挂一个 Collider 并勾选 isTrigger。
 */
@ccclass('TriggerZone')
@requireComponent(Collider)
export class TriggerZone extends Component {
  @property({ type: TriggerFilter, tooltip: '哪类对象可以触发' })
  filter: TriggerFilter = TriggerFilter.ANY;

  @property({ tooltip: '离散事件时：同一对象是否只触发一次（持续检测请设 false）' })
  oncePerTarget = false;

  @property({ tooltip: '进入时向 EventBus 广播的事件名，留空则不广播' })
  eventName = '';

  @property({ type: [EventHandler], tooltip: '编辑器直连回调，参数为触发方节点' })
  onEnterHandlers: EventHandler[] = [];

  /** 同节点其它组件监听用的本地事件名 */
  static readonly ENTER = 'trigger-enter';
  static readonly EXIT = 'trigger-exit';

  /** 当前仍在区域内的对象集合，供持续检测的模块按帧读取 */
  readonly overlapping = new Set<Node>();

  private _triggeredOnce = new Set<Node>();

  onEnable() {
    const col = this.getComponent(Collider)!;
    col.on('onTriggerEnter', this.onEnter, this);
    col.on('onTriggerExit', this.onExit, this);
  }

  onDisable() {
    const col = this.getComponent(Collider)!;
    col.off('onTriggerEnter', this.onEnter, this);
    col.off('onTriggerExit', this.onExit, this);
    this.overlapping.clear();
  }

  /** 重开一局时由 GameFlow 调用 */
  resetTriggered() {
    this._triggeredOnce.clear();
    this.overlapping.clear();
  }

  private onEnter(event: ITriggerEvent) {
    const other = event.otherCollider.node;
    if (!this.matches(other)) return;
    this.overlapping.add(other);
    if (this.oncePerTarget) {
      if (this._triggeredOnce.has(other)) return;
      this._triggeredOnce.add(other);
    }
    this.node.emit(TriggerZone.ENTER, other, this);
    if (this.eventName) EventBus.emit(this.eventName, other, this);
    for (const handler of this.onEnterHandlers) handler.emit([other]);
  }

  private onExit(event: ITriggerEvent) {
    const other = event.otherCollider.node;
    if (!this.overlapping.delete(other)) return;
    this.node.emit(TriggerZone.EXIT, other, this);
  }

  private matches(node: Node): boolean {
    switch (this.filter) {
      case TriggerFilter.HERO: return !!node.getComponent('Hero');
      case TriggerFilter.RESOURCE: return !!node.getComponent('ResourceNode');
      default: return true;
    }
  }
}
