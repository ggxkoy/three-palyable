import { _decorator, Component, Collider, ITriggerEvent, Node, Enum, EventHandler } from 'cc';
import { EventBus } from './EventBus';
const { ccclass, property, requireComponent } = _decorator;

/** 触发对象过滤。按节点上挂的标记组件（Gem / Dozer）判断。 */
export enum TriggerFilter {
  ANY = 0,
  GEM = 1,
  DOZER = 2,
}
Enum(TriggerFilter);

/**
 * 通用触发区 —— 本项目的"蓝图积木"基座。
 * 门、收集区、岩浆、终点线全部由它 + 各自的表现层拼装而成，
 * 判定逻辑只写这一份（对比 three.js 原版里 z 坐标写死判定的问题）。
 *
 * 节点要求：同节点挂一个 Collider 并勾选 isTrigger。
 * 两种连线方式（都是编辑器里配，不写代码）：
 *  1. eventName：触发时向全局 EventBus 广播该事件，载荷为 (对方节点, 本组件)。
 *  2. onEnterHandlers：像蓝图连线一样，在属性面板里直接拖目标节点绑回调。
 */
@ccclass('TriggerZone')
@requireComponent(Collider)
export class TriggerZone extends Component {
  @property({ type: TriggerFilter, tooltip: '哪类对象可以触发' })
  filter: TriggerFilter = TriggerFilter.ANY;

  @property({ tooltip: '同一个对象是否只触发一次' })
  oncePerTarget = true;

  @property({ tooltip: '触发时向 EventBus 广播的事件名，留空则不广播' })
  eventName = '';

  @property({ type: [EventHandler], tooltip: '编辑器直连回调，参数为触发方节点' })
  onEnterHandlers: EventHandler[] = [];

  private _triggered = new Set<Node>();

  onEnable() {
    this.getComponent(Collider)!.on('onTriggerEnter', this.onTriggerEnter, this);
  }

  onDisable() {
    this.getComponent(Collider)!.off('onTriggerEnter', this.onTriggerEnter, this);
  }

  /** 重开一局时由 GameFlow 调用，清掉"只触发一次"的记录。 */
  resetTriggered() {
    this._triggered.clear();
  }

  /** 同节点其它组件监听触发的本地事件名（node.on(TriggerZone.ENTER, ...)） */
  static readonly ENTER = 'trigger-enter';

  private onTriggerEnter(event: ITriggerEvent) {
    const other = event.otherCollider.node;
    if (!this.matches(other)) return;
    if (this.oncePerTarget) {
      if (this._triggered.has(other)) return;
      this._triggered.add(other);
    }
    this.node.emit(TriggerZone.ENTER, other, this);
    if (this.eventName) EventBus.emit(this.eventName, other, this);
    for (const handler of this.onEnterHandlers) handler.emit([other]);
  }

  private matches(node: Node): boolean {
    switch (this.filter) {
      case TriggerFilter.GEM: return !!node.getComponent('Gem');
      case TriggerFilter.DOZER: return !!node.getComponent('Dozer');
      default: return true;
    }
  }
}
