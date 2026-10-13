// Browser checks for the acrylic layer. ?fallback=1 pretends backdrop-filter is unsupported.
import { apply, tiltHomography } from '@ax-design/shape';
import { registerLayer } from '@ax-design/surface';
import type { AxSurface } from '@ax-design/surface';
import { register } from '../src/index.js';

interface Check {
    name: string;
    ok: boolean;
    detail: string;
}
declare global {
    interface Window {
        __result?: unknown;
    }
}

const checks: Check[] = [];
const check = (name: string, ok: boolean, detail = '') => checks.push({ name, ok, detail });
const frames = (n: number) =>
    new Promise<void>((resolve) => {
        const step = () => (n-- <= 0 ? resolve() : requestAnimationFrame(step));
        requestAnimationFrame(step);
    });

async function run() {
    const fallback = new URLSearchParams(location.search).get('fallback') === '1';
    if (fallback) {
        const original = CSS.supports.bind(CSS);
        (CSS as any).supports = (p: string, v?: string) => (/backdrop-filter/.test(p) ? false : v === undefined ? original(p) : original(p, v));
    }
    // A layer that paints outside the shape, like a shadow: it grows the paint box by --halo
    // (more at the bottom) and fills it with one element.
    registerLayer('halo', () => {
        let box: HTMLElement | null = null;
        return {
            schema: [{ name: '--halo', syntax: { type: 'length' }, initial: '0px', inherits: false }],
            static: true,
            overflow: (v) => {
                const h = v.length('--halo');
                return [h, h, 2 * h, h];
            },
            attach(container) {
                box = document.createElement('div');
                box.className = 'halo';
                box.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;';
                container.appendChild(box);
            },
            detach() {
                if (box && box.parentNode) box.parentNode.removeChild(box);
            },
            write: () => false,
        };
    });
    register();
    await frames(8);
    for (const id of ['a', 's']) {
        const root = document.getElementById(id)!.shadowRoot!;
        const filter = root.querySelector('.acrylic-filter') as HTMLElement | null;
        const tint = root.querySelector('.acrylic-tint') as HTMLElement | null;
        const noise = root.querySelector('.acrylic-noise') as HTMLElement | null;
        const clip = filter ? filter.style.getPropertyValue('mask-image') || filter.style.getPropertyValue('-webkit-mask-image') : '';
        check(`${id}: layer elements exist`, !!filter && !!tint && !!noise);
        if (id === 'a') {
            // Round corners only: border-radius, no mask.
            const radius = getComputedStyle(filter!).borderTopLeftRadius;
            check(`${id}: round corners use border-radius`, clip === '' && radius === '24px', `${clip} ${radius}`);
        } else {
            // Gecko cuts with clip-path, the other engines with a mask (see layer.ts).
            const gecko = CSS.supports('-moz-appearance', 'none') && CSS.supports('clip-path', 'path("M0 0H1V1Z")');
            const clipPath = filter!.style.getPropertyValue('clip-path');
            if (gecko) check(`${id}: the blur element is clipped to the shape`, /^path\(/.test(clipPath) && clip === '', `${clipPath.slice(0, 40)} | ${clip.slice(0, 20)}`);
            else check(`${id}: the blur element is masked to the shape`, /^url\("?data:image\/svg\+xml/.test(clip) && clipPath === '', clip.slice(0, 40));
        }
        if (fallback) {
            check(`${id}: fallback tint without backdrop-filter`, !!tint && tint.classList.contains('fallback') && getComputedStyle(filter!).display === 'none');
        } else {
            check(`${id}: noise texture set`, !!noise && /^url\("?data:image\/png/.test(noise.style.backgroundImage), noise ? noise.style.backgroundImage.slice(0, 30) : '');
        }
    }
    // With a halo the paint box is larger than the shape; the frosted glass covers the shape's
    // bounds only, however the shape is cut. The tint is shown in both modes (the blur element
    // is hidden in the fallback).
    const tintOf = (el: Element) => el.shadowRoot!.querySelector('.acrylic-tint') as HTMLElement;
    // The shape's bounds on screen, through the tilt when there is one.
    const boundsOnScreen = (el: AxSurface) => {
        const host = el.getBoundingClientRect();
        const state = el.debugState;
        const b = state.shape!.bounds;
        const H = state.tilt ? tiltHomography(state.tilt) : null;
        const corners = [
            { x: b.left, y: b.top },
            { x: b.right, y: b.top },
            { x: b.right, y: b.bottom },
            { x: b.left, y: b.bottom },
        ].map((q) => (H ? apply(H, q) : q));
        const xs = corners.map((q) => q.x + host.left);
        const ys = corners.map((q) => q.y + host.top);
        return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
    };
    const offBy = (a: { left: number; top: number; right: number; bottom: number }, b: DOMRect) =>
        Math.max(Math.abs(a.left - b.left), Math.abs(a.top - b.top), Math.abs(a.right - b.right), Math.abs(a.bottom - b.bottom));
    for (const id of ['sh', 'm']) {
        const el = document.getElementById(id) as AxSurface;
        const err = offBy(boundsOnScreen(el), tintOf(el).getBoundingClientRect());
        check(`${id}: acrylic covers the shape's bounds, not the halo area`, err < 0.5, `err=${err.toFixed(3)}`);
    }
    // Shifting a corner off a rounded rectangle changes how the shape is cut, not where the
    // elements are (the bounds move by a fraction of a pixel): the blur at the edges and the
    // noise used to jump between the two, when other shapes covered the whole paint box.
    {
        const sh = document.getElementById('sh') as AxSurface;
        const before = tintOf(sh).getBoundingClientRect();
        const radiusBefore = getComputedStyle(tintOf(sh)).borderTopLeftRadius;
        sh.style.setProperty('--ax-corner-top-left-shift-x', '0.5%');
        await frames(6);
        const after = tintOf(sh).getBoundingClientRect();
        const cut = tintOf(sh).style.getPropertyValue('clip-path') || tintOf(sh).style.getPropertyValue('mask-image') || tintOf(sh).style.getPropertyValue('-webkit-mask-image');
        check('sh: a small corner shift switches the cut, not the box', radiusBefore === '16px' && cut !== '' && offBy({ left: before.left, top: before.top, right: before.right, bottom: before.bottom }, after) < 0.5, `${radiusBefore} ${cut.slice(0, 20)} ${JSON.stringify(after.toJSON())}`);
        sh.style.removeProperty('--ax-corner-top-left-shift-x');
        await frames(6);
    }
    // Pressed and tilted: the acrylic elements tilt themselves, no ancestor in the shadow root
    // has a transform (Firefox renders the backdrop wrong under one inside position: sticky),
    // and they land where the other layers and the content land.
    for (const id of ['sh', 'm']) {
        const el = document.getElementById(id)!;
        el.style.setProperty('--ax-tilt-mode', 'absolute');
        el.style.setProperty('--ax-tilt-depth', '30px');
        el.style.setProperty('--ax-tilt-perspective', '300px');
        await frames(4);
        const r = el.getBoundingClientRect();
        const x = r.left + r.width - 6;
        const y = r.top + 6;
        const init = { clientX: x, clientY: y, bubbles: true, composed: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1 };
        window.dispatchEvent(new PointerEvent('pointermove', init));
        el.dispatchEvent(new PointerEvent('pointerdown', init));
        await frames(8);
        const root = el.shadowRoot!;
        const tint = root.querySelector('.acrylic-tint') as HTMLElement;
        const transform = getComputedStyle(tint).transform;
        check(`${id}: pressed acrylic tilts`, transform !== 'none', transform);
        let parent = tint.parentNode;
        let flatAbove = true;
        while (parent && parent !== root) {
            if (parent instanceof HTMLElement && getComputedStyle(parent).transform !== 'none') flatAbove = false;
            parent = parent.parentNode;
        }
        check(`${id}: no transformed ancestor`, flatAbove);
        // The bounds of m reach below the element (a triangle), so a wrong origin shows.
        const err = offBy(boundsOnScreen(el as AxSurface), tint.getBoundingClientRect());
        check(`${id}: tilted acrylic turns around the element center`, err < 0.5, `err=${err.toFixed(3)}`);
        window.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
        await frames(8);
        check(`${id}: released acrylic returns flat`, getComputedStyle(tint).transform === 'none', getComputedStyle(tint).transform);
    }
    const rect = (id: string) => document.getElementById(id)!.getBoundingClientRect().toJSON();
    return { userAgent: navigator.userAgent, checks, rects: { a: rect('a'), s: rect('s') }, dpr: devicePixelRatio, fallback };
}

run().then(
    (r) => (window.__result = r),
    (e) => (window.__result = { error: String((e && e.stack) || e) })
);
