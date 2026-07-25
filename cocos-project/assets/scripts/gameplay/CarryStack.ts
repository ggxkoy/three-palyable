import { _decorator, Component, Node, Vec3, tween } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
import { Sprites } from '../core/Sprites';
const { ccclass, property } = _decorator;

/**
 * 携带堆表现：随携带量在主角车头前方堆起水晶 —— 最直观的"爽"反馈。
 * 挂在主角的一个子锚点上（位于铲刀前方），只订阅 CARRY_CHANGED，
 * 用对象池增减 sprite，不参与任何玩法逻辑。
 */
@ccclass('CarryStack')
export class CarryStack extends Component {
  @property({ tooltip: '最多显示多少个水晶' })
  maxVisible = 34;

  @property({ tooltip: '每排几个' })
  perRow = 5;

  @property({ tooltip: '水晶间距' })
  spacing = 26;

  @property({ tooltip: '每多少携带量对应一个水晶' })
  unitsPerItem = 6;

  private _pool: Node[] = [];
  private _shown = 0;

  onLoad() {
    EventBus.on(GameEvents.CARRY_CHANGED, this.onCarry, this);
    EventBus.on(GameEvents.LEVEL_RESET, this.onResetStack, this);
  }

  onDestroy() { EventBus.targetOff(this); }

  private onResetStack() { this.onCarry(0); }

  private onCarry(carrying: number) {
    const want = Math.min(this.maxVisible, Math.floor(carrying / this.unitsPerItem));
    if (want === this._shown) return;

    while (this._pool.length < want) {
      const item = Sprites.makeNode({
        name: 'Carry', sprite: 'carry-item', parent: this.node,
        width: 30, height: 30,
      });
      item.setPosition(this.slot(this._pool.length));
      this._pool.push(item);
    }
    for (let i = 0; i < this._pool.length; i++) {
      const on = i < want;
      const item = this._pool[i];
      if (on && !item.active) {
        // 新增的水晶弹一下，堆量增长有手感
        item.active = true;
        item.setScale(0.2, 0.2, 1);
        tween(item).to(0.18, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
      } else if (!on && item.active) {
        item.active = false;
      }
    }
    this._shown = want;
  }

  /** 从车头往前一排排铺开，像被铲刀推着走的一堆货 */
  private slot(i: number): Vec3 {
    const row = Math.floor(i / this.perRow);
    const col = i % this.perRow;
    const x = (col - (this.perRow - 1) / 2) * this.spacing;
    const y = row * this.spacing * 0.82;
    return new Vec3(x, y, 0);
  }
}
