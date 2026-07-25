import { _decorator, Component, director } from 'cc';
import { EventBus } from './EventBus';
import { GameEvents } from './GameEvents';
import { TriggerZone } from './TriggerZone';
const { ccclass, property } = _decorator;

export enum GameState {
  IDLE = 'idle',
  PLAYING = 'playing',
  FINISHED = 'finished',
}

/**
 * 流程状态机 + 计分中枢。场景里唯一常驻的"导演"。
 * 只经事件总线通信，删掉任何玩法模块都不会报错。
 */
@ccclass('GameFlow')
export class GameFlow extends Component {
  @property({ tooltip: '目标分数，达到即通关；<=0 表示无目标（靠限时或终点线）' })
  targetScore = 0;

  @property({ tooltip: '限时（秒），<=0 表示不限时' })
  timeLimit = 0;

  state: GameState = GameState.IDLE;
  score = 0;
  timeLeft = 0;

  onLoad() {
    this.timeLeft = this.timeLimit;
    EventBus.on(GameEvents.INPUT_START, this.onInputStart, this);
    EventBus.on(GameEvents.DELIVERED, this.onDelivered, this);
    EventBus.on(GameEvents.LEVEL_FINISHED, this.onLevelFinished, this);
  }

  onDestroy() { EventBus.targetOff(this); }

  update(dt: number) {
    if (this.state !== GameState.PLAYING || this.timeLimit <= 0) return;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft <= 0) EventBus.emit(GameEvents.LEVEL_FINISHED);
  }

  /** 结算面板"再来一次"回调 */
  restart() {
    this.state = GameState.IDLE;
    this.score = 0;
    this.timeLeft = this.timeLimit;
    EventBus.emit(GameEvents.SCORE_CHANGED, 0);
    const scene = director.getScene();
    if (scene) {
      for (const zone of scene.getComponentsInChildren(TriggerZone)) zone.resetTriggered();
    }
    EventBus.emit(GameEvents.LEVEL_RESET);
  }

  private onInputStart() {
    if (this.state === GameState.IDLE) this.state = GameState.PLAYING;
  }

  private onDelivered(amount: number) {
    if (this.state !== GameState.PLAYING) return;
    this.score += amount;
    EventBus.emit(GameEvents.SCORE_CHANGED, Math.floor(this.score));
    if (this.targetScore > 0 && this.score >= this.targetScore) {
      EventBus.emit(GameEvents.LEVEL_FINISHED);
    }
  }

  private onLevelFinished() {
    if (this.state === GameState.FINISHED) return;
    this.state = GameState.FINISHED;
  }
}
