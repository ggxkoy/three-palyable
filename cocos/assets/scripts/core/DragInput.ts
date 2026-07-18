import { _decorator, Component, Input, input, EventTouch } from 'cc';
import { EventBus } from './EventBus';
import { GameEvents } from './GameEvents';
const { ccclass, property } = _decorator;

/**
 * 输入模块：只负责把触摸/拖拽转成事件，不认识推土机。
 * 以后要换摇杆或键盘，只替换这个 Prefab，Dozer 不用改。
 * 已处理 TOUCH_CANCEL（three.js 原版漏了 pointercancel，会导致瞬移）。
 */
@ccclass('DragInput')
export class DragInput extends Component {
  @property({ tooltip: '拖拽灵敏度：屏幕像素 → 世界单位' })
  sensitivity = 0.018;

  private _dragging = false;
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

  private onTouchStart() {
    this._dragging = true;
    if (!this._started) {
      this._started = true;
      EventBus.emit(GameEvents.INPUT_START);
    }
  }

  private onTouchMove(event: EventTouch) {
    if (!this._dragging) return;
    EventBus.emit(GameEvents.DRAG_DELTA, event.getDeltaX() * this.sensitivity);
  }

  private onTouchEnd() {
    this._dragging = false;
  }

  private onReset() {
    this._dragging = false;
    this._started = false;
  }
}
