# Canyon Courier 3D — 架构设计

Cocos Creator 3.8+ 3D 工程。模块像 UE 蓝图一样拆分：
**每个玩法元素是独立组件 + 编辑器可调 `@property`，模块之间只通过事件通信。**

## 玩法模型：快递员自动收集

**玩家唯一操作 = 摇杆操纵主角在 XZ 平面走位。** 其余全自动：

- 靠近资源点 → **自动持续装货**，水晶堆在铲刀前方越堆越高；
- 走进投递区 → **自动持续卸货计分**，分数滚动增长；
- 带货穿倍率门 → **整堆翻倍**（可超出 capacity，封顶 capacity × overflowFactor）；
- 带货踩岩浆 → **掉光**，中央留有安全通道，走位要绕。

资源点由抖动网格撒满全场（`nodeCount` 一调就密集），捡空后自动补充。

## 为什么世界里没有模型资源

推土机、水晶、岩壁、岩浆、门、投递台全部由 `Prims` 用 Cocos 内置的参数化几何体
（box / sphere / cylinder / torus / plane）在运行时拼出来，材质也用代码创建。
好处：工程丢进编辑器就能跑，不需要美术资源管线，也不需要手工拼 Prefab。

`Prims` 对网格和材质都做了缓存 —— 同色物件共享材质，同类物件共享单位网格
（靠节点缩放变形），所以几百个物件也只有很少的 draw call。
低多边形观感来自刻意压低的 `segments`（岩石/水晶用 4~5 段的球）。

灯光用主光 + 补光两盏平行光塑形，没有开实时阴影（见 README 里的开启方式），
这样不必在运行时改动场景全局设置。

## 为什么不用物理系统

这是一个贴地行走的游戏，资源/投递/门/岩浆的判定都发生在 **XZ 平面**上，
是简单的圆或矩形重叠。距离判定比挂一整套 PhysX 更轻、更好调，
也省掉了碰撞分组配置。

`TriggerZone` 因此自己做重叠检测：`TriggerActor`（挂在主角上）注册进静态表，
每个 `TriggerZone` 每帧检一次。API 与物理触发器一致（`overlapping` 集合 +
ENTER/EXIT 事件），玩法模块感知不到差别。

`TriggerZone` 标了 `@executionOrder(-100)`，保证重叠状态早于读取它的
`ResourceNode` / `DeliveryZone` 刷新。

## 架构总览

```
输入层  MoveInput（浮动摇杆，只输出屏幕方向）──MOVE_DIR / MOVE_STOP──▶ EventBus
主角    Hero：把屏幕方向映射为世界 XZ（屏幕上 = -Z）+ 转向 + 携带量账本
        对外暴露 addCarry / takeCarry / multiplyCarry / dropAll，由各区调用
玩法层  ResourceNode（靠近自动装货，捡空自动补充）
        DeliveryZone（进入自动卸货计分）
        MultiplierGate（带货穿门整堆翻倍）
        Hazard（带货踩入掉货）
        —— 全部基于 TriggerZone
撒布    ResourceField：抖动网格撒满 nodeCount 个 ResourceNode
流程层  GameFlow（状态机 + 总分 + 目标分/限时判定）
表现层  HUD / CameraFollow / CarryStack —— 只订阅事件，不引用玩法模块
工具层  Prims（几何体/材质，带缓存）、Sprites（UI 图）
装配    Bootstrap：运行时把上面这些搭成完整场景
```

模块间**没有任何直接引用**。主角不认识资源点，是各区在自己的 `update` 里
读 `TriggerZone.overlapping`，反过来调 Hero 的公开方法转移资源。

## 坐标与朝向约定

- 主角朝 **-Z** 方向前进（投递区在 -Z 端，出生点在 +Z 端）。
- 摇杆输出屏幕方向 `(x, y)`，`Hero` 内部映射为 `(x, 0, -y)` —— 屏幕上 = 世界 -Z。
- 推土机模型朝 **+Z** 搭建（铲刀在 +Z），所以 `yaw = atan2(dirX, dirZ)` 即可对准移动方向，
  出生朝向 yaw = 180°（面朝 -Z）。
- 相机俯角 60°，`z 偏移 = 高度 / tan(60°)`，这样正好对准主角。
  俯角越大越接近正上方俯视，z 方向的视野拉伸越小。

## 事件清单（GameEvents.ts）

| 事件 | 发送方 | 订阅方 | 载荷 |
| --- | --- | --- | --- |
| `input-start` | MoveInput | GameFlow, HUD | — |
| `move-dir` | MoveInput | Hero | dirX, dirY（屏幕方向） |
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
| shape | CIRCLE | CIRCLE（XZ 距离）/ BOX（XZ 半宽半长） |
| radius | 2 | 圆柱判定半径 |
| halfX / halfZ | 3 / 1 | 长方体半宽/半长 |
| oncePerTarget | false | 离散事件设 true；持续检测保持 false |
| eventName | '' | 进入时广播到 EventBus 的事件名 |
| onEnterHandlers | [] | 编辑器直连回调（蓝图式连线） |

### Hero
| moveSpeed | 8 | 移动速度（单位/秒） |
| capacity | 240 | 最大携带量（限制拾取） |
| overflowFactor | 2 | 倍率门可撑到 capacity × 该值；同时是刷门的硬顶 |
| turnLerp | 12 | 转身平滑，0 = 不转身 |
| boundX / minZ / maxZ | 4 / -21 / 10 | 活动区范围 |

### ResourceNode / ResourceField
| amount / pickupRate | 40 / 70 | 单点资源量与每秒拾取速度 |
| respawns / respawnDelay | true / 3.5 | 捡空后自动补充 |
| nodeCount | 30 | 资源点个数（控制密度） |
| halfX / halfZ | 3.5 / 5.8 | 撒布范围 |
| pickupRadius | 1.8 | 拾取范围 |
| jitter | 0.62 | 0 = 规整网格，1 = 完全随机 |

> 早先用"随机取点 + 最小间距重试"撒布，密集配置下会撒不满
> （要 30 个只落 19 个，`nodeCount` 形同虚设），已改为抖动网格，点数精确。

### DeliveryZone / MultiplierGate / Hazard
| deliverRate | 170 | 每秒投递速度 |
| multiplier | 2 | 穿门时携带量乘该倍率 |
| lossRatio | 1 | 踩入损失比例 |

### CarryStack / CameraFollow / GameFlow
| maxVisible / perRow / rowsPerLayer | 42 / 5 / 3 | 铲刀前的水晶堆排布 |
| offset / followLerp / followXRatio | (0,14,8.1) / 6 / 0.45 | 相机跟随 |
| targetScore / timeLimit | 0 / 0 | >0 时启用目标分 / 限时 |

## 关卡布局

`Bootstrap.ts` 顶部的 `L` 常量表就是关卡配置。自 +Z 向 -Z：
出生点(z=9) → 资源区(z=0.5±5.8) → 岩浆带(z=-8.5，中央留 |x|<1.9 的通道)
→ 倍率门(z=-13，|x|<2.1) → 投递区(z=-19)。

两条设计约束，改布局时要保持：
- 资源区靠出生点一侧的边缘与出生点的间距必须 > 拾取半径，否则**开局就自动装货**，
  重开后也会立刻又装上。
- 倍率门比场地窄（门 ±2.1，场地 ±4.0），所以过了岩浆后可以横move 绕开门 ——
  这保证"穿门"是一个位置选择而不是必经之路。

## 已验证的行为

`tools/sim` 用假 cc 运行时跑完整链路，28 项断言全过（`npm test`）：
资源撒满 30 个 / 靠近自动装货 / 容量封顶 / 岩浆掉货 / 中央通道不掉货 /
穿门翻倍且满载仍有收益 / 反复刷门被封顶 / 侧面绕门不翻倍 / 投递计分对账 /
捡空自动补充 / 摇杆方向到世界 XZ 的映射 / 通关冻结 / 重开归位。

## 下一步可加的决策深度

当前"穿门"没有代价，理性玩家总会穿。想要真正的取舍，最自然的加法是
**并排多条门道**（同一 z 上放 2~3 个 `MultiplierGate`，倍率不同），
并把高倍率那条放在岩浆缺口更窄的一侧 —— 只需在 `Bootstrap.buildGate` 里
多摆几个节点、各自设 `multiplier`，玩法代码不用改。
