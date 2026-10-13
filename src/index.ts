// @ax-design/acrylic: the acrylic texture of Axiom Design System, on the @ax-design/surface
// engine. Use <ax-acrylic>, or `layers="acrylic"` on any <ax-surface>.
import { register as registerSurface, registerLayer } from '@ax-design/surface';
import { AxAcrylic } from './element.js';
import { createAcrylicLayer } from './layer.js';

export { AxAcrylic } from './element.js';
export { createAcrylicLayer } from './layer.js';

// The original definitions. They are a permanent contract: older copies of this package may
// have registered them first, and the first registration wins.
const PROPERTIES = [
    { name: '--acrylic-tint-color', syntax: '<color>', initialValue: 'black', inherits: true },
    { name: '--acrylic-fallback-color', syntax: '<color>', initialValue: 'black', inherits: true },
    { name: '--acrylic-tint-opacity', syntax: '<number>', initialValue: '0.6', inherits: true },
    { name: '--acrylic-noise-opacity', syntax: '<number>', initialValue: '0.03', inherits: true },
    { name: '--acrylic-blur', syntax: '<length>', initialValue: '20px', inherits: true },
    { name: '--acrylic-saturate', syntax: '<percentage>', initialValue: '200%', inherits: true },
    { name: '--acrylic-brightness', syntax: '<percentage>', initialValue: '95%', inherits: true },
];

let layerRegistered = false;

// Registers the `acrylic` layer for <ax-surface>. register() calls it too.
export function registerAcrylicLayer(): void {
    if (layerRegistered) return;
    layerRegistered = true;
    registerLayer('acrylic', createAcrylicLayer);
}

let registered = false;

export function register(): void {
    if (registered) return;
    registered = true;
    const css = typeof CSS !== 'undefined' ? (CSS as unknown as { registerProperty?: (d: unknown) => void }) : null;
    if (css && css.registerProperty) {
        for (const definition of PROPERTIES) {
            try {
                css.registerProperty(definition);
            } catch (error) {
                if (!error || (error as Error).name !== 'InvalidModificationError') throw error;
            }
        }
    }
    registerAcrylicLayer();
    registerSurface();
    if (!customElements.get(AxAcrylic.ElementName)) customElements.define(AxAcrylic.ElementName, AxAcrylic);
}
