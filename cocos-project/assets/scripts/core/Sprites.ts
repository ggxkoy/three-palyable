import { SpriteFrame, resources, Node, Sprite, UITransform, Color, Vec2, Layers } from 'cc';

/** resources/sprites 下需要预加载的图名 */
export const SPRITE_NAMES = [
  'hero', 'crystal', 'carry-item', 'resource-pile', 'delivery-pad',
  'gate', 'hazard', 'ground', 'rock', 'joy-base', 'joy-knob', 'panel',
] as const;

/**
 * Sprite 资源库。Bootstrap 启动时一次性预加载，之后各模块按名取用。
 * 图片放在 assets/resources/sprites/，用 resources.load 取，
 * 不需要在编辑器里逐个拖引用。
 */
export class Sprites {
  private static _frames = new Map<string, SpriteFrame>();

  static preload(): Promise<void> {
    const paths = SPRITE_NAMES.map((n) => `sprites/${n}/spriteFrame`);
    return new Promise((resolve) => {
      resources.load(paths, SpriteFrame, (err, frames) => {
        if (err) {
          console.error('[Sprites] 预加载失败，请确认图片位于 assets/resources/sprites/', err);
        } else {
          SPRITE_NAMES.forEach((n, i) => this._frames.set(n, frames[i] as SpriteFrame));
        }
        resolve();
      });
    });
  }

  static get(name: string): SpriteFrame | null {
    return this._frames.get(name) ?? null;
  }

  /** 造一个带 Sprite 的节点，常用参数一次给全 */
  static makeNode(opts: {
    name: string;
    sprite?: string;
    parent?: Node;
    x?: number; y?: number;
    width?: number; height?: number;
    scale?: number;
    color?: Color;
    tiled?: boolean;
  }): Node {
    const node = new Node(opts.name);
    // 运行时创建的节点必须落在 UI_2D 层，否则 UI 相机看不见它。
    // 在这里统一设置，避免 ResourceField 等延后生成的节点漏掉图层。
    node.layer = Layers.Enum.UI_2D;
    const ui = node.addComponent(UITransform);
    if (opts.sprite) {
      const sp = node.addComponent(Sprite);
      const frame = Sprites.get(opts.sprite);
      if (frame) sp.spriteFrame = frame;
      sp.sizeMode = Sprite.SizeMode.CUSTOM;
      sp.type = opts.tiled ? Sprite.Type.TILED : Sprite.Type.SIMPLE;
      if (opts.color) sp.color = opts.color;
      if (opts.width && opts.height) ui.setContentSize(opts.width, opts.height);
      else if (frame) ui.setContentSize(frame.originalSize);
    } else if (opts.width && opts.height) {
      ui.setContentSize(opts.width, opts.height);
    }
    ui.setAnchorPoint(new Vec2(0.5, 0.5));
    node.setPosition(opts.x ?? 0, opts.y ?? 0);
    if (opts.scale != null) node.setScale(opts.scale, opts.scale, 1);
    if (opts.parent) opts.parent.addChild(node);
    return node;
  }
}
