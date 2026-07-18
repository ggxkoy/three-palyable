# Canyon Dozer — Cocos Creator 模块化重构设计

目标：把 three.js 原版重做为 Cocos Creator 3.8+ 项目，各玩法模块像 UE 蓝图一样
**预制成可拖拽资产、参数在编辑器面板可调、模块间靠事件连线**。

## 蓝图能力 → Cocos 对应

| UE 蓝图 | Cocos Creator |
| --- | --- |
| 蓝图类（封装 Actor） | Prefab |
| Details 面板暴露参数 | `@property` 装饰器 |
| 事件引脚连线 | TriggerZone + EventBus / `@property(EventHandler)` 编辑器绑定 |
| DataAsset | JSON 关卡配置（`assets/data/levels/`）+ LevelLoader |

## 架构总览

```
输入层   DragInput ──INPUT_START / DRAG_DELTA──▶ EventBus
玩法层   Dozer / MultiplierGate / CollectZone / Hazard / GemSpawner
         全部基于 TriggerZone（通用触发区）做真实碰撞判定
流程层   GameFlow（状态机 + 计分中枢）
表现层   HUD / CameraFollow —— 只订阅事件，不引用玩法模块
数据层   LevelLoader + level01.json —— 按配置摆 Prefab，A/B 变体只改 JSON
```

模块间**没有任何直接引用**，全部经 `EventBus`（`cc.EventTarget`）通信，
任何 Prefab 从场景删除都不会导致其它模块报错。

## 事件清单（GameEvents.ts）

| 事件 | 发送方 | 订阅方 | 载荷 |
| --- | --- | --- | --- |
| `input-start` | DragInput | GameFlow, Dozer, HUD | — |
| `drag-delta` | DragInput | Dozer | dx |
| `gate-passed` | MultiplierGate | HUD | gemNode, 新倍率 |
| `gem-collected` | CollectZone | GameFlow | gemNode, 分值 |
| `gem-destroyed` | Hazard | GameFlow | gemNode, 扣分 |
| `score-changed` | GameFlow | HUD | 总分 |
| `level-finished` | 终点 TriggerZone | GameFlow, Dozer, HUD | — |
| `level-reset` | GameFlow.restart() | 所有模块 | — |

## Prefab 属性表

### TriggerZone（core，积木基座）
同节点须挂 isTrigger 的 Collider。门/收集区/岩浆/终点线全部由它拼装。

| 属性 | 默认 | 说明 |
| --- | --- | --- |
| filter | ANY | 触发对象过滤：ANY / GEM / DOZER |
| oncePerTarget | true | 同一对象只触发一次 |
| eventName | '' | 触发时广播到 EventBus 的事件名 |
| onEnterHandlers | [] | 编辑器直连回调（蓝图式连线） |

### MultiplierGate
| multiplier | 2 | 穿门宝石分值乘该倍率，多门叠乘 |

### CollectZone
| absorbAnimation / absorbDuration | true / 0.25 | 吸入表现 |

### Hazard
| scorePenalty | 0 | 宝石掉入的扣分（0=只销毁） |

### Dozer
| forwardSpeed | 4.25 | 前进速度 |
| steerLerp | 8 | 横向跟手度 |
| clampX | 5.4 | 横向限位 |

### GemSpawner
| gemPrefab / count / shape / radiusX / radiusZ / spawnY | — | 数量与分布 |

### CameraFollow
| target / offsetZ / followLerp | — | 跟随参数；LEVEL_RESET 时硬切回起点 |

## 关卡装配的两种方式

1. **编辑器手摆**：把 Prefab 拖进场景，属性面板调参 —— 最接近蓝图工作流。
2. **JSON 数据驱动**：LevelLoader 按 `assets/data/levels/*.json` 实例化，
   适合 playable 广告出 A/B 难度变体。

终点判定不需要专门代码：在终点 z 位置摆一个
`filter=DOZER, eventName=level-finished` 的 TriggerZone 即可。

## 相比 three.js 原版修复的设计缺陷

| 原版问题 | 本方案 |
| --- | --- |
| 倍率门只判推土机 z 坐标，门是装饰 | 门宽即碰撞盒，逐颗宝石真实判定、可叠乘、可多门 |
| 收集区只判 z<-19.3 一条线 | 圆柱形触发碰撞体，出圈不计分 |
| 岩浆无任何效果 | Hazard 销毁宝石（可选扣分），走桥成为真实决策 |
| 手写伪物理推挤 | 宝石 Dynamic 刚体 + 铲刀碰撞体，交给物理引擎 |
| 重开一局相机慢慢飘回 | CameraFollow 在 LEVEL_RESET 硬切回位 |
| 未处理 pointercancel | DragInput 监听 TOUCH_CANCEL |

## 物理设置建议

- 物理引擎选 **PhysX**（Creator 3.x 默认）；宝石多（145 颗）时把宝石刚体
  的 `linearDamping` 调高（≈4）复现原版急停手感。
- 分组：`GEM` / `DOZER` / `TRIGGER` / `GROUND`，宝石与宝石之间碰撞可关掉
  （矩阵里取消 GEM×GEM）换性能，视手感取舍。
- 宝石 Prefab 用低面数 Octahedron 网格；如需进一步省 draw call，
  开启 Creator 的静态合批 / GPU instancing（同材质自动合批）。
