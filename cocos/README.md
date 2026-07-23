# Canyon Dozer — Cocos Creator 版脚手架

three.js 原版（仓库根目录）的 Cocos Creator 3.8+ 重构脚手架：
**组件脚本 + 关卡配置 + 设计文档**。

玩法为**快递员自动收集**：玩家只用摇杆操纵主角走位，主角靠近资源点自动拾取、
到投递区自动卸货计分、带货穿倍率门自动翻倍、踩岩浆掉货。设计详见
[docs/design.md](docs/design.md)。

> `.scene`/`.prefab`/`.meta` 等编辑器资产必须由 Cocos Creator 生成，无法脱离
> 编辑器手写，所以本目录只含脚本与数据，场景和 Prefab 需按下面步骤在编辑器组装一次。

## 使用步骤

1. 用 Cocos Creator **3.8+** 新建空 3D 项目。
2. 把本目录 `assets/scripts/`、`assets/data/` 拷进新项目的 `assets/`，
   打开编辑器等待编译（meta 自动生成）。
3. 项目设置 → 功能裁剪：启用 3D 物理（PhysX）。
4. 组装 Prefab（每个 = 模型 + 碰撞体 + 对应组件）：
   - **Hero（主角）**：车身模型 + Collider（非 trigger）+ Kinematic RigidBody + `Hero`；
     下挂一个堆叠锚点子节点，挂 `CarryStack`（itemPrefab 指向货物模型）
   - **ResourceNode（资源点）**：资源堆模型 + 球/柱 Collider(isTrigger，半径=拾取范围)
     + `TriggerZone` + `ResourceNode`（pileVisual 指向堆模型）
   - **DeliveryZone（投递区）**：收集台模型 + Collider(isTrigger) + `TriggerZone` + `DeliveryZone`
   - **MultiplierGate**：门柱模型 + BoxCollider(isTrigger，宽=门宽) + `TriggerZone` + `MultiplierGate`
   - **Hazard（岩浆）**：岩浆面片 + BoxCollider(isTrigger) + `TriggerZone` + `Hazard`
   - **ResourceField（撒布器）**：空节点 + `ResourceField`（nodePrefab 拖入 ResourceNode）
5. 场景里放：`GameFlow`、`MoveInput`、`CameraFollow`(target=Hero)、
   `HUD`（Canvas 下，拖好 Label / 进度条 / 面板引用），地面与峡谷装饰，
   然后手摆 Prefab，或挂 `LevelLoader` 用 `assets/data/levels/level01.json` 数据驱动装配。
6. 结算面板"再来一次"按钮 ClickEvent 绑 `GameFlow.restart`。

## 调"爽"的几个旋钮

- `ResourceField.nodeCount` ↑：资源点更密集。
- `ResourceNode.pickupRate` / `DeliveryZone.deliverRate` ↑：拾取/投递更快，数字蹦更猛。
- `Hero.capacity` ↑：能囤更多再一次性投递，爽感更强。
- `ResourceNode.respawns` 开：捡空自动补充，场面持续有货。

## 目录结构

```
assets/
  scripts/
    core/      EventBus, GameEvents, TriggerZone, MoveInput, GameFlow, LevelLoader
    gameplay/  Hero, ResourceNode, ResourceField, DeliveryZone,
               MultiplierGate, Hazard, CarryStack, CameraFollow
    ui/        HUD
  data/
    levels/    level01.json（关卡布局，A/B 变体只改这里）
docs/
  design.md    架构、事件清单、Prefab 属性表
```
