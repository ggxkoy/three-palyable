/**
 * 全局事件名与载荷类型定义。
 * 所有模块之间只通过这些事件通信，相当于蓝图里的事件引脚清单。
 * 新增玩法模块时先在这里登记事件，再在设计文档的事件表里补一行。
 */
export const GameEvents = {
  /** 玩家首次按下，游戏从待机进入进行中。载荷：无 */
  INPUT_START: 'input-start',
  /** 拖拽横向位移。载荷：dx（屏幕像素） */
  DRAG_DELTA: 'drag-delta',
  /** 宝石穿过倍率门。载荷：gemNode, multiplier（翻倍后的值） */
  GATE_PASSED: 'gate-passed',
  /** 宝石进入收集区。载荷：gemNode, value（含倍率的分值） */
  GEM_COLLECTED: 'gem-collected',
  /** 宝石被危险区销毁。载荷：gemNode */
  GEM_DESTROYED: 'gem-destroyed',
  /** 分数变化。载荷：score（当前总分） */
  SCORE_CHANGED: 'score-changed',
  /** 推土机到达终点。载荷：无 */
  LEVEL_FINISHED: 'level-finished',
  /** 重开一局。载荷：无 */
  LEVEL_RESET: 'level-reset',
} as const;

export type GameEventName = (typeof GameEvents)[keyof typeof GameEvents];
