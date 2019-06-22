import noiseCanvasPromise from './noise';

export class AxAcrylic extends HTMLElement {
  static readonly ElementName = 'ax-acrylic';
  private noise: HTMLDivElement;
  private tint: HTMLDivElement;
  private filter: HTMLDivElement;
  private root = this.attachShadow({ mode: 'open' });
  connectedCallback() {
    noiseCanvasPromise.then((data) => {
      this.noise.attributeStyleMap.set('background-image', `url(${data})`)
    });
  }
  constructor() {
    super();
    this.root.innerHTML = `
    <div id="top">
      <div id="filter"></div>
      <div id="tint"></div>
      <div id="noise"></div>
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
      #slot, #filter, #tint, #noise { top: 0; left: 0; width: 100%; height: 100%; position: absolute; }
      #filter, #tint, #noise { pointer-events: none; }
      #noise { opacity: var(--acrylic-noise-opacity, 0.03); }
      #tint { background-color: var(--acrylic-tint-color, black); opacity: var(--acrylic-tint-opacity, 0.6); }
      #tint.fallback { background-color: var(--acrylic-fallback-color, black); opacity: 1; }
      #filter { backdrop-filter: blur(var(--acrylic-blur, 25px)) saturate(var(--acrylic-saturate, 200%)) brightness(var(--acrylic-brightness, 95%)); }
      </style>`;

    this.filter = this.root.querySelector('#filter') as HTMLDivElement;
    this.noise = this.root.querySelector('#noise') as HTMLDivElement;
    this.tint = this.root.querySelector('#tint') as HTMLDivElement;
    
    if (!('backdropFilter' in document.documentElement.style)) {
      this.noise.attributeStyleMap.set('display', 'none');
      this.filter.attributeStyleMap.set('display', 'none');
      this.tint.classList.add('fallback');
    }
  }
}
