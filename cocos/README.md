# Canyon Dozer — Cocos Creator 版脚手架

这是 three.js 原版（仓库根目录）的 Cocos Creator 3.8+ 重构脚手架：
**组件脚本 + 关卡配置 + 设计文档**。模块按"UE 蓝图式"预制思路拆分，
详见 [docs/design.md](docs/design.md)。

> 注意：`.scene`、`.prefab`、`.meta` 等编辑器资产必须由 Cocos Creator
> 生成，无法脱离编辑器手写，所以本目录只含脚本与数据，场景和 Prefab
> 需要按下面步骤在编辑器里组装一次。

## 使用步骤

1. 用 Cocos Creator **3.8 或更高**新建一个空的 3D 项目。
2. 把本目录的 `assets/scripts/`、`assets/data/` 拷进新项目的 `assets/`，
   打开编辑器等待编译（meta 文件会自动生成）。
3. 项目设置 → 功能裁剪：确认启用 3D 物理（PhysX）。
4. 组装 Prefab（每个都是"模型 + 碰撞体 + 对应组件"）：
   - **Gem**：八面体网格 + SphereCollider + RigidBody(Dynamic, linearDamping≈4) + `Gem`
   - **Dozer**：车身/铲刀模型 + BoxCollider(铲刀) + RigidBody(Kinematic) + `Dozer`
   - **MultiplierGate**：门柱模型 + BoxCollider(isTrigger, 尺寸=门宽) + `TriggerZone` + `MultiplierGate`
   - **CollectZone**：金色圆盘 + CylinderCollider(isTrigger) + `TriggerZone` + `CollectZone`
   - **Hazard**：岩浆面片 + BoxCollider(isTrigger) + `TriggerZone` + `Hazard`
   - **GemSpawner**：空节点 + `GemSpawner`（gemPrefab 拖入 Gem）
   - **FinishLine**：空节点 + BoxCollider(isTrigger) + `TriggerZone`
     （filter=DOZER，eventName 填 `level-finished`）——终点不需要写代码
5. 场景里放：`GameFlow`、`DragInput`、`CameraFollow`（target 指向 Dozer）、
   `HUD`（Canvas 下，拖好 Label/面板引用）、地面与峡谷装饰，
   然后手摆上面的 Prefab，或挂 `LevelLoader` 用
   `assets/data/levels/level01.json` 数据驱动装配。
6. 结算面板"再来一次"按钮的 ClickEvent 绑 `GameFlow.restart`。

## 目录结构

```
assets/
  scripts/
    core/      EventBus, GameEvents, TriggerZone, DragInput, GameFlow, LevelLoader
    gameplay/  Gem, Dozer, GemSpawner, MultiplierGate, CollectZone, Hazard, CameraFollow
    ui/        HUD
  data/
    levels/    level01.json（关卡布局，A/B 变体只改这里）
docs/
  design.md    架构设计、事件清单、Prefab 属性表
```
