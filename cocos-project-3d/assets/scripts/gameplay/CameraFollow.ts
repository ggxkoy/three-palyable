import { _decorator, Component, Node, Vec3 } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
const { ccclass, property } = _decorator;

/**
 * 相机跟随：主角在场地里自由走位，相机按固定偏移平滑跟随其 X/Z。
 * LEVEL_RESET 时硬切回初始相对位，避免开局镜头飘移。
 */
@ccclass('CameraFollow')
export class CameraFollow extends Component {
  @property({ type: Node, tooltip: '跟随目标（主角）' })
  target: Node | null = null;

  @property({ tooltip: '跟随平滑系数' })
  followLerp = 6;

  @property({ tooltip: '是否跟随 X 轴（false 则相机只沿 Z 跟随）' })
  followX = true;

  private _offset = new Vec3();
  private _inited = false;

  onLoad() {
    EventBus.on(GameEvents.LEVEL_RESET, this.onReset, this);
  }
  onDestroy() { EventBus.targetOff(this); }

  start() {
    if (this.target) {
      Vec3.subtract(this._offset, this.node.position, this.target.position);
      this._inited = true;
    }
  }

  lateUpdate(dt: number) {
    if (!this.target || !this._inited) return;
    const p = this.node.position;
    const t = this.target.position;
    const goalX = this.followX ? t.x + this._offset.x : p.x;
    const goalZ = t.z + this._offset.z;
    const k = Math.min(1, dt * this.followLerp);
    this.node.setPosition(p.x + (goalX - p.x) * k, p.y, p.z + (goalZ - p.z) * k);
  }

  private onReset() {
    if (this.target && this._inited) {
      const t = this.target.position;
      this.node.setPosition(t.x + this._offset.x, this.node.position.y, t.z + this._offset.z);
    }
  }
}
