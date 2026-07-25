import { _decorator, Component, Prefab, JsonAsset, instantiate, Node } from 'cc';
import { MultiplierGate } from '../gameplay/MultiplierGate';
import { Hazard } from '../gameplay/Hazard';
import { ResourceField } from '../gameplay/ResourceField';
import { DeliveryZone } from '../gameplay/DeliveryZone';
const { ccclass, property } = _decorator;

/** 关卡 JSON 结构，见 assets/data/levels/level01.json */
interface LevelData {
  fields?: { x: number; z: number; nodeCount: number; radiusX?: number; radiusZ?: number; amountMin?: number; amountMax?: number }[];
  gates?: { x: number; z: number; width?: number; multiplier: number }[];
  hazards?: { x: number; z: number; width?: number; lossRatio?: number }[];
  delivery?: { x: number; z: number; rate?: number };
  targetScore?: number;
}

/**
 * 数据驱动关卡装配：按 JSON 实例化各模块 Prefab 并写参数。
 * playable 广告出 A/B 难度变体时只改 JSON。也可不用它，直接在编辑器手摆。
 */
@ccclass('LevelLoader')
export class LevelLoader extends Component {
  @property({ type: JsonAsset }) levelData: JsonAsset | null = null;
  @property({ type: Prefab }) fieldPrefab: Prefab | null = null;
  @property({ type: Prefab }) gatePrefab: Prefab | null = null;
  @property({ type: Prefab }) hazardPrefab: Prefab | null = null;
  @property({ type: Prefab }) deliveryPrefab: Prefab | null = null;
  @property({ type: Node, tooltip: '实例化出的模块挂在此节点下' }) levelRoot: Node | null = null;

  onLoad() {
    if (!this.levelData) return;
    const data = this.levelData.json as LevelData;
    const root = this.levelRoot ?? this.node;

    for (const f of data.fields ?? []) {
      const field = this.place(this.fieldPrefab, root, f.x, f.z)?.getComponent(ResourceField);
      if (field) {
        field.nodeCount = f.nodeCount;
        if (f.radiusX != null) field.radiusX = f.radiusX;
        if (f.radiusZ != null) field.radiusZ = f.radiusZ;
        if (f.amountMin != null) field.amountMin = f.amountMin;
        if (f.amountMax != null) field.amountMax = f.amountMax;
      }
    }
    for (const g of data.gates ?? []) {
      const node = this.place(this.gatePrefab, root, g.x, g.z);
      const gate = node?.getComponent(MultiplierGate);
      if (gate) gate.multiplier = g.multiplier;
      if (node && g.width) node.setScale(g.width / node.scale.x, 1, 1);
    }
    for (const h of data.hazards ?? []) {
      const hazard = this.place(this.hazardPrefab, root, h.x, h.z)?.getComponent(Hazard);
      if (hazard && h.lossRatio != null) hazard.lossRatio = h.lossRatio;
    }
    if (data.delivery) {
      const dz = this.place(this.deliveryPrefab, root, data.delivery.x, data.delivery.z)?.getComponent(DeliveryZone);
      if (dz && data.delivery.rate != null) dz.deliverRate = data.delivery.rate;
    }
  }

  private place(prefab: Prefab | null, root: Node, x: number, z: number): Node | null {
    if (!prefab) return null;
    const node = instantiate(prefab);
    node.setPosition(x, 0, z);
    root.addChild(node);
    return node;
  }
}
