import { _decorator, Component } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 宝石标记组件：挂在宝石 Prefab 根节点，带刚体 + 碰撞体。
 * 分值 = baseValue × multiplier；multiplier 由途中经过的倍率门逐个叠乘，
 * 这样"哪些宝石过了门"是真实判定（three.js 原版是全局一刀切 ×2）。
 */
@ccclass('Gem')
export class Gem extends Component {
  @property({ tooltip: '基础分值' })
  baseValue = 1;

  /** 运行时倍率，由 MultiplierGate 修改 */
  multiplier = 1;

  /** 防止收集/销毁重复结算 */
  consumed = false;

  get value(): number {
    return this.baseValue * this.multiplier;
  }
}
