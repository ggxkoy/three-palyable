import { _decorator, Component, Node, math } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
const { ccclass, property } = _decorator;

/**
 * 2D 相机跟随：不动相机，改为整体平移 World 节点（UI 相机下更省事）。
 * 主角在屏幕上保持在 screenAnchorY 高度，世界随之滚动。
 * LEVEL_RESET 时硬切回位，避免开局镜头飘移。
 */
@ccclass('CameraFollow')
export class CameraFollow extends Component {
  @property({ type: Node, tooltip: '跟随目标（主角）' })
  target: Node | null = null;

  @property({ tooltip: '主角在屏幕上的锚定高度（相对画布中心的像素）' })
  screenAnchorY = -180;

  @property({ tooltip: '是否也跟随横向' })
  followX = false;

  @property({ tooltip: '跟随平滑系数' })
  followLerp = 7;

  @property({ tooltip: 'World 可滚动的 y 上下限（防止露出边界）' })
  minWorldY = -1400;
  @property()
  maxWorldY = 700;

  onLoad() {
    EventBus.on(GameEvents.LEVEL_RESET, this.onReset, this);
  }
  onDestroy() { EventBus.targetOff(this); }

  start() { this.snap(); }

  lateUpdate(dt: number) {
    if (!this.target) return;
    const p = this.node.position;
    const goal = this.goalPos();
    const k = Math.min(1, dt * this.followLerp);
    this.node.setPosition(p.x + (goal[0] - p.x) * k, p.y + (goal[1] - p.y) * k);
  }

  private goalPos(): [number, number] {
    const t = this.target!.position;
    const y = math.clamp(this.screenAnchorY - t.y, this.minWorldY, this.maxWorldY);
    const x = this.followX ? -t.x * 0.35 : this.node.position.x;
    return [x, y];
  }

  private snap() {
    if (!this.target) return;
    const [x, y] = this.goalPos();
    this.node.setPosition(x, y);
  }

  private onReset() {
    // 主角位置在同一帧被重置，延后一帧再吸附
    this.scheduleOnce(() => this.snap(), 0);
  }
}
