/**
 * 全局事件名与载荷定义。模块间只通过这些事件通信，相当于蓝图的事件引脚清单。
 *
 * 玩法模型（快递员自动收集）：
 *   玩家唯一操作 = 操纵主角走位（MOVE_DIR）。
 *   主角靠近资源点自动拾取、到投递区自动投递、穿过倍率门自动翻倍。
 */
export const GameEvents = {
  /** 玩家首次操作，游戏从待机进入进行中。载荷：无 */
  INPUT_START: 'input-start',
  /** 移动方向（摇杆/拖拽）。载荷：dirX, dirZ（世界平面单位向量，模长 0..1） */
  MOVE_DIR: 'move-dir',
  /** 停止移动。载荷：无 */
  MOVE_STOP: 'move-stop',

  /** 主角从某资源点拾取。载荷：amount（本帧拾取量）, heroCarry（拾取后携带量） */
  RESOURCE_PICKED: 'resource-picked',
  /** 主角携带量变化。载荷：carrying, capacity */
  CARRY_CHANGED: 'carry-changed',
  /** 主角穿过倍率门，携带量翻倍。载荷：multiplier, carrying（翻倍后携带量） */
  GATE_PASSED: 'gate-passed',
  /** 携带资源被危险区清空。载荷：lost（损失量） */
  CARRY_LOST: 'carry-lost',
  /** 投递区收到资源。载荷：amount（本帧投递量）, score（当前总分） */
  DELIVERED: 'delivered',
  /** 分数变化。载荷：score */
  SCORE_CHANGED: 'score-changed',

  /** 到达终点/达成目标。载荷：无 */
  LEVEL_FINISHED: 'level-finished',
  /** 重开一局。载荷：无 */
  LEVEL_RESET: 'level-reset',
} as const;

export type GameEventName = (typeof GameEvents)[keyof typeof GameEvents];
