
export const _decorator: {
  ccclass: any; property: any; requireComponent: any; executionOrder: any;
};
export function Enum(x: any): any;
export const math: {
  clamp(v: number, a: number, b: number): number;
  clamp01(v: number): number;
  randomRange(a: number, b: number): number;
};

export class Vec2 { x: number; y: number; constructor(x?: number, y?: number); }
export class Vec3 {
  x: number; y: number; z: number;
  constructor(x?: number, y?: number, z?: number);
  set(x: number, y: number, z: number): Vec3;
}
export class Size { width: number; height: number; }
export class Color {
  r: number; g: number; b: number; a: number;
  constructor(r?: number, g?: number, b?: number, a?: number);
  clone(): Color;
  fromHEX(hex: string): Color;
}

export class EventTarget {
  on(type: string, cb: (...a: any[]) => void, target?: any): void;
  off(type: string, cb?: (...a: any[]) => void, target?: any): void;
  once(type: string, cb: (...a: any[]) => void, target?: any): void;
  emit(type: string, ...args: any[]): void;
  targetOff(target: any): void;
}

export class Node extends EventTarget {
  constructor(name?: string);
  name: string;
  layer: number;
  angle: number;
  active: boolean;
  readonly isValid: boolean;
  readonly children: Node[];
  readonly position: Vec3;
  readonly scale: Vec3;
  readonly eulerAngles: Vec3;
  parent: Node | null;
  addChild(child: Node): void;
  removeFromParent(): void;
  destroy(): boolean;
  getChildByName(name: string): Node | null;
  getChildByPath(path: string): Node | null;
  setPosition(x: number | Vec3, y?: number, z?: number): void;
  getPosition(out?: Vec3): Vec3;
  getWorldPosition(out?: Vec3): Vec3;
  setScale(x: number | Vec3, y?: number, z?: number): void;
  setRotationFromEuler(x: number, y: number, z: number): void;
  addComponent<T extends Component>(cls: new () => T): T;
  getComponent<T extends Component>(cls: new () => T): T | null;
  getComponent(name: string): Component | null;
  getComponentsInChildren<T extends Component>(cls: new () => T): T[];
}

export class Component {
  readonly node: Node;
  readonly enabled: boolean;
  addComponent<T extends Component>(cls: new () => T): T;
  getComponent<T extends Component>(cls: new () => T): T | null;
  getComponent(name: string): Component | null;
  schedule(cb: () => void, interval?: number): void;
  scheduleOnce(cb: () => void, delay?: number): void;
  unscheduleAllCallbacks(): void;
}

export class Scene extends Node {
  getComponentsInChildren<T extends Component>(cls: new () => T): T[];
}

export class UITransform extends Component {
  setContentSize(size: Size | number, height?: number): void;
  setAnchorPoint(point: Vec2 | number, y?: number): void;
  readonly contentSize: Size;
}

export class SpriteFrame { readonly originalSize: Size; }
export class Sprite extends Component {
  spriteFrame: SpriteFrame | null;
  sizeMode: number;
  type: number;
  color: Color;
  static SizeMode: { CUSTOM: number; TRIMMED: number; RAW: number };
  static Type: { SIMPLE: number; SLICED: number; TILED: number; FILLED: number };
}
export class UIOpacity extends Component { opacity: number; }

export class Label extends Component {
  string: string;
  fontSize: number;
  lineHeight: number;
  useSystemFont: boolean;
  fontFamily: string;
  color: Color;
  horizontalAlign: number;
  verticalAlign: number;
  static HorizontalAlign: { LEFT: number; CENTER: number; RIGHT: number };
  static VerticalAlign: { TOP: number; CENTER: number; BOTTOM: number };
}

export class Button extends Component {
  static EventType: { CLICK: string };
}

export class Camera extends Component {
  projection: number;
  orthoHeight: number;
  near: number;
  far: number;
  clearFlags: number;
  clearColor: Color;
  visibility: number;
  priority: number;
  static ProjectionType: { ORTHO: number; PERSPECTIVE: number };
  static ClearFlag: { SOLID_COLOR: number; DEPTH_ONLY: number; NONE: number };
}

export class Canvas extends Component { cameraComponent: Camera | null; }

export class Widget extends Component {
  isAlignLeft: boolean; isAlignRight: boolean;
  isAlignTop: boolean; isAlignBottom: boolean;
  left: number; right: number; top: number; bottom: number;
  alignMode: number;
  static AlignMode: { ONCE: number; ON_WINDOW_RESIZE: number; ALWAYS: number };
}

export class EventHandler { emit(args: any[]): void; }
export class EventTouch {
  getUILocation(out?: Vec2): Vec2;
  getDeltaX(): number;
  getDeltaY(): number;
}

export const Input: {
  EventType: {
    TOUCH_START: string; TOUCH_MOVE: string;
    TOUCH_END: string; TOUCH_CANCEL: string;
  };
};
export const input: {
  on(type: string, cb: (e: EventTouch) => void, target?: any): void;
  off(type: string, cb: (e: EventTouch) => void, target?: any): void;
};

export const Layers: { Enum: { UI_2D: number; DEFAULT: number; UI_3D: number } };

export const Director: {
  EVENT_AFTER_SCENE_LAUNCH: string;
  EVENT_BEFORE_SCENE_LAUNCH: string;
};
export const director: {
  getScene(): Scene | null;
  on(type: string, cb: (...a: any[]) => void, target?: any): void;
  once(type: string, cb: (...a: any[]) => void, target?: any): void;
};

export const ResolutionPolicy: {
  FIXED_HEIGHT: number; FIXED_WIDTH: number; SHOW_ALL: number; NO_BORDER: number;
};
export const view: {
  getVisibleSize(): Size;
  setDesignResolutionSize(w: number, h: number, policy: number): void;
};

export const resources: {
  load(paths: string[], type: any, cb: (err: Error | null, assets: any[]) => void): void;
};

export function tween<T>(target: T): Tween<T>;
export class Tween<T> {
  to(duration: number, props: any, opts?: any): Tween<T>;
  delay(d: number): Tween<T>;
  call(cb: () => void): Tween<T>;
  start(): Tween<T>;
}

// ---- 3D 相关 ----
export class Mesh { }
export class Material {
  initialize(info: { effectName?: string; effectAsset?: any; technique?: number }): void;
  setProperty(name: string, val: any, passIdx?: number): void;
}
export class MeshRenderer extends Component {
  mesh: Mesh | null;
  material: Material | null;
  shadowCastingMode: number;
  receiveShadow: number;
  static ShadowCastingMode: { OFF: number; ON: number };
  static ShadowReceivingMode: { OFF: number; ON: number };
}
export class DirectionalLight extends Component {
  color: Color;
  illuminance: number;
  shadowEnabled: boolean;
}
export namespace primitives {
  export interface IGeometry { positions: number[]; indices?: number[] }
  export function box(opts?: { width?: number; height?: number; length?: number;
    widthSegments?: number; heightSegments?: number; lengthSegments?: number }): IGeometry;
  export function sphere(radius?: number, opts?: { segments?: number }): IGeometry;
  export function cylinder(radiusTop?: number, radiusBottom?: number, height?: number,
    opts?: { radialSegments?: number; heightSegments?: number }): IGeometry;
  export function torus(radius?: number, tube?: number,
    opts?: { radialSegments?: number; tubularSegments?: number }): IGeometry;
  export function plane(opts?: { width?: number; length?: number;
    widthSegments?: number; lengthSegments?: number }): IGeometry;
}
export namespace utils {
  export namespace MeshUtils {
    export function createMesh(geometry: primitives.IGeometry, out?: Mesh, opts?: any): Mesh;
  }
}
