# Canyon Courier — 可直接运行的 Cocos Creator 工程

竖屏 playable，2D sprite 版本。玩法为**快递员自动收集**：玩家只用摇杆操纵主角走位，
靠近资源自动装货、进投递区自动卸货计分、带货穿倍率门整堆翻倍、踩岩浆掉光。

## 直接跑起来

1. Cocos Creator **3.8+** → 打开项目 → 选择本目录 `cocos-project/`。
2. 编辑器完成资源导入后，打开 `assets/scenes/main.scene`。
3. 点预览（▶）。**不需要拼任何节点或 Prefab** —— 场景在运行时由
   `assets/scripts/Bootstrap.ts` 全部搭出来（相机、地形、玩法模块、UI、摇杆）。

> 若 `main.scene` 因编辑器版本差异打不开：新建一个空场景直接预览即可，效果一样。
> Bootstrap 在脚本加载时挂 `Director.EVENT_AFTER_SCENE_LAUNCH`，任何场景启动都会自动装配。

## Sprite 资源

`assets/resources/sprites/` 下的 12 张图（主角、水晶、资源堆、投递台、倍率门、
岩浆、地面、岩石、摇杆、面板）均由 `tools/make_sprites.py` 用纯 Python 生成
（无需 PIL），改配色或尺寸后重跑即可：

```bash
python3 tools/make_sprites.py
```

放在 `resources/` 下是为了能用 `resources.load()` 按名取用，
省掉在编辑器里逐个拖引用 —— 见 `assets/scripts/core/Sprites.ts`。

## 无头玩法验证

玩法逻辑可以脱离 Cocos 编辑器验证：用一个假的 `cc` 运行时在 Node 里跑完整链路
（拾取 → 装满 → 掉货 → 翻倍 → 投递 → 补充 → 通关 → 重开），26 项断言。

```bash
cd tools/sim
npm install
npm test
```

改完玩法逻辑跑一遍，能在打开编辑器之前就抓住回归。

## 调"爽"的旋钮

| 想要 | 改哪里 |
| --- | --- |
| 资源点更密集 | `Bootstrap.ts` 里 `rf.nodeCount`（默认 30，抖动网格保证撒满） |
| 装货更快、数字蹦更猛 | `ResourceNode.pickupRate` / `DeliveryZone.deliverRate` |
| 能囤更多再一次性投递 | `Hero.capacity`（默认 240） |
| 倍率门收益上限 | `Hero.overflowFactor`（默认 2 → 携带最高 480） |
| 场地范围、各区位置 | `Bootstrap.ts` 顶部的 `L` 常量表 |
| 资源补充速度 | `ResourceNode.respawnDelay`（默认 3.5s） |

## 目录

```
assets/
  scenes/main.scene           空场景（内容由 Bootstrap 运行时生成）
  resources/sprites/*.png     12 张 sprite，可用 resources.load 按名取
  scripts/
    Bootstrap.ts              运行时搭建整个游戏（相机/地形/玩法/UI）
    core/                     EventBus, GameEvents, TriggerZone, MoveInput,
                              GameFlow, Sprites
    gameplay/                 Hero, ResourceNode, ResourceField, DeliveryZone,
                              MultiplierGate, Hazard, CarryStack, CameraFollow
    ui/                       HUD
tools/
  make_sprites.py             生成 sprite 资源
  sim/                        无头玩法验证（假 cc 运行时 + 26 项断言）
docs/design.md                架构、事件清单、组件属性表
```
