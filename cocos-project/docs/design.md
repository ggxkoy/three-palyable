# Canyon Courier — 架构设计

2D sprite 版 Cocos Creator 3.8+ 工程。模块像 UE 蓝图一样拆分：
**每个玩法元素是独立组件 + 编辑器可调 `@property`，模块之间只通过事件通信。**

## 玩法模型：快递员自动收集

**玩家唯一操作 = 摇杆操纵主角走位。** 其余全自动：

- 靠近资源点 → **自动持续装货**，携带堆在车头前方越堆越高；
- 走进投递区 → **自动持续卸货计分**，分数滚动增长；
- 带货穿倍率门 → **整堆翻倍**（可超出 capacity，封顶 capacity × overflowFactor）；
- 带货踩岩浆 → **掉光**，中央留有安全通道，走位要绕。

资源点由抖动网格撒满全场（`nodeCount` 一调就密集），捡空后自动补充，
保证一路有货可捡。

## 为什么不用物理系统

2D playable 里资源/投递/门/岩浆的判定都是简单的圆或矩形重叠，
用距离判定比挂一整套 PhysX 更轻、更好调，也省掉了碰撞分组配置。
`TriggerZone` 因此自己做重叠检测：`TriggerActor`（挂在主角上）注册进静态表，
每个 `TriggerZone` 每帧检一次。API 与物理触发器一致（`overlapping` 集合 +
ENTER/EXIT 事件），玩法模块感知不到差别。

`TriggerZone` 标了 `@executionOrder(-100)`，保证重叠状态早于读取它的
`ResourceNode` / `DeliveryZone` 刷新。

## 架构总览

```
输入层  MoveInput（浮动摇杆，只输出方向）──MOVE_DIR / MOVE_STOP──▶ EventBus
主角    Hero：按方向走位 + 携带量账本
        对外暴露 addCarry / takeCarry / multiplyCarry / dropAll，由各区调用
玩法层  ResourceNode（靠近自动装货，捡空自动补充）
        DeliveryZone（进入自动卸货计分）
        MultiplierGate（带货穿门整堆翻倍）
        Hazard（带货踩入掉货）
        —— 全部基于 TriggerZone
撒布    ResourceField：抖动网格撒满 nodeCount 个 ResourceNode
流程层  GameFlow（状态机 + 总分 + 目标分/限时判定）
表现层  HUD / CameraFollow / CarryStack —— 只订阅事件，不引用玩法模块
装配    Bootstrap：运行时把上面这些搭成完整场景
```

模块间**没有任何直接引用**。主角不认识资源点，是各区在自己的 `update` 里
读 `TriggerZone.overlapping`，反过来调 Hero 的公开方法转移资源。
删掉任一模块都不会让其它模块报错。

## 事件清单（GameEvents.ts）

| 事件 | 发送方 | 订阅方 | 载荷 |
| --- | --- | --- | --- |
| `input-start` | MoveInput | GameFlow, HUD | — |
| `move-dir` | MoveInput | Hero | dirX, dirY |
| `move-stop` | MoveInput | Hero | — |
| `resource-picked` | Hero | （特效/音效可订阅） | 本帧量, 携带量 |
| `carry-changed` | Hero | HUD, CarryStack | carrying, capacity |
| `gate-passed` | Hero | HUD | 倍率, 翻倍后携带量 |
| `carry-lost` | Hero | HUD | 损失量 |
| `delivered` | DeliveryZone | GameFlow | 本帧量, 该区累计 |
| `score-changed` | GameFlow | HUD | 总分 |
| `level-finished` | GameFlow / 终点区 | GameFlow, Hero, HUD | — |
| `level-reset` | GameFlow.restart() | 所有模块 | — |

## 组件属性表

### TriggerZone（core，积木基座）
| 属性 | 默认 | 说明 |
| --- | --- | --- |
| shape | CIRCLE | CIRCLE / RECT |
| radius | 90 | 圆形判定半径 |
| halfWidth / halfHeight | 160 / 60 | 矩形半宽半高 |
| oncePerTarget | false | 离散事件设 true；持续检测保持 false |
| eventName | '' | 进入时广播到 EventBus 的事件名 |
| onEnterHandlers | [] | 编辑器直连回调（蓝图式连线） |

### Hero
| moveSpeed | 620 | 移动速度（像素/秒） |
| capacity | 240 | 最大携带量（限制拾取） |
| overflowFactor | 2 | 倍率门可撑到 capacity × 该值；同时是刷门的硬顶 |
| turnLerp | 14 | 转身平滑，0 = 不转身 |
| boundX / minY / maxY | — | 活动区范围 |

### ResourceNode
| amount | 40 | 初始量（由 ResourceField 随机覆盖） |
| pickupRate | 70 | 每秒拾取速度 |
| respawns / respawnDelay | true / 3.5 | 捡空后自动补充 |
| pileVisual | — | 随剩余量缩放，补充时弹出 |

### ResourceField
| nodeCount | 30 | 资源点个数（控制密度） |
| shape | RECT | RECT（抖动网格）/ CIRCLE（向日葵螺旋） |
| halfWidth / halfHeight | 250 / 340 | 撒布范围 |
| amountMin / amountMax | 26 / 58 | 每点资源量区间 |
| jitter | 0.62 | 0 = 规整网格，1 = 完全随机 |

> 早先用"随机取点 + 最小间距重试"撒布，密集配置下会撒不满
> （要 30 个只落 19 个，`nodeCount` 形同虚设），已改为抖动网格，点数精确。

### DeliveryZone
| deliverRate | 160 | 每秒投递速度 |
| finishOnDeliver | false | 投递即通关 |

### MultiplierGate / Hazard
| multiplier | 2 | 穿门时携带量乘该倍率 |
| lossRatio | 1 | 踩入损失比例 |

### CarryStack / CameraFollow / HUD / GameFlow
| maxVisible / perRow / unitsPerItem | 34 / 5 / 6 | 携带堆显示 |
| screenAnchorY / followLerp | -180 / 7 | 主角在屏幕上的锚定高度 |
| carryBarWidth / resultDelay | 220 / 0.5 | HUD |
| targetScore / timeLimit | 0 / 0 | >0 时启用目标分 / 限时 |

## 关卡布局

`Bootstrap.ts` 顶部的 `L` 常量表就是关卡配置（各区 y 位置、场地范围）。
自下而上：出生点 → 资源区 → 岩浆带（中央留通道）→ 倍率门（比通道窄，
绕开就吃不到）→ 投递区。

两条设计约束，改布局时要保持：
- 资源区下缘与出生点的间距必须 > 拾取半径，否则**开局就自动装货**、
  重开后也会立刻又装上。
- 地面上下都要留出足够余量，否则相机滚到两端会露出画布底色。

## 已验证的行为

`tools/sim` 用假 cc 运行时跑完整链路，26 项断言全过（`npm test`）：
资源撒满 30 个 / 靠近自动装货 / 容量封顶 / 岩浆掉货 / 安全通道不掉货 /
穿门翻倍且满载仍有收益 / 反复刷门被封顶 / 绕开门不翻倍 / 投递计分对账 /
捡空自动补充 / 通关冻结 / 重开归位。
