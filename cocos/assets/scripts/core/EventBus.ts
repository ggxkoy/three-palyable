import { EventTarget } from 'cc';

/**
 * 全局事件总线。模块之间不持有彼此引用，只通过事件总线收发消息，
 * 任何一个 Prefab 从场景里删掉都不会让其它模块报错。
 *
 * 用法：
 *   EventBus.emit(GameEvents.GEM_COLLECTED, gemNode, value);
 *   EventBus.on(GameEvents.SCORE_CHANGED, this.onScore, this);
 *   组件销毁时记得 EventBus.targetOff(this)。
 */
export const EventBus = new EventTarget();
