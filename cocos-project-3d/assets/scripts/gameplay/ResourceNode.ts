import { _decorator, Component, Node, Vec3, math, tween } from 'cc';
import { TriggerZone } from '../core/TriggerZone';
import { Hero } from './Hero';
const { ccclass, property, requireComponent } = _decorator;

/**
 * 资源点（一堆资源）。主角进入范围即自动、持续拾取，直到堆空或主角装满。
 * 堆空后自动补充，保证场面持续"有货可捡" —— 爽感的关键。
 *
 * 节点须挂 TriggerZone（圆形，radius 即拾取范围）。
 * pileVisual 随剩余量缩放，捡完缩下去、补充时弹回来。
 */
@ccclass('ResourceNode')
@requireComponent(TriggerZone)
export class ResourceNode extends Component {
  @property({ tooltip: '初始资源量' })
  amount = 40;

  @property({ tooltip: '每秒拾取速度，越大越爽' })
  pickupRate = 70;

  @property({ tooltip: '堆空后是否补充' })
  respawns = true;

  @property({ tooltip: '补充延时（秒）' })
  respawnDelay = 3.5;

  @property({ type: Node, tooltip: '资源堆表现节点，按剩余量缩放' })
  pileVisual: Node | null = null;

  private _zone!: TriggerZone;
  private _max = 0;
  private _baseScale = 1;
  private _refilling = false;
  /** 补充弹出动画期间，暂不让 refreshVisual 抢缩放 */
  private _animating = false;

  onLoad() {
    this._zone = this.getComponent(TriggerZone)!;
    this._zone.oncePerTarget = false;
    this._max = this.amount;
    if (this.pileVisual) this._baseScale = this.pileVisual.scale.x;
  }

  /** 供 ResourceField 在生成后设置初始量 */
  setup(amount: number) {
    this.amount = amount;
    this._max = amount;
    this._refilling = false;
    if (this.pileVisual) this.pileVisual.active = true;
    this.refreshVisual();
  }

  update(dt: number) {
    if (this.amount <= 0 || this._zone.overlapping.size === 0) return;
    for (const node of this._zone.overlapping) {
      if (!node.isValid) continue;
      const hero = node.getComponent(Hero);
      if (!hero || hero.freeSpace <= 0) continue;
      const want = Math.min(this.pickupRate * dt, this.amount);
      const taken = hero.addCarry(want);
      if (taken <= 0) continue;
      this.amount -= taken;
      if (this.amount <= 0) { this.deplete(); break; }
    }
    this.refreshVisual();
  }

  private deplete() {
    this.amount = 0;
    if (this.pileVisual) this.pileVisual.active = false;
    if (this.respawns && !this._refilling) {
      this._refilling = true;
      this.scheduleOnce(() => this.refill(), this.respawnDelay);
    }
  }

  private refill() {
    this._refilling = false;
    this.amount = this._max;
    if (this.pileVisual) {
      this.pileVisual.active = true;
      this.pileVisual.setScale(0.1, 0.1, 1);
      const s = this._baseScale;
      this._animating = true;
      tween(this.pileVisual)
        .to(0.28, { scale: new Vec3(s * 1.15, s * 1.15, 1) }, { easing: 'backOut' })
        .to(0.1, { scale: new Vec3(s, s, 1) })
        .call(() => { this._animating = false; })
        .start();
    }
  }

  private refreshVisual() {
    if (!this.pileVisual || this._max <= 0 || this._animating) return;
    const t = math.clamp01(this.amount / this._max);
    const s = this._baseScale * (0.3 + 0.7 * t);
    this.pileVisual.setScale(s, s, 1);
  }
}
