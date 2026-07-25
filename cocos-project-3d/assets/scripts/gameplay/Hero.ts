import { _decorator, Component, Vec3, math } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
const { ccclass, property } = _decorator;

/**
 * 主角（推土机快递员）。玩家只操纵它在 XZ 平面走位，其余全自动：
 *  - 靠近资源点 → ResourceNode 每帧调 addCarry() 装货
 *  - 进投递区   → DeliveryZone 每帧调 takeCarry() 卸货计分
 *  - 穿倍率门   → MultiplierGate 调 multiplyCarry() 整堆翻倍
 *  - 踩危险区   → Hazard 调 dropAll() 掉光
 * 本组件只管：按方向移动 + 转向 + 携带量账本 + 广播变化。
 *
 * 模型朝 +Z 搭建，因此 yaw = atan2(dirX, dirZ) 即可对准移动方向。
 */
@ccclass('Hero')
export class Hero extends Component {
  @property({ tooltip: '移动速度（世界单位/秒）' })
  moveSpeed = 8;

  @property({ tooltip: '最大携带量，装满后停止拾取' })
  capacity = 240;

  @property({
    tooltip: '倍率门可把携带撑到 capacity × 该系数。'
      + '给 ×2 留出真实收益，同时为反复进出刷门设一个硬顶',
  })
  overflowFactor = 2;

  @property({ tooltip: '转身平滑系数，0 = 不转身' })
  turnLerp = 12;

  @property({ tooltip: '活动区半宽 X' })
  boundX = 4.8;

  @property({ tooltip: '活动区 Z 下限（靠近投递区一侧）' })
  minZ = -22.5;

  @property({ tooltip: '活动区 Z 上限（出生点一侧）' })
  maxZ = 11;

  /** 当前携带量（浮点，显示时取整） */
  carrying = 0;

  private _dir = new Vec3();
  private _start = new Vec3();
  private _yaw = 180;   // 出生时朝向 -Z（投递区方向）
  private _frozen = false;

  get freeSpace(): number {
    return Math.max(0, this.capacity - this.carrying);
  }

  onLoad() {
    this.node.getPosition(this._start);
    this.node.setRotationFromEuler(0, this._yaw, 0);
    EventBus.on(GameEvents.MOVE_DIR, this.onDir, this);
    EventBus.on(GameEvents.MOVE_STOP, this.onStop, this);
    EventBus.on(GameEvents.LEVEL_FINISHED, this.onFinished, this);
    EventBus.on(GameEvents.LEVEL_RESET, this.onReset, this);
  }

  onDestroy() { EventBus.targetOff(this); }

  update(dt: number) {
    if (this._frozen) return;
    const dx = this._dir.x, dz = this._dir.z;
    if (dx === 0 && dz === 0) return;
    const p = this.node.position;
    this.node.setPosition(
      math.clamp(p.x + dx * this.moveSpeed * dt, -this.boundX, this.boundX),
      p.y,
      math.clamp(p.z + dz * this.moveSpeed * dt, this.minZ, this.maxZ),
    );

    if (this.turnLerp > 0) {
      const goal = Math.atan2(dx, dz) * 180 / Math.PI;
      this._yaw += this.shortestAngle(this._yaw, goal) * Math.min(1, dt * this.turnLerp);
      this.node.setRotationFromEuler(0, this._yaw, 0);
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

  /** 摇杆给的是屏幕方向，这里映射到世界 XZ：上 = -Z（朝投递区） */
  private onDir(x: number, y: number) { this._dir.set(x, 0, -y); }
  private onStop() { this._dir.set(0, 0, 0); }
  private onFinished() { this._frozen = true; this._dir.set(0, 0, 0); }

  private onReset() {
    this._frozen = false;
    this._dir.set(0, 0, 0);
    this.carrying = 0;
    this._yaw = 180;
    this.node.setPosition(this._start);
    this.node.setRotationFromEuler(0, this._yaw, 0);
    this.emitCarry();
  }

  private shortestAngle(from: number, to: number): number {
    let d = (to - from) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }
}
