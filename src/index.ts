import { AxAcrylic } from './CustomElements.js';
/// <reference path="./cssTypedOM.d.ts" />
/// <reference path="./cssExtendedProps.d.ts" />

export function register() {
    customElements.define(AxAcrylic.ElementName, AxAcrylic);

    if (window.CSS && CSS.registerProperty) {
        CSS.registerProperty({
            name: '--acrylic-tint-color',
            syntax: '<color>',
            initialValue: 'black',
            inherits: true
        });
        CSS.registerProperty({
            name: '--acrylic-fallback-color',
            syntax: '<color>',
            initialValue: 'black',
            inherits: true
        });
        CSS.registerProperty({
            name: '--acrylic-tint-opacity',
            syntax: '<number>',
            initialValue: '0.6',
            inherits: true
        });
        CSS.registerProperty({
            name: '--acrylic-noise-opacity',
            syntax: '<number>',
            initialValue: '0.03',
            inherits: true
        });
        CSS.registerProperty({
            name: '--acrylic-blur',
            syntax: '<length>',
            initialValue: '20px',
            inherits: true
        });
        CSS.registerProperty({
            name: '--acrylic-saturate',
            syntax: '<percentage>',
            initialValue: '200%',
            inherits: true
        });
        CSS.registerProperty({
            name: '--acrylic-brightness',
            syntax: '<percentage>',
            initialValue: '95%',
            inherits: true
        });
    } else {
        console.warn('Your browser do NOT support `CSS.registerProperty` method, register failed!');
    }
}
