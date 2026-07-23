import { _decorator, Component, Input, input, EventTouch, Vec2 } from 'cc';
import { EventBus } from './EventBus';
import { GameEvents } from './GameEvents';
const { ccclass, property } = _decorator;

/**
 * 移动输入（浮动摇杆）——玩家唯一的操作入口。
 * 按下处为摇杆原点，拖动方向即主角前进方向；松手即停。
 * 只输出方向事件，不认识主角，换成固定摇杆/点击寻路只替换本组件。
 * 已处理 TOUCH_CANCEL（系统手势打断不会卡住方向）。
 */
@ccclass('MoveInput')
export class MoveInput extends Component {
  @property({ tooltip: '达到最大速度所需的拖拽半径（屏幕像素）' })
  maxRadius = 90;

  @property({ tooltip: '死区半径，小于此值视为不动（屏幕像素）' })
  deadZone = 8;

  private _origin = new Vec2();
  private _active = false;
  private _started = false;

  onEnable() {
    input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    EventBus.on(GameEvents.LEVEL_RESET, this.onReset, this);
  }

  onDisable() {
    input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    EventBus.targetOff(this);
  }

  private onTouchStart(e: EventTouch) {
    this._active = true;
    e.getUILocation(this._origin);
    if (!this._started) {
      this._started = true;
      EventBus.emit(GameEvents.INPUT_START);
    }
  }

  private onTouchMove(e: EventTouch) {
    if (!this._active) return;
    const p = e.getUILocation(new Vec2());
    let dx = p.x - this._origin.x;
    let dy = p.y - this._origin.y;
    const len = Math.hypot(dx, dy);
    if (len < this.deadZone) { EventBus.emit(GameEvents.MOVE_STOP); return; }
    const scale = Math.min(len, this.maxRadius) / this.maxRadius / len;
    // 屏幕上：右=+x，上=前进(-z)。角度映射可按相机朝向在此微调。
    EventBus.emit(GameEvents.MOVE_DIR, dx * scale, -dy * scale);
  }

  private onTouchEnd() {
    this._active = false;
    EventBus.emit(GameEvents.MOVE_STOP);
  }

  private onReset() {
    this._active = false;
    this._started = false;
    EventBus.emit(GameEvents.MOVE_STOP);
  }
}
