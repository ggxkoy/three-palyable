import { _decorator, Component, Node, Vec3 } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
const { ccclass, property } = _decorator;

/**
 * 相机跟随：沿 z 轴平滑跟随目标。
 * LEVEL_RESET 时立即回到初始位置（three.js 原版重开一局时相机会慢慢飘回，
 * 这里直接硬切，避免开局画面倒退）。
 */
@ccclass('CameraFollow')
export class CameraFollow extends Component {
  @property({ type: Node, tooltip: '跟随目标（推土机）' })
  target: Node | null = null;

  @property({ tooltip: '相机 z 相对目标的偏移' })
  offsetZ = 9;

  @property({ tooltip: '跟随平滑系数' })
  followLerp = 2.2;

  private _startPos = new Vec3();

  onLoad() {
    this.node.getPosition(this._startPos);
    EventBus.on(GameEvents.LEVEL_RESET, this.onReset, this);
  }

  onDestroy() {
    EventBus.targetOff(this);
  }

  lateUpdate(dt: number) {
    if (!this.target) return;
    const p = this.node.position;
    const targetZ = this.target.position.z + this.offsetZ;
    const z = p.z + (targetZ - p.z) * Math.min(1, dt * this.followLerp);
    this.node.setPosition(p.x, p.y, z);
  }

  private onReset() {
    this.node.setPosition(this._startPos);
  }
}
