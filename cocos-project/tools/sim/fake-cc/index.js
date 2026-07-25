// 极简 cc 运行时替身，用于在 Node 里跑玩法逻辑验证（无渲染、无输入）。
'use strict';

const noop = () => {};
// 均为"装饰器工厂"：@ccclass('X') / @property({...}) 先调用再返回真正的装饰器
const classDecoFactory = () => () => (cls) => cls;
const propDecoFactory = () => () => () => {};

const _decorator = {
  ccclass: classDecoFactory(),
  property: propDecoFactory(),
  requireComponent: classDecoFactory(),
  executionOrder: classDecoFactory(),
};

function Enum(x) { return x; }

const math = {
  clamp: (v, a, b) => Math.min(Math.max(v, a), b),
  clamp01: (v) => Math.min(Math.max(v, 0), 1),
  randomRange: (a, b) => a + Math.random() * (b - a),
};

class Vec2 { constructor(x = 0, y = 0) { this.x = x; this.y = y; } }
class Vec3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
}
class Size { constructor(w = 0, h = 0) { this.width = w; this.height = h; } }
class Color {
  constructor(r = 255, g = 255, b = 255, a = 255) { this.r = r; this.g = g; this.b = b; this.a = a; }
  clone() { return new Color(this.r, this.g, this.b, this.a); }
  fromHEX() { return this; }
}

class EventTarget {
  constructor() { this._h = new Map(); }
  on(type, cb, target) {
    if (!this._h.has(type)) this._h.set(type, []);
    this._h.get(type).push({ cb, target });
  }
  off(type, cb, target) {
    const l = this._h.get(type); if (!l) return;
    this._h.set(type, l.filter((e) => !(e.cb === cb && (!target || e.target === target))));
  }
  once(type, cb, target) {
    const w = (...a) => { this.off(type, w, target); cb.apply(target, a); };
    this.on(type, w, target);
  }
  emit(type, ...args) {
    const l = this._h.get(type); if (!l) return;
    for (const e of l.slice()) e.cb.apply(e.target, args);
  }
  targetOff(target) {
    for (const [t, l] of this._h) this._h.set(t, l.filter((e) => e.target !== target));
  }
}

// ---- 调度：模拟引擎主循环 ----
const ENGINE = { comps: [], pendingStart: [], timers: [] };

class Node extends EventTarget {
  constructor(name = 'Node') {
    super();
    this.name = name; this.layer = 0; this.angle = 0; this.active = true;
    this.isValid = true; this.children = []; this.parent = null;
    this.position = new Vec3(); this.scale = new Vec3(1, 1, 1);
    this.eulerAngles = new Vec3();
    this._components = [];
  }
  addChild(c) { c.parent = this; this.children.push(c); }
  removeFromParent() {
    if (!this.parent) return;
    const i = this.parent.children.indexOf(this);
    if (i >= 0) this.parent.children.splice(i, 1);
    this.parent = null;
  }
  destroy() {
    this.isValid = false;
    for (const c of this._components) {
      c.onDisable && c.onDisable();
      c.onDestroy && c.onDestroy();
      const i = ENGINE.comps.indexOf(c);
      if (i >= 0) ENGINE.comps.splice(i, 1);
    }
    for (const ch of this.children.slice()) ch.destroy();
    this.removeFromParent();
    return true;
  }
  getChildByName(n) { return this.children.find((c) => c.name === n) || null; }
  getChildByPath(p) {
    let cur = this;
    for (const seg of p.split('/')) { cur = cur.getChildByName(seg); if (!cur) return null; }
    return cur;
  }
  setPosition(x, y, z) {
    if (typeof x === 'object') { this.position = new Vec3(x.x, x.y, x.z); return; }
    this.position = new Vec3(x, y ?? 0, z ?? 0);
  }
  getPosition(out) {
    if (out) { out.set(this.position.x, this.position.y, this.position.z); return out; }
    return new Vec3(this.position.x, this.position.y, this.position.z);
  }
  getWorldPosition(out) {
    let x = 0, y = 0, n = this;
    while (n) { x += n.position.x; y += n.position.y; n = n.parent; }
    if (out) { out.set(x, y, 0); return out; }
    return new Vec3(x, y, 0);
  }
  setScale(x, y, z) {
    if (typeof x === 'object') { this.scale = new Vec3(x.x, x.y, x.z); return; }
    this.scale = new Vec3(x, y ?? x, z ?? 1);
  }
  setRotationFromEuler(x, y, z) { this.eulerAngles = new Vec3(x, y, z); }
  addComponent(cls) {
    const c = new cls();
    c.node = this; c.enabled = true;
    this._components.push(c);
    ENGINE.comps.push(c);
    c.onLoad && c.onLoad();
    c.onEnable && c.onEnable();
    if (c.start) ENGINE.pendingStart.push(c);
    return c;
  }
  getComponent(cls) {
    if (typeof cls === 'string') {
      return this._components.find((c) => c.constructor.name === cls) || null;
    }
    return this._components.find((c) => c instanceof cls) || null;
  }
  getComponentsInChildren(cls) {
    const out = [];
    const walk = (n) => {
      for (const c of n._components) if (c instanceof cls) out.push(c);
      for (const ch of n.children) walk(ch);
    };
    walk(this);
    return out;
  }
}

class Component {
  constructor() { this.node = null; this.enabled = true; }
  addComponent(cls) { return this.node.addComponent(cls); }
  getComponent(cls) { return this.node.getComponent(cls); }
  schedule(cb, interval) { ENGINE.timers.push({ cb, at: interval, repeat: true }); }
  scheduleOnce(cb, delay) { ENGINE.timers.push({ cb, at: delay || 0, repeat: false }); }
  unscheduleAllCallbacks() {}
}

class Scene extends Node {}

class UITransform extends Component {
  setContentSize() {} setAnchorPoint() {}
}
class SpriteFrame { constructor() { this.originalSize = new Size(1, 1); } }
class Sprite extends Component {}
Sprite.SizeMode = { CUSTOM: 0, TRIMMED: 1, RAW: 2 };
Sprite.Type = { SIMPLE: 0, SLICED: 1, TILED: 2, FILLED: 3 };
class UIOpacity extends Component { constructor() { super(); this.opacity = 255; } }
class Label extends Component { constructor() { super(); this.string = ''; this.color = new Color(); } }
Label.HorizontalAlign = { LEFT: 0, CENTER: 1, RIGHT: 2 };
Label.VerticalAlign = { TOP: 0, CENTER: 1, BOTTOM: 2 };
class Button extends Component {}
Button.EventType = { CLICK: 'click' };
class Camera extends Component {}
Camera.ProjectionType = { ORTHO: 0, PERSPECTIVE: 1 };
Camera.ClearFlag = { SOLID_COLOR: 7, DEPTH_ONLY: 6, NONE: 0 };
class Canvas extends Component {}
class Widget extends Component {}
Widget.AlignMode = { ONCE: 0, ON_WINDOW_RESIZE: 1, ALWAYS: 2 };
class EventHandler { emit() {} }
class EventTouch { getUILocation(o) { return o || new Vec2(); } getDeltaX() { return 0; } getDeltaY() { return 0; } }

const Input = { EventType: { TOUCH_START: 'ts', TOUCH_MOVE: 'tm', TOUCH_END: 'te', TOUCH_CANCEL: 'tc' } };
const input = { on: noop, off: noop };
const Layers = { Enum: { UI_2D: 1 << 25, DEFAULT: 1 << 30, UI_3D: 1 << 23 } };
const Director = { EVENT_AFTER_SCENE_LAUNCH: 'after-scene-launch', EVENT_BEFORE_SCENE_LAUNCH: 'before-scene-launch' };
const _scene = new Scene('sim');
const director = { getScene: () => _scene, on: noop, once: noop };
const ResolutionPolicy = { FIXED_HEIGHT: 2, FIXED_WIDTH: 3, SHOW_ALL: 0, NO_BORDER: 1 };
const view = { getVisibleSize: () => new Size(720, 1280), setDesignResolutionSize: noop };
const resources = { load: (paths, type, cb) => cb(null, paths.map(() => new SpriteFrame())) };

function tween(target) {
  // 立即完成版：直接跑 call 回调，不做插值（逻辑验证不关心动画过程）
  const chain = {
    to: () => chain,
    delay: () => chain,
    call: (cb) => { chain._calls.push(cb); return chain; },
    start: () => { for (const c of chain._calls) c(); return chain; },
    _calls: [],
  };
  return chain;
}

// ---- 供测试驱动的主循环 ----
function step(dt) {
  for (const c of ENGINE.pendingStart.splice(0)) c.start && c.start();
  for (const c of ENGINE.comps.slice()) if (c.enabled && c.update) c.update(dt);
  for (const c of ENGINE.comps.slice()) if (c.enabled && c.lateUpdate) c.lateUpdate(dt);
  for (const t of ENGINE.timers.slice()) {
    t.at -= dt;
    if (t.at <= 0) {
      ENGINE.timers.splice(ENGINE.timers.indexOf(t), 1);
      t.cb();
    }
  }
}

module.exports = {
  _decorator, Enum, math, Vec2, Vec3, Size, Color, EventTarget, Node, Component,
  Scene, UITransform, SpriteFrame, Sprite, UIOpacity, Label, Button, Camera,
  Canvas, Widget, EventHandler, EventTouch, Input, input, Layers, Director,
  director, ResolutionPolicy, view, resources, tween,
  __sim: { step, ENGINE, scene: _scene },
};
