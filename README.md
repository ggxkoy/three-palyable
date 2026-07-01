# Canyon Dozer Playable

基于 Three.js、TypeScript 和 Vite 构建的竖屏推土机 playable。玩家拖拽控制推土机，把破碎机持续产出的宝石堆推向峡谷深处：每道倍率门（×10、×50）都需要投入一定量的金币"缺口"才会解锁，投入的部分会消耗掉，解锁后通过的宝石则升级成更高阶的材质（蓝宝石→金币→粉钻），期间还要留意较窄的熔岩木桥，别把堆子推散掉进岩浆；破碎机自身也会随时间升级产出量，途中会有一次铲斗升级站，最终把最高阶宝石送入终点收集区结算分数。

## 参考视频

下载的视频已保存在项目内的 `reference/` 目录：

| 来源 | 项目相对路径 | 本机绝对路径 |
| --- | --- | --- |
| [YouTube Shorts: lkd3MqLlR4I](https://www.youtube.com/shorts/lkd3MqLlR4I) | `reference/source.mp4` | `C:\Users\16647\Downloads\微信视频号\canyon-dozer-playable\reference\source.mp4` |
| [YouTube Shorts: DBriahKSsOs](https://www.youtube.com/shorts/DBriahKSsOs) | `reference/source-DBriahKSsOs.mp4` | `C:\Users\16647\Downloads\微信视频号\canyon-dozer-playable\reference\source-DBriahKSsOs.mp4` |
| [YouTube Shorts: 1rb_UJG4cd4](https://www.youtube.com/shorts/1rb_UJG4cd4) | `reference/source-1rb_UJG4cd4.mp4` | `C:\Users\16647\Downloads\微信视频号\canyon-dozer-playable\reference\source-1rb_UJG4cd4.mp4` |

`reference/contact-sheet.jpg` 是首个视频的分析用采样画面。

## 运行

```bash
npm install
npm run dev
```

默认开发地址为 `http://127.0.0.1:5173/`。

## 构建

```bash
npm run build
```

构建产物输出到 `dist/`。
