import { _decorator, Component, Prefab, instantiate, Node, Enum, math } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
const { ccclass, property } = _decorator;

export enum SpawnShape {
  CIRCLE = 0,
  RECT = 1,
}
Enum(SpawnShape);

/**
 * 宝石生成器 Prefab：把生成器节点摆在场景里想要的位置，
 * 属性面板里调数量/形状/范围即可，支持一关放多个生成器。
 */
@ccclass('GemSpawner')
export class GemSpawner extends Component {
  @property({ type: Prefab, tooltip: '宝石 Prefab（带 Gem 组件 + Dynamic 刚体）' })
  gemPrefab: Prefab | null = null;

  @property({ tooltip: '生成数量' })
  count = 145;

  @property({ type: SpawnShape, tooltip: '分布形状' })
  shape: SpawnShape = SpawnShape.CIRCLE;

  @property({ tooltip: '圆形分布半径 / 矩形半宽' })
  radiusX = 5.2;

  @property({ tooltip: '圆形分布纵向拉伸系数 / 矩形半长' })
  radiusZ = 7.3;

  @property({ tooltip: '宝石落点离地高度' })
  spawnY = 0.32;

  private _spawned: Node[] = [];

  onLoad() {
    EventBus.on(GameEvents.LEVEL_RESET, this.respawn, this);
  }

  start() {
    this.respawn();
  }

  onDestroy() {
    EventBus.targetOff(this);
  }

  respawn() {
    for (const node of this._spawned) if (node.isValid) node.destroy();
    this._spawned = [];
    if (!this.gemPrefab) return;
    for (let i = 0; i < this.count; i++) {
      const gem = instantiate(this.gemPrefab);
      const [x, z] = this.randomPoint();
      gem.setPosition(x, this.spawnY, z);
      gem.setRotationFromEuler(math.randomRange(0, 360), math.randomRange(0, 360), math.randomRange(0, 360));
      this.node.addChild(gem);
      this._spawned.push(gem);
    }
  }

  private randomPoint(): [number, number] {
    if (this.shape === SpawnShape.CIRCLE) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random());
      return [Math.cos(angle) * r * this.radiusX, Math.sin(angle) * r * this.radiusZ];
    }
    return [math.randomRange(-this.radiusX, this.radiusX), math.randomRange(-this.radiusZ, this.radiusZ)];
  }
}
