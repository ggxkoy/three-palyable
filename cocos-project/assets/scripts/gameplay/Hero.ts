import { _decorator, Component, Vec3, math } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
const { ccclass, property } = _decorator;

/**
 * 主角（推土机快递员）。玩家只操纵它走位，其余全自动：
 *  - 靠近资源点 → ResourceNode 每帧调 addCarry() 装货
 *  - 进投递区   → DeliveryZone 每帧调 takeCarry() 卸货计分
 *  - 穿倍率门   → MultiplierGate 调 multiplyCarry() 整堆翻倍
 *  - 踩危险区   → Hazard 调 dropAll() 掉光
 * 本组件只管：按方向移动 + 携带量账本 + 广播变化。
 *
 * sprite 默认朝上(+y)，angle=0 即朝上。
 */
@ccclass('Hero')
export class Hero extends Component {
  @property({ tooltip: '移动速度（像素/秒）' })
  moveSpeed = 620;

  @property({ tooltip: '最大携带量，装满后停止拾取' })
  capacity = 240;

  @property({
    tooltip: '倍率门可把携带撑到 capacity × 该系数。'
      + '给 ×2 留出真实收益，同时为反复进出刷门设一个硬顶',
  })
  overflowFactor = 2;

  @property({ tooltip: '转身平滑系数，0 = 不转身' })
  turnLerp = 14;

  @property({ tooltip: '活动区半宽' })
  boundX = 300;

  @property({ tooltip: '活动区下边界' })
  minY = -620;

  @property({ tooltip: '活动区上边界' })
  maxY = 1320;

  /** 当前携带量（浮点，显示时取整） */
  carrying = 0;

  private _dir = new Vec3();
  private _start = new Vec3();
  private _angle = 0;
  /** 通关后冻结，防止结算面板弹出后还能继续开车 */
  private _frozen = false;

  get freeSpace(): number {
    return Math.max(0, this.capacity - this.carrying);
  }

  onLoad() {
    this.node.getPosition(this._start);
    EventBus.on(GameEvents.MOVE_DIR, this.onDir, this);
    EventBus.on(GameEvents.MOVE_STOP, this.onStop, this);
    EventBus.on(GameEvents.LEVEL_FINISHED, this.onFinished, this);
    EventBus.on(GameEvents.LEVEL_RESET, this.onReset, this);
  }

  onDestroy() { EventBus.targetOff(this); }

  update(dt: number) {
    if (this._frozen) return;
    const dx = this._dir.x, dy = this._dir.y;
    if (dx === 0 && dy === 0) return;
    const p = this.node.position;
    const x = math.clamp(p.x + dx * this.moveSpeed * dt, -this.boundX, this.boundX);
    const y = math.clamp(p.y + dy * this.moveSpeed * dt, this.minY, this.maxY);
    this.node.setPosition(x, y);

    if (this.turnLerp > 0) {
      // sprite 朝上为 0°，Cocos angle 逆时针为正
      const goal = Math.atan2(dy, dx) * 180 / Math.PI - 90;
      this._angle += this.shortestAngle(this._angle, goal) * Math.min(1, dt * this.turnLerp);
      this.node.angle = this._angle;
    }
  }

  /** 资源点调用：请求装入 amount，返回实际接受量 */
  addCarry(amount: number): number {
    const accepted = Math.min(amount, this.freeSpace);
    if (accepted <= 0) return 0;
    this.carrying += accepted;
    this.emitCarry();
    EventBus.emit(GameEvents.RESOURCE_PICKED, accepted, this.carrying);
    return accepted;
  }

  /** 投递区调用：请求卸下 amount，返回实际卸下量 */
  takeCarry(amount: number): number {
    const given = Math.min(amount, this.carrying);
    if (given <= 0) return 0;
    this.carrying -= given;
    this.emitCarry();
    return given;
  }

  /**
   * 倍率门调用。允许超出 capacity（否则满载时穿门毫无收益），
   * 但封顶在 capacity × overflowFactor，避免来回刷门无限翻倍。
   */
  multiplyCarry(factor: number) {
    if (this.carrying <= 0) return;
    const ceiling = this.capacity * this.overflowFactor;
    if (this.carrying >= ceiling) return;
    this.carrying = Math.min(this.carrying * factor, ceiling);
    this.emitCarry();
    EventBus.emit(GameEvents.GATE_PASSED, factor, this.carrying);
  }

  /** 危险区调用：清空携带 */
  dropAll(): number {
    const lost = this.carrying;
    if (lost <= 0) return 0;
    this.carrying = 0;
    this.emitCarry();
    EventBus.emit(GameEvents.CARRY_LOST, lost);
    return lost;
  }

  private emitCarry() {
    EventBus.emit(GameEvents.CARRY_CHANGED, this.carrying, this.capacity);
  }

  private onDir(x: number, y: number) { this._dir.set(x, y, 0); }
  private onStop() { this._dir.set(0, 0, 0); }
  private onFinished() { this._frozen = true; this._dir.set(0, 0, 0); }

  private onReset() {
    this._frozen = false;
    this._dir.set(0, 0, 0);
    this.carrying = 0;
    this._angle = 0;
    this.node.setPosition(this._start);
    this.node.angle = 0;
    this.emitCarry();
  }

  private shortestAngle(from: number, to: number): number {
    let d = (to - from) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }
}
