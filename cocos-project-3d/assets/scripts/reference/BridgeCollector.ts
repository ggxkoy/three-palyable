import { _decorator, BoxCollider, Component, ITriggerEvent, Node } from 'cc';
import { EventBus } from '../core/EventBus';
import { DozerController } from './DozerController';
import { PushToken } from './PushToken';

const { ccclass } = _decorator;
export const EVENT_BRIDGE_PROGRESS = 'reference-bridge-progress';

@ccclass('BridgeCollector')
export class BridgeCollector extends Component {
  target = 250;
  total = 0;
  complete = false;

  private _planks: Node[] = [];
  private _dozer: DozerController | null = null;
  private _accepted = new Set<Node>();

  setup(planks: Node[], dozer: DozerController) {
    this._planks = planks;
    this._dozer = dozer;
  }

  onEnable() {
    this.getComponent(BoxCollider)?.on('onTriggerEnter', this.onTriggerEnter, this);
  }

  onDisable() {
    this.getComponent(BoxCollider)?.off('onTriggerEnter', this.onTriggerEnter, this);
  }

  private onTriggerEnter(event: ITriggerEvent) {
    const node = event.otherCollider.node;
    const token = node.getComponent(PushToken);
    if (!token || this._accepted.has(node) || this.complete) return;
    this._accepted.add(node);
    this.total = Math.min(this.target, this.total + token.value);
    node.destroy();
    this.refreshPlanks();
    EventBus.emit(EVENT_BRIDGE_PROGRESS, this.total, this.target, this.complete);
  }

  private refreshPlanks() {
    const ratio = this.total / this.target;
    const visible = Math.ceil(ratio * this._planks.length);
    this._planks.forEach((plank, index) => {
      plank.active = index < visible;
    });
    if (!this.complete && this.total >= this.target) {
      this.complete = true;
      this._planks.forEach((plank) => (plank.active = true));
      this._dozer?.unlockBridge();
    }
  }
}
