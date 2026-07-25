import { _decorator, Component } from 'cc';
import { TriggerZone } from '../core/TriggerZone';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
import { Hero } from './Hero';
const { ccclass, property, requireComponent } = _decorator;

/**
 * 投递区（收集台）。主角进入即自动、持续卸货计分，直到卸空。
 * deliverRate 越大，卸货越快、数字蹦得越猛。
 */
@ccclass('DeliveryZone')
@requireComponent(TriggerZone)
export class DeliveryZone extends Component {
  @property({ tooltip: '每秒投递速度' })
  deliverRate = 160;

  @property({ tooltip: '投递即通关（否则靠目标分/限时结束）' })
  finishOnDeliver = false;

  private _zone!: TriggerZone;
  private _total = 0;

  onLoad() {
    this._zone = this.getComponent(TriggerZone)!;
    this._zone.oncePerTarget = false;
    EventBus.on(GameEvents.LEVEL_RESET, this.onReset, this);
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
      this._total += delivered;
      EventBus.emit(GameEvents.DELIVERED, delivered, this._total);
      if (this.finishOnDeliver) EventBus.emit(GameEvents.LEVEL_FINISHED);
    }
  }

  private onReset() { this._total = 0; }
}
