import { _decorator, CCFloat, Component, Vec3, math } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
const { ccclass, property } = _decorator;

/**
 * 主角（快递员）。玩家只操纵它走位，其余全自动：
 *  - 靠近资源点 → ResourceNode 每帧调用 addCarry() 往身上装货
 *  - 到投递区   → DeliveryZone 每帧调用 takeCarry() 卸货计分
 *  - 穿过倍率门 → MultiplierGate 调用 multiplyCarry() 翻倍
 * 本组件自己只管：按方向移动 + 记录携带量 + 广播携带变化。
 *
 * 节点要求：Kinematic RigidBody + 一个 Collider（非 trigger），
 * 好让资源点/投递区的 isTrigger 检测到它。同节点还需挂一个 `Hero` 标记
 * （即本组件类名，TriggerZone 用 getComponent('Hero') 识别）。
 */
@ccclass('Hero')
export class Hero extends Component {
  @property({ tooltip: '移动速度（世界单位/秒）' })
  moveSpeed = 6;

  @property({ tooltip: '最大携带量，装满后停止拾取' })
  capacity = 200;

  @property({ tooltip: '朝移动方向转身的插值系数，0 = 不转身' })
  turnLerp = 12;

  @property({ tooltip: '活动区半宽 X' })
  boundX = 6;

  @property({ tooltip: '活动区 Z 最小值' })
  minZ = -26;
  @property({ type: CCFloat, tooltip: '活动区 Z 最大值' })
  maxZ = 12;

  /** 当前携带量（浮点，便于平滑拾取；显示时取整） */
  carrying = 0;

  private _dir = new Vec3();
  private _start = new Vec3();
  private _moving = false;

  get freeSpace(): number {
    return Math.max(0, this.capacity - this.carrying);
  }

  onLoad() {
    this.node.getPosition(this._start);
    EventBus.on(GameEvents.MOVE_DIR, this.onDir, this);
    EventBus.on(GameEvents.MOVE_STOP, this.onStop, this);
    EventBus.on(GameEvents.INPUT_START, this.onInputStart, this);
    EventBus.on(GameEvents.LEVEL_RESET, this.onReset, this);
  }

  onDestroy() {
    EventBus.targetOff(this);
  }

  update(dt: number) {
    if (!this._moving || (this._dir.x === 0 && this._dir.z === 0)) return;
    const p = this.node.position;
    const x = math.clamp(p.x + this._dir.x * this.moveSpeed * dt, -this.boundX, this.boundX);
    const z = math.clamp(p.z + this._dir.z * this.moveSpeed * dt, this.minZ, this.maxZ);
    this.node.setPosition(x, p.y, z);
    if (this.turnLerp > 0) {
      const yaw = Math.atan2(this._dir.x, this._dir.z) * 180 / Math.PI;
      const cur = this.node.eulerAngles;
      const ny = cur.y + this.shortestAngle(cur.y, yaw) * Math.min(1, dt * this.turnLerp);
      this.node.setRotationFromEuler(0, ny, 0);
    }
  }

  /** 资源点调用：请求装入 amount，返回实际接受量（受剩余容量限制） */
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

  /** 倍率门调用 */
  multiplyCarry(factor: number) {
    if (this.carrying <= 0) return;
    this.carrying = Math.min(this.carrying * factor, this.capacity);
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

  private onDir(x: number, z: number) {
    this._moving = true;
    this._dir.set(x, 0, z);
  }
  private onStop() { this._dir.set(0, 0, 0); }
  private onInputStart() { this._moving = true; }

  private onReset() {
    this._moving = false;
    this._dir.set(0, 0, 0);
    this.carrying = 0;
    this.node.setPosition(this._start);
    this.node.setRotationFromEuler(0, 0, 0);
    this.emitCarry();
  }

  private shortestAngle(from: number, to: number): number {
    let d = (to - from) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }
}
