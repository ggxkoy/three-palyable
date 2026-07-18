import { _decorator, Component, Prefab, JsonAsset, instantiate, Node } from 'cc';
import { MultiplierGate } from '../gameplay/MultiplierGate';
import { Hazard } from '../gameplay/Hazard';
import { GemSpawner } from '../gameplay/GemSpawner';
const { ccclass, property } = _decorator;

/** 关卡 JSON 结构，见 assets/data/levels/level01.json */
interface LevelData {
  gates?: { x: number; z: number; width?: number; multiplier: number }[];
  hazards?: { x: number; z: number; width?: number; depth?: number; penalty?: number }[];
  spawners?: { x: number; z: number; count: number; radiusX?: number; radiusZ?: number }[];
  collect?: { x: number; z: number; radius?: number };
  finishZ?: number;
}

/**
 * 数据驱动关卡装配：按 JSON 配置实例化各模块 Prefab 并写入参数。
 * playable 广告 A/B 测不同难度时只改 JSON，不改场景不改代码。
 * 也可以不用它，直接在编辑器里手摆 Prefab —— 两种方式共存。
 */
@ccclass('LevelLoader')
export class LevelLoader extends Component {
  @property({ type: JsonAsset }) levelData: JsonAsset | null = null;
  @property({ type: Prefab }) gatePrefab: Prefab | null = null;
  @property({ type: Prefab }) hazardPrefab: Prefab | null = null;
  @property({ type: Prefab }) spawnerPrefab: Prefab | null = null;
  @property({ type: Prefab }) collectZonePrefab: Prefab | null = null;
  @property({ type: Node, tooltip: '实例化出的模块挂在此节点下' }) levelRoot: Node | null = null;

  onLoad() {
    if (!this.levelData) return;
    const data = this.levelData.json as LevelData;
    const root = this.levelRoot ?? this.node;

    for (const g of data.gates ?? []) {
      const node = this.place(this.gatePrefab, root, g.x, g.z);
      const gate = node?.getComponent(MultiplierGate);
      if (gate) gate.multiplier = g.multiplier;
      if (node && g.width) node.setScale(g.width / node.scale.x, 1, 1);
    }
    for (const h of data.hazards ?? []) {
      const node = this.place(this.hazardPrefab, root, h.x, h.z);
      const hazard = node?.getComponent(Hazard);
      if (hazard && h.penalty != null) hazard.scorePenalty = h.penalty;
    }
    for (const s of data.spawners ?? []) {
      const node = this.place(this.spawnerPrefab, root, s.x, s.z);
      const spawner = node?.getComponent(GemSpawner);
      if (spawner) {
        spawner.count = s.count;
        if (s.radiusX != null) spawner.radiusX = s.radiusX;
        if (s.radiusZ != null) spawner.radiusZ = s.radiusZ;
      }
    }
    if (data.collect) this.place(this.collectZonePrefab, root, data.collect.x, data.collect.z);
  }

  private place(prefab: Prefab | null, root: Node, x: number, z: number): Node | null {
    if (!prefab) return null;
    const node = instantiate(prefab);
    node.setPosition(x, 0, z);
    root.addChild(node);
    return node;
  }
}
