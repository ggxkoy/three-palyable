import { _decorator, Component, Label, Node, Animation, ProgressBar } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
const { ccclass, property } = _decorator;

/**
 * HUD：只订阅事件刷新显示，不引用任何玩法模块。
 * 引用在编辑器面板拖拽绑定，未绑定的字段自动跳过。
 */
@ccclass('HUD')
export class HUD extends Component {
  @property({ type: Label, tooltip: '分数文本' })
  scoreLabel: Label | null = null;

  @property({ type: Label, tooltip: '携带量文本，如 “37/200”' })
  carryLabel: Label | null = null;

  @property({ type: ProgressBar, tooltip: '携带量进度条（可选）' })
  carryBar: ProgressBar | null = null;

  @property({ type: Label, tooltip: '倍率飘字（配 Animation 播 pop）' })
  multiplierLabel: Label | null = null;

  @property({ type: Node, tooltip: '开场提示（拖拽移动…）' })
  hintNode: Node | null = null;

  @property({ type: Node, tooltip: '结算面板' })
  resultPanel: Node | null = null;

  @property({ type: Label, tooltip: '结算面板里的最终分数' })
  finalScoreLabel: Label | null = null;

  @property({ tooltip: '结算面板弹出延迟（秒）' })
  resultDelay = 0.45;

  private _score = 0;

  onLoad() {
    EventBus.on(GameEvents.INPUT_START, this.onStart, this);
    EventBus.on(GameEvents.SCORE_CHANGED, this.onScore, this);
    EventBus.on(GameEvents.CARRY_CHANGED, this.onCarry, this);
    EventBus.on(GameEvents.GATE_PASSED, this.onGate, this);
    EventBus.on(GameEvents.LEVEL_FINISHED, this.onFinish, this);
    EventBus.on(GameEvents.LEVEL_RESET, this.onReset, this);
  }

  onDestroy() { EventBus.targetOff(this); }

  private onStart() { if (this.hintNode) this.hintNode.active = false; }

  private onScore(score: number) {
    this._score = score;
    if (this.scoreLabel) this.scoreLabel.string = String(score);
  }

  private onCarry(carrying: number, capacity: number) {
    const c = Math.floor(carrying);
    if (this.carryLabel) this.carryLabel.string = `${c}/${capacity}`;
    if (this.carryBar) this.carryBar.progress = capacity > 0 ? carrying / capacity : 0;
  }

  private onGate(factor: number) {
    if (!this.multiplierLabel) return;
    this.multiplierLabel.string = `×${factor}`;
    this.multiplierLabel.getComponent(Animation)?.play();
  }

  private onFinish() {
    this.scheduleOnce(() => {
      if (this.finalScoreLabel) this.finalScoreLabel.string = String(this._score);
      if (this.resultPanel) this.resultPanel.active = true;
    }, this.resultDelay);
  }

  private onReset() {
    this._score = 0;
    if (this.scoreLabel) this.scoreLabel.string = '0';
    if (this.carryLabel) this.carryLabel.string = '0';
    if (this.carryBar) this.carryBar.progress = 0;
    if (this.resultPanel) this.resultPanel.active = false;
    if (this.hintNode) this.hintNode.active = true;
  }
}
