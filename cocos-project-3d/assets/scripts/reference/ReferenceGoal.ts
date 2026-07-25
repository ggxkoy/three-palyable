import { _decorator, BoxCollider, Component, ITriggerEvent } from 'cc';
import { EventBus } from '../core/EventBus';
import { DozerController } from './DozerController';

const { ccclass } = _decorator;
export const EVENT_GOAL = 'reference-goal';

@ccclass('ReferenceGoal')
export class ReferenceGoal extends Component {
  private _triggered = false;

  onEnable() {
    this.getComponent(BoxCollider)?.on('onTriggerEnter', this.onTriggerEnter, this);
  }

  onDisable() {
    this.getComponent(BoxCollider)?.off('onTriggerEnter', this.onTriggerEnter, this);
  }

  private onTriggerEnter(event: ITriggerEvent) {
    if (this._triggered || !event.otherCollider.node.getComponent(DozerController)) return;
    this._triggered = true;
    EventBus.emit(EVENT_GOAL);
  }
}
