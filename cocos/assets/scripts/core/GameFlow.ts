import { _decorator, Component } from 'cc';
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
 * 分数来自 DELIVERED（投递区已含累计逻辑，这里做总账 + 目标判定）。
 * 只经事件总线通信，任何模块删掉都不报错。
 */
@ccclass('GameFlow')
export class GameFlow extends Component {
  @property({ tooltip: '目标分数，达到即通关；<=0 表示无目标（纯计分/靠终点线结束）' })
  targetScore = 0;

  state: GameState = GameState.IDLE;
  score = 0;

  onLoad() {
    EventBus.on(GameEvents.INPUT_START, this.onInputStart, this);
    EventBus.on(GameEvents.DELIVERED, this.onDelivered, this);
    EventBus.on(GameEvents.LEVEL_FINISHED, this.onLevelFinished, this);
  }

  onDestroy() { EventBus.targetOff(this); }

  /** 结算面板"再来一次"按钮的编辑器回调 */
  restart() {
    this.state = GameState.IDLE;
    this.score = 0;
    EventBus.emit(GameEvents.SCORE_CHANGED, 0);
    for (const zone of this.node.scene.getComponentsInChildren(TriggerZone)) zone.resetTriggered();
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
