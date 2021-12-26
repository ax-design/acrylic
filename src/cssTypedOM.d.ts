type RegisterPaintType = (name: string, paintCtor: any) => void;

interface Window {
  registerPaint: RegisterPaintType;
}

interface HTMLElement {
  computedStyleMap(): StylePropertyMap
}

declare namespace CSS {
  function px(value: number): CSSUnitValue;
  function registerProperty(rule: CSSPropertyRule): void;
  var paintWorklet: PaintWorklet;
}

interface PaintWorklet {
  addModule(x: string | Function): void;
}

interface CSSPropertyRule {
  name: string;
  syntax: string;
  initialValue: string | number | CSSUnitValue;
  inherits: boolean
}

interface CSSUnitValue {
  unit: string;
  value: number
}

interface CSSBooleanValue {
  value: boolean
}

interface CSSColorValue {
  red: number;
  green: number;
  blue: number;
  alpha: number;
  value: string
}

interface CSSKeywordValue {
  value: string
}

interface HTMLElement {
  attributeStyleMap: StylePropertyMap;
}

interface StylePropertyMap {
  get(stylePropertyName: string): CSSUnitValue | CSSKeywordValue;
  set(stylePropertyName: string, value: CSSUnitValue | string): void,
}

interface PaintSize {
  readonly width: number;
  readonly height: number;
}

interface PaintCtor {
  //static get(inputProperties: string[]): void;
  paint(ctx: CanvasRenderingContext2D, size: PaintSize, properties: StylePropertyMap): void;
}

declare const registerPaint: RegisterPaintType;
