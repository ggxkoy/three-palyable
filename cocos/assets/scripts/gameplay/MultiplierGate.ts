import { _decorator, Component, Node } from 'cc';
import { TriggerZone, TriggerFilter } from '../core/TriggerZone';
import { Hero } from './Hero';
const { ccclass, property, requireComponent } = _decorator;

/**
 * 倍率门：主角带货穿过时，把携带量整体乘以 multiplier。
 * 门宽即碰撞盒，多门可串联叠乘。空手穿过无效果（Hero 内部判空）。
 * 每次穿过都生效（oncePerTarget=false），来回刷门也能反复吃倍率。
 */
@ccclass('MultiplierGate')
@requireComponent(TriggerZone)
export class MultiplierGate extends Component {
  @property({ tooltip: '穿门时携带量乘以该倍率' })
  multiplier = 2;

  onLoad() {
    const zone = this.getComponent(TriggerZone)!;
    zone.filter = TriggerFilter.HERO;
    zone.oncePerTarget = false;
    this.node.on(TriggerZone.ENTER, this.onHeroEnter, this);
  }

  onDestroy() {
    this.node.off(TriggerZone.ENTER, this.onHeroEnter, this);
  }

  private onHeroEnter(other: Node) {
    other.getComponent(Hero)?.multiplyCarry(this.multiplier);
  }
}
