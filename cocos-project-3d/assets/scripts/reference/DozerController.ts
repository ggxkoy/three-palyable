import { _decorator, Component, math, Vec3 } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';

const { ccclass } = _decorator;

@ccclass('DozerController')
export class DozerController extends Component {
  speed = 6.2;
  boundX = 5.4;
  minZ = -6.2;
  maxZ = 9.2;

  private _dir = new Vec3();
  private _moving = false;

  onLoad() {
    EventBus.on(GameEvents.MOVE_DIR, this.onDirection, this);
    EventBus.on(GameEvents.MOVE_STOP, this.onStop, this);
  }

  onDestroy() {
    EventBus.targetOff(this);
  }

  update(dt: number) {
    if (!this._moving) return;
    const p = this.node.position;
    const x = math.clamp(p.x + this._dir.x * this.speed * dt, -this.boundX, this.boundX);
    const z = math.clamp(p.z + this._dir.z * this.speed * dt, this.minZ, this.maxZ);
    this.node.setPosition(x, p.y, z);
    if (this._dir.lengthSqr() > 0.01) {
      const yaw = Math.atan2(this._dir.x, this._dir.z) * 180 / Math.PI + 180;
      const current = this.node.eulerAngles.y;
      let delta = (yaw - current) % 360;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      this.node.setRotationFromEuler(0, current + delta * Math.min(1, dt * 12), 0);
    }
  }

  unlockBridge() {
    this.minZ = -22.5;
  }

  private onDirection(x: number, z: number) {
    this._moving = true;
    this._dir.set(x, 0, z);
  }

  private onStop() {
    this._moving = false;
    this._dir.set(0, 0, 0);
  }
}
