import { _decorator, Component, Node } from 'cc';
import { TriggerZone, TriggerFilter } from '../core/TriggerZone';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
import { Gem } from './Gem';
const { ccclass, property, requireComponent } = _decorator;

/**
 * 危险区 Prefab（岩浆等）：发光面片 + isTrigger 碰撞盒。
 * 宝石掉入即销毁，让"走桥"成为真实的风险决策
 * （three.js 原版的岩浆纯装饰，没有任何效果）。
 */
@ccclass('Hazard')
@requireComponent(TriggerZone)
export class Hazard extends Component {
  @property({ tooltip: '销毁宝石时扣除的分数，0 表示只销毁不扣分' })
  scorePenalty = 0;

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
    gem.consumed = true;
    EventBus.emit(GameEvents.GEM_DESTROYED, other, this.scorePenalty);
    other.destroy();
  }
}
