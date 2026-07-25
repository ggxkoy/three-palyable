import { _decorator, Component, Input, input, EventTouch, Vec2, Node, view } from 'cc';
import { EventBus } from './EventBus';
import { GameEvents } from './GameEvents';
const { ccclass, property } = _decorator;

/**
 * 移动输入（浮动摇杆）—— 玩家唯一的操作入口。
 * 按下处即摇杆原点，拖动方向即主角前进方向，松手即停。
 * 只输出方向，不认识主角；换成点击寻路只需替换本组件。
 * 已处理 TOUCH_CANCEL（系统手势打断不会卡住方向）。
 *
 * joyBase / joyKnob 为可选的摇杆视觉节点，由 Bootstrap 传入。
 */
@ccclass('MoveInput')
export class MoveInput extends Component {
  @property({ tooltip: '达到最大速度所需的拖拽半径（屏幕像素）' })
  maxRadius = 110;

  @property({ tooltip: '死区半径（屏幕像素）' })
  deadZone = 10;

  @property({ type: Node, tooltip: '摇杆底盘视觉节点（可选）' })
  joyBase: Node | null = null;

  @property({ type: Node, tooltip: '摇杆手柄视觉节点（可选）' })
  joyKnob: Node | null = null;

  private _origin = new Vec2();
  private _active = false;
  private _started = false;

  onEnable() {
    input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    EventBus.on(GameEvents.LEVEL_RESET, this.onReset, this);
    this.showJoystick(false);
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
    this.placeJoystick(this._origin.x, this._origin.y, 0, 0);
    this.showJoystick(true);
    if (!this._started) {
      this._started = true;
      EventBus.emit(GameEvents.INPUT_START);
    }
  }

  private onTouchMove(e: EventTouch) {
    if (!this._active) return;
    const p = e.getUILocation(new Vec2());
    const dx = p.x - this._origin.x;
    const dy = p.y - this._origin.y;
    const len = Math.hypot(dx, dy);
    if (len < this.deadZone) {
      this.placeJoystick(this._origin.x, this._origin.y, 0, 0);
      EventBus.emit(GameEvents.MOVE_STOP);
      return;
    }
    const clamped = Math.min(len, this.maxRadius);
    const nx = dx / len, ny = dy / len;
    this.placeJoystick(this._origin.x, this._origin.y, nx * clamped, ny * clamped);
    const power = clamped / this.maxRadius;
    EventBus.emit(GameEvents.MOVE_DIR, nx * power, ny * power);
  }

  private onTouchEnd() {
    this._active = false;
    this.showJoystick(false);
    EventBus.emit(GameEvents.MOVE_STOP);
  }

  private onReset() {
    this._active = false;
    this._started = false;
    this.showJoystick(false);
    EventBus.emit(GameEvents.MOVE_STOP);
  }

  /** UI 坐标 → 摇杆父节点局部坐标 */
  private placeJoystick(ox: number, oy: number, kx: number, ky: number) {
    if (!this.joyBase) return;
    const size = view.getVisibleSize();
    const lx = ox - size.width / 2;
    const ly = oy - size.height / 2;
    this.joyBase.setPosition(lx, ly);
    if (this.joyKnob) this.joyKnob.setPosition(lx + kx, ly + ky);
  }

  private showJoystick(visible: boolean) {
    if (this.joyBase) this.joyBase.active = visible;
    if (this.joyKnob) this.joyKnob.active = visible;
  }
}
