import { _decorator, Component, Node, Vec3, math } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
const { ccclass, property } = _decorator;

/**
 * 3D 相机跟随：相机保持固定的俯视角与偏移，只跟随主角的位置。
 * 朝向不变，所以是稳定的 3/4 俯视视角（和参考视频一致）。
 * LEVEL_RESET 时硬切回位，避免开局镜头飘移。
 */
@ccclass('CameraFollow')
export class CameraFollow extends Component {
  @property({ type: Node, tooltip: '跟随目标（主角）' })
  target: Node | null = null;

  @property({ tooltip: '相机相对主角的偏移' })
  offset = new Vec3(0, 14, 11);

  @property({ tooltip: '跟随平滑系数' })
  followLerp = 6;

  @property({ tooltip: '横向跟随比例：0 完全不跟 X，1 完全跟随' })
  followXRatio = 0.45;

  @property({ tooltip: 'Z 跟随范围下限（防止越过投递区太多）' })
  minZ = -24;

  @property({ tooltip: 'Z 跟随范围上限' })
  maxZ = 12;

  onLoad() {
    EventBus.on(GameEvents.LEVEL_RESET, this.onReset, this);
  }
  onDestroy() { EventBus.targetOff(this); }

  start() { this.snap(); }

  lateUpdate(dt: number) {
    if (!this.target) return;
    const p = this.node.position;
    const g = this.goal();
    const k = Math.min(1, dt * this.followLerp);
    this.node.setPosition(
      p.x + (g.x - p.x) * k,
      p.y + (g.y - p.y) * k,
      p.z + (g.z - p.z) * k,
    );
  }

  private goal(): Vec3 {
    const t = this.target!.position;
    return new Vec3(
      t.x * this.followXRatio + this.offset.x,
      this.offset.y,
      math.clamp(t.z, this.minZ, this.maxZ) + this.offset.z,
    );
  }

  private snap() {
    if (!this.target) return;
    this.node.setPosition(this.goal());
  }

  private onReset() {
    // 主角位置在同一帧被重置，延后一帧再吸附
    this.scheduleOnce(() => this.snap(), 0);
  }
}
