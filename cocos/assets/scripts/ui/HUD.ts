import { _decorator, Component, Label, Node, Animation } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
const { ccclass, property } = _decorator;

/**
 * HUD：只订阅事件刷新显示，不持有任何玩法模块的引用。
 * 所有节点引用在编辑器属性面板里拖拽绑定。
 */
@ccclass('HUD')
export class HUD extends Component {
  @property({ type: Label, tooltip: '分数文本' })
  scoreLabel: Label | null = null;

  @property({ type: Label, tooltip: '倍率飘字文本（配 Animation 播 pop 动画）' })
  multiplierLabel: Label | null = null;

  @property({ type: Node, tooltip: '开场提示（按住拖拽…）' })
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
    EventBus.on(GameEvents.GATE_PASSED, this.onGatePassed, this);
    EventBus.on(GameEvents.LEVEL_FINISHED, this.onFinish, this);
    EventBus.on(GameEvents.LEVEL_RESET, this.onReset, this);
  }

  onDestroy() {
    EventBus.targetOff(this);
  }

  private onStart() {
    if (this.hintNode) this.hintNode.active = false;
  }

  private onScore(score: number) {
    this._score = score;
    if (this.scoreLabel) this.scoreLabel.string = String(score);
  }

  private onGatePassed(_gem: Node, multiplier: number) {
    if (!this.multiplierLabel) return;
    this.multiplierLabel.string = `×${multiplier}`;
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
    if (this.resultPanel) this.resultPanel.active = false;
    if (this.hintNode) this.hintNode.active = true;
  }
}
