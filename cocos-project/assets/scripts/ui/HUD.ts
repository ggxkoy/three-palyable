import { _decorator, Component, Label, Node, Vec3, tween, UIOpacity } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
const { ccclass, property } = _decorator;

/**
 * HUD：只订阅事件刷新显示，不引用任何玩法模块。
 * 节点引用由 Bootstrap 在运行时注入，未设置的字段自动跳过。
 */
@ccclass('HUD')
export class HUD extends Component {
  @property({ type: Label }) scoreLabel: Label | null = null;
  @property({ type: Label }) carryLabel: Label | null = null;
  @property({ type: Node }) carryBarFill: Node | null = null;
  @property({ type: Label }) popLabel: Label | null = null;
  @property({ type: Node }) hintNode: Node | null = null;
  @property({ type: Node }) resultPanel: Node | null = null;
  @property({ type: Label }) finalScoreLabel: Label | null = null;

  @property({ tooltip: '携带条满宽（像素）' })
  carryBarWidth = 220;

  @property({ tooltip: '结算面板弹出延迟（秒）' })
  resultDelay = 0.5;

  private _score = 0;
  private _shownScore = 0;

  onLoad() {
    EventBus.on(GameEvents.INPUT_START, this.onStart, this);
    EventBus.on(GameEvents.SCORE_CHANGED, this.onScore, this);
    EventBus.on(GameEvents.CARRY_CHANGED, this.onCarry, this);
    EventBus.on(GameEvents.GATE_PASSED, this.onGate, this);
    EventBus.on(GameEvents.CARRY_LOST, this.onLost, this);
    EventBus.on(GameEvents.LEVEL_FINISHED, this.onFinish, this);
    EventBus.on(GameEvents.LEVEL_RESET, this.onReset, this);
  }

  onDestroy() { EventBus.targetOff(this); }

  update(dt: number) {
    // 分数滚动增长，比直接跳数字更有反馈
    if (this._shownScore === this._score) return;
    const diff = this._score - this._shownScore;
    const step = Math.max(1, Math.abs(diff) * Math.min(1, dt * 9));
    this._shownScore += Math.sign(diff) * Math.min(step, Math.abs(diff));
    if (Math.abs(this._score - this._shownScore) < 0.6) this._shownScore = this._score;
    if (this.scoreLabel) this.scoreLabel.string = String(Math.floor(this._shownScore));
  }

  private onStart() {
    if (this.hintNode) this.hintNode.active = false;
  }

  private onScore(score: number) { this._score = score; }

  private onCarry(carrying: number, capacity: number) {
    const c = Math.floor(carrying);
    if (this.carryLabel) this.carryLabel.string = `${c} / ${capacity}`;
    if (this.carryBarFill) {
      const t = capacity > 0 ? Math.min(1, carrying / capacity) : 0;
      this.carryBarFill.setScale(t, 1, 1);
    }
  }

  private onGate(factor: number) { this.pop(`×${factor}`, '#ffe054'); }
  private onLost(lost: number) { this.pop(`-${Math.floor(lost)}`, '#ff6a4d'); }

  /** 屏幕中央飘字 */
  private pop(text: string, colorHex: string) {
    const label = this.popLabel;
    if (!label) return;
    label.string = text;
    const c = label.color.clone();
    c.fromHEX(colorHex);
    label.color = c;

    const node = label.node;
    let op = node.getComponent(UIOpacity);
    if (!op) op = node.addComponent(UIOpacity);
    node.active = true;
    node.setScale(0.4, 0.4, 1);
    node.setPosition(0, 40);
    op.opacity = 255;
    tween(node).to(0.22, { scale: new Vec3(1.25, 1.25, 1) }, { easing: 'backOut' })
      .to(0.5, { scale: new Vec3(1, 1, 1), position: new Vec3(0, 130, 0) })
      .call(() => { node.active = false; })
      .start();
    tween(op).delay(0.32).to(0.4, { opacity: 0 }).start();
  }

  private onFinish() {
    this.scheduleOnce(() => {
      this._shownScore = this._score;
      if (this.scoreLabel) this.scoreLabel.string = String(Math.floor(this._score));
      if (this.finalScoreLabel) this.finalScoreLabel.string = String(Math.floor(this._score));
      if (this.resultPanel) {
        this.resultPanel.active = true;
        this.resultPanel.setScale(0.85, 0.85, 1);
        tween(this.resultPanel).to(0.3, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
      }
    }, this.resultDelay);
  }

  private onReset() {
    this._score = 0;
    this._shownScore = 0;
    if (this.scoreLabel) this.scoreLabel.string = '0';
    if (this.carryLabel) this.carryLabel.string = '0 / 0';
    if (this.carryBarFill) this.carryBarFill.setScale(0, 1, 1);
    if (this.resultPanel) this.resultPanel.active = false;
    if (this.hintNode) this.hintNode.active = true;
  }
}
