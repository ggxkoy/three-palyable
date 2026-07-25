import { _decorator, BoxCollider, Component, ITriggerEvent } from 'cc';
import { EventBus } from '../core/EventBus';
import { PushToken } from './PushToken';

const { ccclass } = _decorator;
export const EVENT_GATE = 'reference-gate';

@ccclass('MultiplierBrushGate')
export class MultiplierBrushGate extends Component {
  multiplier = 10;
  private _converted = 0;

  onEnable() {
    this.getComponent(BoxCollider)?.on('onTriggerEnter', this.onTriggerEnter, this);
  }

  onDisable() {
    this.getComponent(BoxCollider)?.off('onTriggerEnter', this.onTriggerEnter, this);
  }

  private onTriggerEnter(event: ITriggerEvent) {
    const token = event.otherCollider.node.getComponent(PushToken);
    if (!token?.convert(this.multiplier)) return;
    this._converted++;
    if (this._converted === 1 || this._converted % 8 === 0) {
      EventBus.emit(EVENT_GATE, this.multiplier, this._converted);
    }
  }
}
