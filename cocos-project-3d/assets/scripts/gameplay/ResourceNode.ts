import { _decorator, Component, Node, Vec3, math } from 'cc';
import { TriggerZone, TriggerFilter } from '../core/TriggerZone';
import { Hero } from './Hero';
const { ccclass, property, requireComponent } = _decorator;

/**
 * 资源点（一堆资源）。主角进入检测范围即自动、持续拾取，直到堆空或主角装满。
 * 堆空后可选延时补充，让场面持续"有货可捡"，这是"爽"的关键之一。
 *
 * 节点要求：TriggerZone（filter=HERO 的球形/柱形 isTrigger，半径即拾取范围）。
 * pileVisual 指向表现模型，会随剩余量缩放（越捡越小，捡完消失）。
 */
@ccclass('ResourceNode')
@requireComponent(TriggerZone)
export class ResourceNode extends Component {
  @property({ tooltip: '初始资源量' })
  amount = 40;

  @property({ tooltip: '每秒拾取速度（单位/秒），越大越爽' })
  pickupRate = 60;

  @property({ tooltip: '堆空后是否补充' })
  respawns = true;

  @property({ tooltip: '补充延时（秒）' })
  respawnDelay = 3;

  @property({ type: Node, tooltip: '资源堆表现模型，按剩余量缩放；留空则不缩放' })
  pileVisual: Node | null = null;

  private _zone!: TriggerZone;
  private _max = 0;
  private _baseScale = new Vec3(1, 1, 1);
  private _refilling = false;

  onLoad() {
    this._zone = this.getComponent(TriggerZone)!;
    this._zone.filter = TriggerFilter.HERO;
    this._zone.oncePerTarget = false;
    this._max = this.amount;
    if (this.pileVisual) this.pileVisual.getScale(this._baseScale);
  }

  update(dt: number) {
    if (this.amount <= 0 || this._zone.overlapping.size === 0) return;
    for (const node of this._zone.overlapping) {
      if (!node.isValid) continue;
      const hero = node.getComponent(Hero);
      if (!hero || hero.freeSpace <= 0) continue;
      const want = Math.min(this.pickupRate * dt, this.amount);
      const taken = hero.addCarry(want);
      this.amount -= taken;
      if (this.amount <= 0) { this.deplete(); break; }
    }
    this.refreshVisual();
  }

  private deplete() {
    this.amount = 0;
    this.refreshVisual();
    if (this.pileVisual) this.pileVisual.active = false;
    if (this.respawns && !this._refilling) {
      this._refilling = true;
      this.scheduleOnce(() => this.refill(), this.respawnDelay);
    }
  }

  private refill() {
    this._refilling = false;
    this.amount = this._max;
    if (this.pileVisual) this.pileVisual.active = true;
    this.refreshVisual();
  }

  private refreshVisual() {
    if (!this.pileVisual || this._max <= 0) return;
    const t = math.clamp01(this.amount / this._max);
    // 保留一点最小体积，视觉上不至于瞬间塌成 0
    const s = 0.25 + 0.75 * t;
    this.pileVisual.setScale(this._baseScale.x * s, this._baseScale.y * s, this._baseScale.z * s);
  }
}
