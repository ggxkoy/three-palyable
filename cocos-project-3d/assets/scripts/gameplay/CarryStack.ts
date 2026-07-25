import { _decorator, Component, Node, Vec3, tween, math } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
import { Prims } from '../core/Prims';
const { ccclass, property } = _decorator;

const CRYSTAL = { color: 0x3ce0ff, roughness: 0.24, metallic: 0.35, emissive: 0x06456b };

/**
 * 携带堆表现：随携带量在铲刀前方堆起真正的 3D 水晶堆 —— 最直观的"爽"反馈。
 * 挂在主角车头前的锚点上，只订阅 CARRY_CHANGED，用对象池增减，
 * 不参与任何玩法逻辑。
 */
@ccclass('CarryStack')
export class CarryStack extends Component {
  @property({ tooltip: '最多显示多少颗水晶' })
  maxVisible = 42;

  @property({ tooltip: '每排几颗（横向）' })
  perRow = 5;

  @property({ tooltip: '每层几排（纵向）' })
  rowsPerLayer = 3;

  @property({ tooltip: '水晶间距' })
  spacing = 0.34;

  @property({ tooltip: '每多少携带量对应一颗水晶' })
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
      const i = this._pool.length;
      const item = Prims.gem('Carry', this.node, 0.16, this.slot(i), CRYSTAL, 4);
      item.setRotationFromEuler(math.randomRange(0, 360), math.randomRange(0, 360), 0);
      this._pool.push(item);
    }
    for (let i = 0; i < this._pool.length; i++) {
      const on = i < want;
      const item = this._pool[i];
      if (on && !item.active) {
        // 新增的水晶弹一下，堆量增长有手感
        item.active = true;
        item.setScale(0.06, 0.06, 0.06);
        tween(item).to(0.18, { scale: new Vec3(0.32, 0.32, 0.32) }, { easing: 'backOut' }).start();
      } else if (!on && item.active) {
        item.active = false;
      }
    }
    this._shown = want;
  }

  /** 从铲刀往前一排排、一层层地堆开 */
  private slot(i: number): [number, number, number] {
    const perLayer = this.perRow * this.rowsPerLayer;
    const layer = Math.floor(i / perLayer);
    const within = i % perLayer;
    const row = Math.floor(within / this.perRow);
    const col = within % this.perRow;
    return [
      (col - (this.perRow - 1) / 2) * this.spacing,
      layer * this.spacing * 0.8,
      row * this.spacing * 0.85,
    ];
  }
}
