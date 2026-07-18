import { _decorator, Component, Vec3, math, RigidBody } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
const { ccclass, property } = _decorator;

/**
 * 推土机 Prefab：车身/铲刀模型 + Kinematic 刚体 + 铲刀碰撞体。
 * 铲刀对宝石的推挤交给物理引擎（宝石是 Dynamic 刚体），不再手写伪物理。
 * 只监听输入事件，不认识 DragInput —— 换输入方式无需改这里。
 */
@ccclass('Dozer')
export class Dozer extends Component {
  @property({ tooltip: '前进速度（世界单位/秒）' })
  forwardSpeed = 4.25;

  @property({ tooltip: '横向跟随的平滑系数，越大越跟手' })
  steerLerp = 8;

  @property({ tooltip: '横向活动半宽（世界单位）' })
  clampX = 5.4;

  private _targetX = 0;
  private _moving = false;
  private _startPos = new Vec3();

  onLoad() {
    this.node.getPosition(this._startPos);
    EventBus.on(GameEvents.INPUT_START, this.onStart, this);
    EventBus.on(GameEvents.DRAG_DELTA, this.onDrag, this);
    EventBus.on(GameEvents.LEVEL_FINISHED, this.onFinish, this);
    EventBus.on(GameEvents.LEVEL_RESET, this.onReset, this);
  }

  onDestroy() {
    EventBus.targetOff(this);
  }

  update(dt: number) {
    if (!this._moving) return;
    const p = this.node.position;
    const x = p.x + (this._targetX - p.x) * Math.min(1, dt * this.steerLerp);
    // Kinematic 刚体用 setPosition 驱动，物理引擎会把宝石推开
    this.node.setPosition(x, p.y, p.z - this.forwardSpeed * dt);
  }

  private onStart() { this._moving = true; }
  private onFinish() { this._moving = false; }

  private onDrag(dx: number) {
    this._targetX = math.clamp(this._targetX + dx, -this.clampX, this.clampX);
  }

  private onReset() {
    this._moving = false;
    this._targetX = 0;
    this.node.setPosition(this._startPos);
  }
}
