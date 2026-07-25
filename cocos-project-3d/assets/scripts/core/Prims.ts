import {
  Node, Mesh, MeshRenderer, Material, Color, Vec3, utils, primitives, Layers,
} from 'cc';

/** 材质参数 */
export interface MatOpts {
  color: number | Color;
  roughness?: number;
  metallic?: number;
  /** 自发光颜色，用于岩浆等 */
  emissive?: number | Color;
}

function toColor(c: number | Color): Color {
  if (typeof c !== 'number') return c;
  return new Color((c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff, 255);
}

/**
 * 几何体与材质工具层。
 *
 * 3D 版不依赖任何 .fbx / .mesh 资源：世界里的每个物件都用 Cocos 内置的
 * 参数化几何体（box / sphere / cylinder / torus / plane）在运行时生成，
 * 材质也用代码创建。这样工程丢进编辑器就能跑，不需要美术资源管线。
 *
 * 网格与材质都做了缓存：同色物件共享材质，同类物件共享单位网格（靠节点缩放
 * 变形），几百个物件也只有很少的 draw call。
 */
export class Prims {
  private static _meshes = new Map<string, Mesh>();
  private static _mats = new Map<string, Material>();

  // ---------- 材质 ----------
  static material(opts: MatOpts): Material {
    const col = toColor(opts.color);
    const key = `${col.r},${col.g},${col.b}|${opts.roughness ?? 0.8}|`
      + `${opts.metallic ?? 0}|${opts.emissive ?? ''}`;
    const cached = this._mats.get(key);
    if (cached) return cached;

    const mat = new Material();
    mat.initialize({ effectName: 'builtin-standard' });
    mat.setProperty('albedo', col);
    mat.setProperty('roughness', opts.roughness ?? 0.8);
    mat.setProperty('metallic', opts.metallic ?? 0);
    if (opts.emissive != null) mat.setProperty('emissive', toColor(opts.emissive));
    this._mats.set(key, mat);
    return mat;
  }

  // ---------- 单位网格（靠节点缩放变形，便于共享） ----------
  static boxMesh(): Mesh {
    return this.cached('box', () => primitives.box({ width: 1, height: 1, length: 1 }));
  }

  /** segments 越小越有低多边形的棱面感 */
  static sphereMesh(segments = 8): Mesh {
    return this.cached(`sphere${segments}`, () => primitives.sphere(0.5, { segments }));
  }

  static cylinderMesh(segments = 24): Mesh {
    return this.cached(`cyl${segments}`,
      () => primitives.cylinder(0.5, 0.5, 1, { radialSegments: segments, heightSegments: 1 }));
  }

  static torusMesh(tube = 0.06): Mesh {
    return this.cached(`torus${tube}`,
      () => primitives.torus(0.5, tube, { radialSegments: 32, tubularSegments: 12 }));
  }

  static planeMesh(): Mesh {
    return this.cached('plane', () => primitives.plane({ width: 1, length: 1 }));
  }

  private static cached(key: string, make: () => primitives.IGeometry): Mesh {
    const hit = this._meshes.get(key);
    if (hit) return hit;
    const mesh = utils.MeshUtils.createMesh(make());
    this._meshes.set(key, mesh);
    return mesh;
  }

  // ---------- 节点组装 ----------
  static make(opts: {
    name: string;
    parent?: Node;
    mesh?: Mesh;
    mat?: MatOpts;
    pos?: [number, number, number];
    scale?: [number, number, number];
    euler?: [number, number, number];
    castShadow?: boolean;
  }): Node {
    const node = new Node(opts.name);
    node.layer = Layers.Enum.DEFAULT;
    if (opts.pos) node.setPosition(opts.pos[0], opts.pos[1], opts.pos[2]);
    if (opts.scale) node.setScale(opts.scale[0], opts.scale[1], opts.scale[2]);
    if (opts.euler) node.setRotationFromEuler(opts.euler[0], opts.euler[1], opts.euler[2]);
    if (opts.mesh && opts.mat) {
      const mr = node.addComponent(MeshRenderer);
      mr.mesh = opts.mesh;
      mr.material = this.material(opts.mat);
      if (opts.castShadow) mr.shadowCastingMode = MeshRenderer.ShadowCastingMode.ON;
      else mr.receiveShadow = MeshRenderer.ShadowReceivingMode.ON;
    }
    if (opts.parent) opts.parent.addChild(node);
    return node;
  }

  /** 常用：一个立方体（size 即世界尺寸） */
  static box(name: string, parent: Node, size: [number, number, number],
             pos: [number, number, number], mat: MatOpts, castShadow = true): Node {
    return this.make({
      name, parent, mesh: this.boxMesh(), mat, pos, scale: size, castShadow,
    });
  }

  /** 常用：低多边形球（宝石/岩石） */
  static gem(name: string, parent: Node, radius: number,
             pos: [number, number, number], mat: MatOpts, segments = 5): Node {
    return this.make({
      name, parent, mesh: this.sphereMesh(segments), mat, pos,
      scale: [radius * 2, radius * 2, radius * 2], castShadow: true,
    });
  }

  /** 常用：扁圆柱（投递台/门柱） */
  static disc(name: string, parent: Node, radius: number, height: number,
              pos: [number, number, number], mat: MatOpts): Node {
    return this.make({
      name, parent, mesh: this.cylinderMesh(), mat, pos,
      scale: [radius * 2, height, radius * 2],
    });
  }

  static setEmissiveScale(_node: Node, _v: Vec3) { /* 预留：呼吸灯等动态自发光 */ }
}
