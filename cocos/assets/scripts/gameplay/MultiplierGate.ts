import { _decorator, Component, Node } from 'cc';
import { TriggerZone, TriggerFilter } from '../core/TriggerZone';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
import { Gem } from './Gem';
const { ccclass, property, requireComponent } = _decorator;

/**
 * 倍率门 Prefab：门柱模型 + TriggerZone（isTrigger 碰撞盒，宽度即门宽）。
 * 只对真正从门内穿过的宝石生效。策划在属性面板改 multiplier
 * 就能摆出 ×2 / ×3 门，同一关卡可放多个，倍率对单颗宝石叠乘。
 */
@ccclass('MultiplierGate')
@requireComponent(TriggerZone)
export class MultiplierGate extends Component {
  @property({ tooltip: '穿过此门的宝石分值乘以该倍率' })
  multiplier = 2;

  onLoad() {
    const zone = this.getComponent(TriggerZone)!;
    zone.filter = TriggerFilter.GEM;
    zone.oncePerTarget = true;
    this.node.on(TriggerZone.ENTER, this.onGemEnter, this);
  }

  onDestroy() {
    this.node.off(TriggerZone.ENTER, this.onGemEnter, this);
  }

  private onGemEnter(other: Node) {
    const gem = other.getComponent(Gem);
    if (!gem || gem.consumed) return;
    gem.multiplier *= this.multiplier;
    EventBus.emit(GameEvents.GATE_PASSED, other, gem.multiplier);
  }
}
