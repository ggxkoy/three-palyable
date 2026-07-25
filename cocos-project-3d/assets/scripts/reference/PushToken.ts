import { _decorator, Component, Material, MeshRenderer } from 'cc';

const { ccclass } = _decorator;

@ccclass('PushToken')
export class PushToken extends Component {
  value = 1;
  converted = false;
  private _renderer: MeshRenderer | null = null;
  private _goldMaterial: Material | null = null;

  setup(renderer: MeshRenderer, goldMaterial: Material) {
    this._renderer = renderer;
    this._goldMaterial = goldMaterial;
  }

  convert(multiplier: number) {
    if (this.converted) return false;
    this.converted = true;
    this.value *= multiplier;
    if (this._renderer && this._goldMaterial) this._renderer.material = this._goldMaterial;
    this.node.setScale(0.34, 0.24, 0.34);
    return true;
  }
}
