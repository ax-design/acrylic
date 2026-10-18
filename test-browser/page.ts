// Browser checks for the acrylic layer. ?fallback=1 pretends backdrop-filter is unsupported.
import { apply, tiltHomography } from '@ax-design/shape';
import { registerLayer, setAlwaysUseFallback } from '@ax-design/surface';
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
    // Gecko cuts with clip-path, the other engines with a mask or border-radius (see layer.ts).
    // There the glass never transforms: its box is the shape's bounds and a margin, and the cut
    // is the outline seen through the tilt.
    const gecko = CSS.supports('-moz-appearance', 'none') && CSS.supports('clip-path', 'path("M0 0H1V1Z")');
    const GECKO_MARGIN = 8;
    for (const id of ['a', 's']) {
        const root = document.getElementById(id)!.shadowRoot!;
        const filter = root.querySelector('.acrylic-filter') as HTMLElement | null;
        const tint = root.querySelector('.acrylic-tint') as HTMLElement | null;
        const noise = root.querySelector('.acrylic-noise') as HTMLElement | null;
        const clip = filter ? filter.style.getPropertyValue('mask-image') || filter.style.getPropertyValue('-webkit-mask-image') : '';
        check(`${id}: layer elements exist`, !!filter && !!tint && !!noise);
        if (id === 'a' && gecko) {
            check(`${id}: round corners are cut by the outline`, /^path\(/.test(filter!.style.getPropertyValue('clip-path')) && clip === '', filter!.style.getPropertyValue('clip-path').slice(0, 40));
        } else if (id === 'a') {
            // Round corners only: border-radius, no mask.
            const radius = getComputedStyle(filter!).borderTopLeftRadius;
            check(`${id}: round corners use border-radius`, clip === '' && radius === '24px', `${clip} ${radius}`);
        } else {
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
    // The outline's extent on screen, through the tilt, its arcs sampled finely.
    const outlineOnScreen = (el: AxSurface) => {
        const host = el.getBoundingClientRect();
        const state = el.debugState;
        const H = state.tilt ? tiltHomography(state.tilt) : null;
        const out = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
        const add = (q: { x: number; y: number }) => {
            const p = H ? apply(H, q) : q;
            out.left = Math.min(out.left, p.x + host.left);
            out.right = Math.max(out.right, p.x + host.left);
            out.top = Math.min(out.top, p.y + host.top);
            out.bottom = Math.max(out.bottom, p.y + host.top);
        };
        for (const seg of state.shape!.outline.segments) {
            if (seg.type === 'line') {
                add({ x: seg.x0, y: seg.y0 });
                continue;
            }
            let sweep = seg.end - seg.start;
            if (seg.anticlockwise && sweep > 0) sweep -= 2 * Math.PI;
            if (!seg.anticlockwise && sweep < 0) sweep += 2 * Math.PI;
            for (let i = 0; i <= 256; i++) {
                const t = seg.start + (sweep * i) / 256;
                add({ x: seg.cx + seg.r * Math.cos(t), y: seg.cy + seg.r * Math.sin(t) });
            }
        }
        return out;
    };
    const offBy = (a: { left: number; top: number; right: number; bottom: number }, b: DOMRect) =>
        Math.max(Math.abs(a.left - b.left), Math.abs(a.top - b.top), Math.abs(a.right - b.right), Math.abs(a.bottom - b.bottom));
    // Gecko: the bounds and the margin, each edge snapped to the pixel.
    const grown = (a: { left: number; top: number; right: number; bottom: number }) =>
        gecko ? { left: a.left - GECKO_MARGIN, top: a.top - GECKO_MARGIN, right: a.right + GECKO_MARGIN, bottom: a.bottom + GECKO_MARGIN } : a;
    const tolerance = gecko ? 1 : 0.5;
    for (const id of ['sh', 'm']) {
        const el = document.getElementById(id) as AxSurface;
        const err = offBy(grown(boundsOnScreen(el)), tintOf(el).getBoundingClientRect());
        check(`${id}: acrylic covers the shape's bounds, not the halo area`, err < tolerance, `err=${err.toFixed(3)}`);
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
        check('sh: a small corner shift switches the cut, not the box', radiusBefore === (gecko ? '0px' : '16px') && cut !== '' && offBy({ left: before.left, top: before.top, right: before.right, bottom: before.bottom }, after) < 0.5, `${radiusBefore} ${cut.slice(0, 20)} ${JSON.stringify(after.toJSON())}`);
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
        const flatCut = (el.shadowRoot!.querySelector('.acrylic-tint') as HTMLElement).style.getPropertyValue('clip-path');
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
        if (gecko) check(`${id}: pressed acrylic is cut through the tilt, not transformed`, transform === 'none' && tint.style.getPropertyValue('clip-path') !== flatCut, transform);
        else check(`${id}: pressed acrylic tilts`, transform !== 'none', transform);
        let parent = tint.parentNode;
        let flatAbove = true;
        while (parent && parent !== root) {
            if (parent instanceof HTMLElement && getComputedStyle(parent).transform !== 'none') flatAbove = false;
            parent = parent.parentNode;
        }
        check(`${id}: no transformed ancestor`, flatAbove);
        // The bounds of m reach below the element (a triangle), so a wrong origin shows.
        if (gecko) {
            // The points of the cut, on screen, against the outline through the tilt.
            const box = tint.getBoundingClientRect();
            const nums = (tint.style.getPropertyValue('clip-path').match(/-?[\d.]+(e-?\d+)?/g) || []).map(Number);
            const cut = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
            for (let i = 0; i + 1 < nums.length; i += 2) {
                cut.left = Math.min(cut.left, nums[i] + box.left);
                cut.right = Math.max(cut.right, nums[i] + box.left);
                cut.top = Math.min(cut.top, nums[i + 1] + box.top);
                cut.bottom = Math.max(cut.bottom, nums[i + 1] + box.top);
            }
            const err = offBy(outlineOnScreen(el as AxSurface), cut as unknown as DOMRect);
            check(`${id}: tilted acrylic turns around the element center`, err < 0.5, `err=${err.toFixed(3)}`);
        } else {
            const err = offBy(boundsOnScreen(el as AxSurface), tint.getBoundingClientRect());
            check(`${id}: tilted acrylic turns around the element center`, err < 0.5, `err=${err.toFixed(3)}`);
        }
        window.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
        await frames(8);
        check(`${id}: released acrylic returns flat`, getComputedStyle(tint).transform === 'none' && (!gecko || tint.style.getPropertyValue('clip-path') === flatCut), getComputedStyle(tint).transform);
    }
    // A surface with acrylic is a stacking context of its own (Firefox turns a pressed blur in a
    // transformed ancestor clear otherwise); a style of the page wins over it.
    const iso = document.getElementById('s')!;
    check('acrylic isolates its surface', getComputedStyle(iso).isolation === 'isolate', getComputedStyle(iso).isolation);
    iso.style.isolation = 'auto';
    check('the page can undo the isolation', getComputedStyle(iso).isolation === 'auto', getComputedStyle(iso).isolation);
    iso.style.removeProperty('isolation');
    const plainSurface = document.createElement('ax-surface');
    plainSurface.setAttribute('layers', 'halo');
    document.body.appendChild(plainSurface);
    await frames(2);
    check('a surface without acrylic is not isolated', getComputedStyle(plainSurface).isolation === 'auto', getComputedStyle(plainSurface).isolation);
    plainSurface.remove();
    // The page asks for the fallback (WinUI's AlwaysUseFallback) and then stops asking: the
    // acrylic follows, live. Last, and restored before the screenshot, so the pixel checks see
    // the glass. Only here: the fallback page has no glass to go back to.
    if (!fallback) {
        const parts = (id: string) => {
            const tint = document.getElementById(id)!.shadowRoot!.querySelector('.acrylic-tint') as HTMLElement;
            const filter = document.getElementById(id)!.shadowRoot!.querySelector('.acrylic-filter') as HTMLElement;
            const noise = document.getElementById(id)!.shadowRoot!.querySelector('.acrylic-noise') as HTMLElement;
            return { layer: tint.parentElement!, tint, filter, noise };
        };
        setAlwaysUseFallback(true);
        await frames(4);
        for (const id of ['a', 's']) {
            const { layer, tint, filter, noise } = parts(id);
            const opacity = getComputedStyle(tint).opacity;
            const display = getComputedStyle(filter).display;
            check(`${id}: always use fallback sets the root class`, layer.classList.contains('acrylic-fallback'), layer.className);
            check(`${id}: always use fallback makes the tint solid`, tint.classList.contains('fallback') && opacity === '1', `${tint.className} ${opacity}`);
            check(`${id}: always use fallback hides the blur element`, display === 'none', display);
            check(`${id}: always use fallback drops the noise`, noise.style.backgroundImage === '', noise.style.backgroundImage.slice(0, 30));
        }
        setAlwaysUseFallback(false);
        await frames(4);
        for (const id of ['a', 's']) {
            const { layer, tint, filter, noise } = parts(id);
            const display = getComputedStyle(filter).display;
            check(`${id}: back to glass clears the root class`, !layer.classList.contains('acrylic-fallback'), layer.className);
            check(`${id}: back to glass clears the tint class`, !tint.classList.contains('fallback'), tint.className);
            check(`${id}: back to glass shows the blur element`, display !== 'none', display);
            check(`${id}: back to glass restores the noise`, /^url\("?data:image\/png/.test(noise.style.backgroundImage), noise.style.backgroundImage.slice(0, 30));
        }
    }
    const rect =(id: string) => document.getElementById(id)!.getBoundingClientRect().toJSON();
    return { userAgent: navigator.userAgent, checks, rects: { a: rect('a'), s: rect('s') }, dpr: devicePixelRatio, fallback };
}

run().then(
    (r) => (window.__result = r),
    (e) => (window.__result = { error: String((e && e.stack) || e) })
);
