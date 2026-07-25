# Canyon Courier 3D — 可直接运行的 Cocos Creator 工程

竖屏 playable，**3D 版**。玩法为快递员自动收集：玩家只用摇杆操纵推土机在场地里走位，
靠近资源自动装货、进投递区自动卸货计分、带货穿倍率门整堆翻倍、踩岩浆掉光。

## 直接跑起来

1. Cocos Creator **3.8+** → 打开项目 → 选择本目录 `cocos-project-3d/`。
2. 打开 `assets/scenes/main.scene`，点预览（▶）。

**不需要任何模型资源，也不需要拼节点或 Prefab。** 世界里的每个物件
（推土机、水晶、岩壁、岩浆、倍率门、投递台）都是用 Cocos 内置的参数化几何体
（box / sphere / cylinder / torus / plane）在运行时生成的，材质也由代码创建 ——
见 `assets/scripts/core/Prims.ts` 和 `Bootstrap.ts`。

> 若 `main.scene` 因编辑器版本差异打不开：新建一个空场景直接预览即可，效果一样。
> Bootstrap 在脚本加载时挂 `Director.EVENT_AFTER_SCENE_LAUNCH`，任何场景启动都会自动装配。

## 3D 与 2D 版的区别

| | 3D（本目录） | 2D（`cocos-project/`） |
| --- | --- | --- |
| 世界表现 | 内置几何体 + 双平行光 | sprite 图片 |
| 判定平面 | XZ（贴地） | XY |
| 相机 | 正交 3/4 俯视（俯角 60°），跟随主角 | UI 正交，滚动世界节点 |
| 资源 | 无需图片（UI 除外） | 12 张生成的 PNG |

两版的玩法逻辑、事件总线、模块划分完全一致，`DeliveryZone` / `MultiplierGate` /
`Hazard` / `GameFlow` / `HUD` 等模块是同一份代码。

## 无头玩法验证

玩法逻辑可以脱离 Cocos 编辑器验证：用假的 `cc` 运行时在 Node 里跑完整链路，
**28 项断言**（含 XZ 平面判定与摇杆→世界方向映射）。

```bash
cd tools/sim
npm install
npm test
```

## 调"爽"的旋钮

| 想要 | 改哪里 |
| --- | --- |
| 资源点更密集 | `Bootstrap.ts` 里 `rf.nodeCount`（默认 30，抖动网格保证撒满） |
| 装货更快、数字蹦更猛 | `ResourceField.pickupRate` / `DeliveryZone.deliverRate` |
| 能囤更多再一次性投递 | `Hero.capacity`（默认 240） |
| 倍率门收益上限 | `Hero.overflowFactor`（默认 2 → 携带最高 480） |
| 主角更灵活 | `Hero.moveSpeed`（默认 8 单位/秒）、`turnLerp` |
| 镜头远近 / 俯角 | `Bootstrap.ts` 里 `cam.orthoHeight`、`MainCamera` 的欧拉角 |
| 场地范围、各区位置 | `Bootstrap.ts` 顶部的 `L` 常量表 |
| 配色 | `Bootstrap.ts` 顶部的 `M` 材质表 |

## 可选：打开阴影

为降低首次运行的风险，工程没有动场景全局设置，所以默认没有实时阴影
（靠主光 + 补光双平行光塑形）。想要阴影：在编辑器里选中场景根节点，
在属性面板的 **Shadows** 里勾选 `Enabled` 并把 type 设为 `ShadowMap`，
再把 `KeyLight` 的 `Shadow Enabled` 打开即可。

## 目录

```
assets/
  scenes/main.scene           空场景（内容由 Bootstrap 运行时生成）
  resources/sprites/          仅 UI 用的 3 张图（HUD 底板、摇杆）
  scripts/
    Bootstrap.ts              运行时搭建整个 3D 游戏
    core/                     Prims（几何体/材质工具）, EventBus, GameEvents,
                              TriggerZone, MoveInput, GameFlow, Sprites
    gameplay/                 Hero, ResourceNode, ResourceField, DeliveryZone,
                              MultiplierGate, Hazard, CarryStack, CameraFollow
    ui/                       HUD
tools/sim/                    无头玩法验证（假 cc 运行时 + 28 项断言）
docs/design.md                架构、事件清单、组件属性表
```
