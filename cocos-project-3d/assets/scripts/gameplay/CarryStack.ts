import { _decorator, Component, Node, Prefab, instantiate, Vec3 } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
const { ccclass, property } = _decorator;

/**
 * 携带堆表现：随携带量在主角身上堆叠方块，量越多堆越高 —— 最直观的"爽"反馈。
 * 只订阅 CARRY_CHANGED，用对象池增减方块，不参与任何玩法逻辑。
 *
 * 挂在主角的一个子节点（堆叠锚点）上，itemPrefab 指向单个货物模型。
 */
@ccclass('CarryStack')
export class CarryStack extends Component {
  @property({ type: Prefab, tooltip: '单个货物的表现 Prefab' })
  itemPrefab: Prefab | null = null;

  @property({ tooltip: '最多显示多少个方块（携带量超出后只增高不增数）' })
  maxVisible = 40;

  @property({ tooltip: '每层几个' })
  perRow = 4;

  @property({ tooltip: '方块间距' })
  spacing = 0.32;

  @property({ tooltip: '每多少携带量对应一个可见方块' })
  unitsPerItem = 5;

  private _pool: Node[] = [];

  onLoad() {
    EventBus.on(GameEvents.CARRY_CHANGED, this.onCarry, this);
    EventBus.on(GameEvents.LEVEL_RESET, () => this.onCarry(0), this);
  }

  onDestroy() { EventBus.targetOff(this); }

  private onCarry(carrying: number) {
    if (!this.itemPrefab) return;
    const want = Math.min(this.maxVisible, Math.floor(carrying / this.unitsPerItem));
    while (this._pool.length < want) {
      const item = instantiate(this.itemPrefab);
      this.node.addChild(item);
      this._pool.push(item);
    }
    for (let i = 0; i < this._pool.length; i++) {
      const active = i < want;
      this._pool[i].active = active;
      if (active) this._pool[i].setPosition(this.slot(i));
    }
  }

  private slot(i: number): Vec3 {
    const layer = Math.floor(i / this.perRow);
    const col = i % this.perRow;
    const x = (col - (this.perRow - 1) / 2) * this.spacing;
    const y = layer * this.spacing;
    return new Vec3(x, y, 0);
  }
}
