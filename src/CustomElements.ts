export class AxAcrylic extends HTMLElement {
  static readonly ElementName = 'ax-acrylic';
  public background: HTMLDivElement;
  private root = this.attachShadow({ mode: 'open' });
  constructor() {
    super();
    this.root.innerHTML = `
    <div id="top">
      <div id="background"></div>
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
      canvas, #slot, #background { top: 0; left: 0; width: 100%; height: 100%; position: absolute; }
      canvas { pointer-events: none; }
      #background { background: paint(acrylic-background); backdrop-filter: blur(var(--acrylic-blur, 25px)) saturate(var(--acrylic-saturate, 200%)) brightness(var(--acrylic-brightness, 95%)); }
      </style>`;
    this.background = this.root.querySelector('#background') as HTMLDivElement;

    this.background.attributeStyleMap.set('--acrylic-fallback', '' + !('backdropFilter' in document.documentElement.style));
  }
}
