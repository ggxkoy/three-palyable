import { _decorator, Component } from 'cc';
import { TriggerZone, TriggerFilter } from '../core/TriggerZone';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
import { Hero } from './Hero';
const { ccclass, property, requireComponent } = _decorator;

/**
 * 投递区（终点收集台）。主角进入即自动、持续卸货计分，直到卸空。
 * deliverRate 越大，卸货越快、数字蹦得越猛。
 *
 * 节点要求：TriggerZone（filter=HERO 的 isTrigger，范围即投递区）。
 */
@ccclass('DeliveryZone')
@requireComponent(TriggerZone)
export class DeliveryZone extends Component {
  @property({ tooltip: '每秒投递速度（单位/秒）' })
  deliverRate = 120;

  @property({ tooltip: '本区计分是否触发通关（配合目标分或纯计分）' })
  finishOnDeliver = false;

  private _zone!: TriggerZone;
  private _score = 0;

  onLoad() {
    this._zone = this.getComponent(TriggerZone)!;
    this._zone.filter = TriggerFilter.HERO;
    this._zone.oncePerTarget = false;
    EventBus.on(GameEvents.LEVEL_RESET, () => (this._score = 0), this);
  }

  onDestroy() { EventBus.targetOff(this); }

  update(dt: number) {
    if (this._zone.overlapping.size === 0) return;
    for (const node of this._zone.overlapping) {
      if (!node.isValid) continue;
      const hero = node.getComponent(Hero);
      if (!hero || hero.carrying <= 0) continue;
      const delivered = hero.takeCarry(this.deliverRate * dt);
      if (delivered <= 0) continue;
      this._score += delivered;
      EventBus.emit(GameEvents.DELIVERED, delivered, this._score);
      if (this.finishOnDeliver) EventBus.emit(GameEvents.LEVEL_FINISHED);
    }
  }
}
