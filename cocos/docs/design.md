# Canyon Dozer — Cocos Creator 模块化重构设计

目标：把 three.js 原版重做为 Cocos Creator 3.8+ 项目，各玩法模块像 UE 蓝图一样
**预制成可拖拽资产、参数在编辑器面板可调、模块间靠事件连线**。

## 玩法模型：快递员自动收集

**玩家唯一操作 = 操纵主角走位。** 其余全自动，追求"爽"：

- 主角靠近资源点 → **自动、持续拾取**，携带量飞涨；
- 主角走进投递区 → **自动、持续卸货计分**，数字狂蹦；
- 主角带货穿过倍率门 → **携带量整体翻倍**（多门叠乘，可来回刷）；
- 主角带货踩进危险区（岩浆）→ **掉光携带**，走位要绕开。

资源点由撒布器铺满全场（`nodeCount` 一调就密集），且捡空后自动补充，
保证一路有货可捡 —— 直接解决原型"资源点太少、不够爽"。

## 蓝图能力 → Cocos 对应

| UE 蓝图 | Cocos Creator |
| --- | --- |
| 蓝图类（封装 Actor） | Prefab |
| Details 面板暴露参数 | `@property` 装饰器 |
| 事件引脚连线 | TriggerZone + EventBus / `@property(EventHandler)` 编辑器绑定 |
| DataAsset | JSON 关卡配置（`assets/data/levels/`）+ LevelLoader |

## 架构总览

```
输入层  MoveInput（浮动摇杆，只输出方向）──MOVE_DIR / MOVE_STOP──▶ EventBus
主角    Hero：按方向走位 + 携带量账本；对外暴露 addCarry/takeCarry/multiplyCarry/dropAll
玩法层  ResourceNode（资源点，靠近自动拾取，捡空自动补充）
        DeliveryZone（投递区，进入自动卸货计分）
        MultiplierGate（带货穿门翻倍）  Hazard（带货踩入掉货）
        全部基于 TriggerZone（通用触发区，含持续 overlapping 集合）
撒布    ResourceField：把大量 ResourceNode 铺满场地
流程层  GameFlow（状态机 + 总分 + 目标分判定）
表现层  HUD / CameraFollow / CarryStack —— 只订阅事件，不引用玩法模块
数据层  LevelLoader + level01.json —— 按配置摆 Prefab，A/B 变体只改 JSON
```

模块间**没有任何直接引用**，全部经 `EventBus`（`cc.EventTarget`）通信。
主角不认识资源点/投递区：由这些区在自己的 `update` 里读 TriggerZone 的
`overlapping` 集合，反过来调用 Hero 的公开方法转移资源。删任一 Prefab 都不报错。

## 事件清单（GameEvents.ts）

| 事件 | 发送方 | 订阅方 | 载荷 |
| --- | --- | --- | --- |
| `input-start` | MoveInput | GameFlow, Hero, HUD | — |
| `move-dir` | MoveInput | Hero | dirX, dirZ |
| `move-stop` | MoveInput | Hero | — |
| `resource-picked` | Hero | （特效/音效可订阅） | 本帧量, 携带量 |
| `carry-changed` | Hero | HUD, CarryStack | carrying, capacity |
| `gate-passed` | Hero | HUD | 倍率, 翻倍后携带量 |
| `carry-lost` | Hero | （特效可订阅） | 损失量 |
| `delivered` | DeliveryZone | GameFlow, HUD | 本帧量, 该区累计 |
| `score-changed` | GameFlow | HUD | 总分 |
| `level-finished` | GameFlow / 终点区 | GameFlow, HUD | — |
| `level-reset` | GameFlow.restart() | 所有模块 | — |

## Prefab 属性表

### TriggerZone（core，积木基座）
同节点须挂 isTrigger 的 Collider。资源点/投递区/门/危险区/终点线全由它拼装。
新增：`overlapping: Set<Node>` 供持续检测的模块按帧读取，并发 ENTER/EXIT 本地事件。

| 属性 | 默认 | 说明 |
| --- | --- | --- |
| filter | ANY | ANY / HERO / RESOURCE |
| oncePerTarget | false | 离散事件设 true；持续检测保持 false |
| eventName | '' | 进入时广播到 EventBus 的事件名 |
| onEnterHandlers | [] | 编辑器直连回调 |

### Hero（主角）
| moveSpeed | 6 | 移动速度 |
| capacity | 200 | 最大携带量 |
| turnLerp | 12 | 朝移动方向转身平滑，0=不转 |
| boundX / minZ / maxZ | 6 / -26 / 12 | 活动区范围 |

### ResourceNode（资源点）
| amount | 40 | 初始量（撒布器会随机覆盖） |
| pickupRate | 60 | 每秒拾取速度，越大越爽 |
| respawns / respawnDelay | true / 3 | 捡空后自动补充 |
| pileVisual | — | 表现模型，按剩余量缩放 |

### ResourceField（撒布器）
| nodePrefab / nodeCount | — / 24 | 资源点 Prefab 与个数（调它控制密度） |
| shape / radiusX / radiusZ | RECT / 5.5 / 9 | 撒布形状与范围 |
| amountMin / amountMax | 25 / 55 | 每点资源量区间 |
| minSpacing | 1.6 | 防重叠最小间距 |

### DeliveryZone（投递区）
| deliverRate | 120 | 每秒投递速度 |
| finishOnDeliver | false | 是否投递即通关 |

### MultiplierGate
| multiplier | 2 | 带货穿门时携带量乘该倍率 |

### Hazard
| lossRatio | 1 | 踩入损失比例（1=全掉） |

### CarryStack（携带堆表现）
| itemPrefab / maxVisible / perRow / spacing / unitsPerItem | — | 随携带量在主角身上堆方块 |

### CameraFollow
| target / followLerp / followX | — | 跟随主角 X/Z；LEVEL_RESET 硬切回位 |

### GameFlow
| targetScore | 0 | 目标分，>0 达到即通关；0=纯计分/靠终点线 |

## 关卡装配的两种方式

1. **编辑器手摆**：Prefab 拖进场景，属性面板调参 —— 最接近蓝图工作流。
2. **JSON 数据驱动**：LevelLoader 按 `assets/data/levels/*.json` 实例化，适合出 A/B 变体。

终点结算三选一：投递区设 `finishOnDeliver`、GameFlow 设 `targetScore`，
或在终点摆 `filter=HERO, eventName=level-finished` 的 TriggerZone。

## 相比 three.js 原版修复/改进

| 原版问题 | 本方案 |
| --- | --- |
| 资源点太少、场面稀疏、不够爽 | ResourceField 撒满全场 + 自动补充 + 快速拾取，携带堆可视化增长 |
| 主角交互不对（手动推 / 铲刀伪物理） | 主角只走位，靠近自动拾取、到点自动投递、穿门自动翻倍 |
| 倍率门只判推土机 z 坐标，是装饰 | 门宽即碰撞盒，带货真实穿门翻倍、可叠乘、可刷 |
| 收集区只判 z<-19.3 一条线 | 投递区触发碰撞体，进入才计分 |
| 岩浆无任何效果 | 踩入掉光携带，形成绕行决策 |
| 重开一局相机慢慢飘回 | CameraFollow 在 LEVEL_RESET 硬切回位 |
| 未处理 pointercancel | MoveInput 监听 TOUCH_CANCEL |

## 物理与性能建议

- 物理引擎选 **PhysX**（Creator 3.x 默认）。主角挂 Kinematic RigidBody + 普通
  Collider；资源点/投递区/门/危险区挂 isTrigger Collider，靠碰撞检测主角。
- 资源"堆"是**抽象计数 + 缩放表现**，不再是上百个刚体宝石，性能远好于原型。
- 携带堆用 CarryStack 对象池，`maxVisible` 封顶，避免携带量很大时方块爆炸。
- 分组建议：`HERO` / `TRIGGER` / `GROUND`，碰撞矩阵里只保留必要项。
