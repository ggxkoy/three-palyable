import { _decorator, Component, Node } from 'cc';
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
 * 游戏流程状态机 + 计分中枢。场景里唯一常驻的"导演"节点。
 * 只通过事件总线与其它模块通信；终点判定复用 TriggerZone
 * （在终点位置摆一个 filter=DOZER、eventName=LEVEL_FINISHED 的触发区即可，
 * 不需要写任何终点代码）。
 */
@ccclass('GameFlow')
export class GameFlow extends Component {
  @property({ tooltip: '结算面板弹出前的延迟（秒）' })
  resultDelay = 0.45;

  state: GameState = GameState.IDLE;
  score = 0;

  onLoad() {
    EventBus.on(GameEvents.INPUT_START, this.onInputStart, this);
    EventBus.on(GameEvents.GEM_COLLECTED, this.onGemCollected, this);
    EventBus.on(GameEvents.GEM_DESTROYED, this.onGemDestroyed, this);
    EventBus.on(GameEvents.LEVEL_FINISHED, this.onLevelFinished, this);
  }

  onDestroy() {
    EventBus.targetOff(this);
  }

  /** 结算面板"再来一次"按钮的编辑器回调 */
  restart() {
    this.state = GameState.IDLE;
    this.score = 0;
    EventBus.emit(GameEvents.SCORE_CHANGED, 0);
    // 场景里所有触发区清掉"只触发一次"记录
    for (const zone of this.node.scene.getComponentsInChildren(TriggerZone)) zone.resetTriggered();
    EventBus.emit(GameEvents.LEVEL_RESET);
  }

  private onInputStart() {
    if (this.state === GameState.IDLE) this.state = GameState.PLAYING;
  }

  private onGemCollected(_gem: Node, value: number) {
    if (this.state !== GameState.PLAYING) return;
    this.score += value;
    EventBus.emit(GameEvents.SCORE_CHANGED, this.score);
  }

  private onGemDestroyed(_gem: Node, penalty: number) {
    if (this.state !== GameState.PLAYING || penalty <= 0) return;
    this.score = Math.max(0, this.score - penalty);
    EventBus.emit(GameEvents.SCORE_CHANGED, this.score);
  }

  private onLevelFinished() {
    this.state = GameState.FINISHED;
  }
}
