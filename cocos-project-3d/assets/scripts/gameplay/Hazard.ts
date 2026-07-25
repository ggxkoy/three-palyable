import { _decorator, Component, Node } from 'cc';
import { TriggerZone } from '../core/TriggerZone';
import { Hero } from './Hero';
const { ccclass, property, requireComponent } = _decorator;

/**
 * 危险区（岩浆）：主角带货踩进去会掉货，形成"要绕开"的走位决策。
 * lossRatio=1 全掉，0.5 掉一半。空手踩无损失。
 */
@ccclass('Hazard')
@requireComponent(TriggerZone)
export class Hazard extends Component {
  @property({ tooltip: '踩入损失的携带比例，1 = 全掉' })
  lossRatio = 1;

  onLoad() {
    const zone = this.getComponent(TriggerZone)!;
    zone.oncePerTarget = false;
    this.node.on(TriggerZone.ENTER, this.onHeroEnter, this);
  }

  onDestroy() {
    this.node.off(TriggerZone.ENTER, this.onHeroEnter, this);
  }

  private onHeroEnter(other: Node) {
    const hero = other.getComponent(Hero);
    if (!hero || hero.carrying <= 0) return;
    if (this.lossRatio >= 1) hero.dropAll();
    else hero.takeCarry(hero.carrying * this.lossRatio);
  }
}
