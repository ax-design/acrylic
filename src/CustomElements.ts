import { addCanvas, removeCanvas } from './acrylicManager';

export class AxAcrylic extends HTMLElement {
  static readonly ElementName = 'ax-acrylic';
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D | null;
  private root = this.attachShadow({ mode: 'open' });
  adoptedCallback() {
    this.disconnectedCallback();
    this.connectedCallback();
  }
  connectedCallback() {
    addCanvas(this.canvas);
    //setTimeout(() => , 5000);
  }
  disconnectedCallback() {
    removeCanvas(this.canvas);
  }
  constructor() {
    super();
    this.root.innerHTML = `
    <div id="top">
      <canvas></canvas>
      <div id="slot">
        <slot></slot>
      </div>
    </div>
    <style>
      #top { display: contents; }
      :host { display: inline-block; position: relative; }
      :host([block]) { display: block; }
      :host([inline-block]) { display: inline-block; }
      :host([flex]) { display: flex; }
      :host([inline-flex]) { display: inline-flex; }
      :host([grid]) { display: grid; }
      :host([inline-grid]) { display: inline-grid; }
      canvas, #slot { top: 0; left: 0; width: 100%; height: 100%; position: absolute; }
      canvas { pointer-events: none; }
      </style>`;

    this.canvas = this.root.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d');
  }
}
