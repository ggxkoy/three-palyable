import { _decorator, Component, Node } from 'cc';
import { TriggerZone, TriggerFilter } from '../core/TriggerZone';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
import { Gem } from './Gem';
const { ccclass, property, requireComponent } = _decorator;

/**
 * 收集区 Prefab：金色圆盘模型 + 圆柱形 isTrigger 碰撞体。
 * 按真实碰撞判定（three.js 原版只判 z 坐标一条线，推出圈外也计分）。
 */
@ccclass('CollectZone')
@requireComponent(TriggerZone)
export class CollectZone extends Component {
  @property({ tooltip: '收集时是否播放吸入动画后再销毁（false 则立即销毁）' })
  absorbAnimation = true;

  @property({ tooltip: '吸入动画时长（秒）' })
  absorbDuration = 0.25;

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
    EventBus.emit(GameEvents.GEM_COLLECTED, other, gem.value);
    if (this.absorbAnimation) {
      this.scheduleOnce(() => other.destroy(), this.absorbDuration);
    } else {
      other.destroy();
    }
  }
}
