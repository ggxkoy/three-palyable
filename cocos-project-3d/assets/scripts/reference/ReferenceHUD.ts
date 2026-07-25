import { _decorator, Component, Label, Node } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
import { EVENT_BRIDGE_PROGRESS } from './BridgeCollector';
import { EVENT_GATE } from './MultiplierBrushGate';
import { EVENT_GOAL } from './ReferenceGoal';

const { ccclass } = _decorator;

@ccclass('ReferenceHUD')
export class ReferenceHUD extends Component {
  private _coins: Label | null = null;
  private _bridge: Label | null = null;
  private _multiplier: Label | null = null;
  private _hint: Node | null = null;
  private _banner: Label | null = null;

  setup(coins: Label, bridge: Label, multiplier: Label, hint: Node, banner: Label) {
    this._coins = coins;
    this._bridge = bridge;
    this._multiplier = multiplier;
    this._hint = hint;
    this._banner = banner;
  }

  onLoad() {
    EventBus.on(GameEvents.INPUT_START, this.onStart, this);
    EventBus.on(EVENT_GATE, this.onGate, this);
    EventBus.on(EVENT_BRIDGE_PROGRESS, this.onBridge, this);
    EventBus.on(EVENT_GOAL, this.onGoal, this);
  }

  onDestroy() {
    EventBus.targetOff(this);
  }

  private onStart() {
    if (this._hint) this._hint.active = false;
  }

  private onGate(multiplier: number) {
    if (!this._multiplier) return;
    this._multiplier.string = `×${multiplier}`;
    this._multiplier.node.active = true;
    this.unschedule(this.hideMultiplier);
    this.scheduleOnce(this.hideMultiplier, 0.7);
  }

  private hideMultiplier = () => {
    if (this._multiplier) this._multiplier.node.active = false;
  };

  private onBridge(total: number, target: number, complete: boolean) {
    if (this._coins) this._coins.string = `${total}`;
    if (this._bridge) this._bridge.string = complete ? 'BRIDGE OPEN' : `铺桥 ${total}/${target}`;
    if (complete && this._banner) {
      this._banner.string = '桥梁建成！';
      this._banner.node.active = true;
      this.scheduleOnce(() => {
        if (this._banner) this._banner.node.active = false;
      }, 1.2);
    }
  }

  private onGoal() {
    if (!this._banner) return;
    this._banner.string = '新区已解锁！';
    this._banner.node.active = true;
  }
}
