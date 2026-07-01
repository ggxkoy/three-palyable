# Crystal Canyon Playable

基于 Three.js、TypeScript 和 Vite 构建的竖屏挖矿 playable。玩家先点击敲碎开场的晶石获得启动资金，之后小车会沿着一条比屏幕大得多的蜿蜒峡谷路线自动前进，沿途嵌在路上的矿石会被动自动采集、金币持续累积；路边有可点击的升级站，花钱升级采矿工具能让后段更高阶的矿石（蓝宝石→金币→粉钻→白钻）产出更多金币；路上还有需要攒够金币才能通行的关卡闸门，付款后会有一笔奖励金币入账，随后解锁下一段更高级的矿区，最终抵达终点宝箱结算本轮收集的金币总数。

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
