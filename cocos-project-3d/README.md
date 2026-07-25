# Canyon Dozer — Cocos Creator 3.8.8 工程

这是从 `ggxkoy/three-palyable` 的 `claude/cocos-blueprint-modules` 分支整理出的独立 Cocos Creator 工程。

## 打开方式

1. 启动 Cocos Dashboard 或 Cocos Creator 3.8.8。
2. 选择“导入项目”。
3. 选择本目录。
4. 首次打开时等待资源导入和 TypeScript 编译完成。

也可以在 macOS 终端运行：

```bash
/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator --project "$(pwd)"
```

## 当前内容

- `assets/scripts/core/`：事件、流程、输入、触发区和关卡加载。
- `assets/scripts/reference/`：参考视频玩法，包括推土机、动态资源、倍率门、铺桥和 HUD。
- `assets/scripts/gameplay/`：原蓝图分支的快递员模块，作为模块化设计参考保留。
- `assets/scripts/ui/`：HUD。
- `assets/data/levels/level01.json`：关卡布局数据。
- `docs/`：原分支蓝图说明与设计文档。

本工程已整理为 Cocos Creator 可识别、可直接预览的项目结构。由于原分支没有提供场景、Prefab 和美术资产，`assets/scenes/main.scene` 会通过 `PlayableBootstrap` 在运行时使用基础几何体组装一关。当前激活的玩法以 `reference/source.mp4` 为主参考；正式制作时可逐步替换成美术模型和 Prefab。

## 操作方式

- 鼠标或触屏：按住并向目标方向拖动。
- 桌面键盘：WASD 或方向键。
- 目标：驾驶黄色推土机推动蓝色宝石，穿过橙色 ×10 刷门将其转换为金币，再把金币推进收集槽完成岩浆桥并进入新区。

## 验证结果

- Cocos Creator 3.8.8：项目可导入并正常启动。
- 资源数据库：推土机玩法组件、原蓝图脚本、主场景及关卡数据均已完成导入，`.meta` 文件已由编辑器生成。
- TypeScript：使用 Cocos Creator 3.8.8 内置编译器检查通过。
- 编辑器日志：重新导入后没有项目脚本错误或警告。
- Web Mobile：构建产物位于 `build/web-mobile/`，已在浏览器实际运行。
- 玩法诊断：自动路线完成动态资源推动、×10 转换、250/250 铺桥、跨越岩浆和新区解锁；运行时控制台无新增错误或警告。

整理时修正了 `Hero.maxZ` 的编辑器属性类型声明：Cocos Creator 3.8 要求显式数值属性使用 `CCFloat` 或 `CCInteger`，不能使用空类型或通用 `Number`。

诊断模式仅用于回归测试：在 Web 地址后添加 `?autotest=1`，推土机会自动跑完整条验证路线，普通地址不受影响。
