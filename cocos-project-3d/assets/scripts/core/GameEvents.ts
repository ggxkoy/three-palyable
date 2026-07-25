/**
 * 全局事件名清单，相当于蓝图的事件引脚表。
 *
 * 玩法模型（快递员自动收集）：
 *   玩家唯一操作 = 摇杆操纵主角走位。
 *   靠近资源自动拾取、进投递区自动投递、穿门自动翻倍、踩岩浆掉货。
 */
export const GameEvents = {
  /** 玩家首次操作。载荷：无 */
  INPUT_START: 'input-start',
  /** 移动方向。载荷：dirX, dirY（单位向量 × 力度 0..1） */
  MOVE_DIR: 'move-dir',
  /** 停止移动。载荷：无 */
  MOVE_STOP: 'move-stop',

  /** 拾取到资源。载荷：amount（本帧量）, carrying */
  RESOURCE_PICKED: 'resource-picked',
  /** 携带量变化。载荷：carrying, capacity */
  CARRY_CHANGED: 'carry-changed',
  /** 穿过倍率门。载荷：factor, carrying（翻倍后） */
  GATE_PASSED: 'gate-passed',
  /** 携带被危险区清空。载荷：lost */
  CARRY_LOST: 'carry-lost',
  /** 投递成功。载荷：amount（本帧量）, zoneTotal */
  DELIVERED: 'delivered',
  /** 总分变化。载荷：score */
  SCORE_CHANGED: 'score-changed',

  /** 通关。载荷：无 */
  LEVEL_FINISHED: 'level-finished',
  /** 重开一局。载荷：无 */
  LEVEL_RESET: 'level-reset',
} as const;

export type GameEventName = (typeof GameEvents)[keyof typeof GameEvents];
