import { _decorator, Component, EventKeyboard, Input, input, EventTouch, KeyCode, Vec2 } from 'cc';
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
  private _keys = new Set<KeyCode>();

  onEnable() {
    input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    EventBus.on(GameEvents.LEVEL_RESET, this.onReset, this);
  }

  onDisable() {
    input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
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

  private onKeyDown(e: EventKeyboard) {
    if (!this.isMoveKey(e.keyCode)) return;
    this._keys.add(e.keyCode);
    if (!this._started) {
      this._started = true;
      EventBus.emit(GameEvents.INPUT_START);
    }
    this.emitKeyDirection();
  }

  private onKeyUp(e: EventKeyboard) {
    if (!this.isMoveKey(e.keyCode)) return;
    this._keys.delete(e.keyCode);
    this.emitKeyDirection();
  }

  private emitKeyDirection() {
    const left = this._keys.has(KeyCode.KEY_A) || this._keys.has(KeyCode.ARROW_LEFT);
    const right = this._keys.has(KeyCode.KEY_D) || this._keys.has(KeyCode.ARROW_RIGHT);
    const forward = this._keys.has(KeyCode.KEY_W) || this._keys.has(KeyCode.ARROW_UP);
    const back = this._keys.has(KeyCode.KEY_S) || this._keys.has(KeyCode.ARROW_DOWN);
    const x = Number(right) - Number(left);
    const z = Number(back) - Number(forward);
    if (x === 0 && z === 0) {
      EventBus.emit(GameEvents.MOVE_STOP);
      return;
    }
    const length = Math.hypot(x, z);
    EventBus.emit(GameEvents.MOVE_DIR, x / length, z / length);
  }

  private isMoveKey(key: KeyCode) {
    return key === KeyCode.KEY_W || key === KeyCode.KEY_A || key === KeyCode.KEY_S || key === KeyCode.KEY_D
      || key === KeyCode.ARROW_UP || key === KeyCode.ARROW_LEFT || key === KeyCode.ARROW_DOWN || key === KeyCode.ARROW_RIGHT;
  }

  private onReset() {
    this._active = false;
    this._started = false;
    this._keys.clear();
    EventBus.emit(GameEvents.MOVE_STOP);
  }
}
