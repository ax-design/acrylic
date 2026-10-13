// Browser checks for the acrylic layer. ?fallback=1 pretends backdrop-filter is unsupported.
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
            check(`${id}: the blur element is masked to the shape`, /^url\("?data:image\/svg\+xml/.test(clip), clip.slice(0, 40));
        }
        if (fallback) {
            check(`${id}: fallback tint without backdrop-filter`, !!tint && tint.classList.contains('fallback') && getComputedStyle(filter!).display === 'none');
        } else {
            check(`${id}: noise texture set`, !!noise && /^url\("?data:image\/png/.test(noise.style.backgroundImage), noise ? noise.style.backgroundImage.slice(0, 30) : '');
        }
    }
    // With a shadow the paint box is larger than the element; the frosted glass must still
    // cover the element only.
    {
        const sh = document.getElementById('sh')!;
        // The tint is shown in both modes (the blur element is hidden in the fallback).
        const tint = sh.shadowRoot!.querySelector('.acrylic-tint') as HTMLElement;
        const a = sh.getBoundingClientRect();
        const b = tint.getBoundingClientRect();
        const same = Math.abs(a.left - b.left) < 0.5 && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
        check('sh: acrylic covers the element, not the shadow area', same, `${JSON.stringify(a.toJSON())} vs ${JSON.stringify(b.toJSON())}`);
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
        // A rounded rectangle covers the element like the content; a mask covers the paint
        // box like the shadow canvas.
        const ref = (id === 'sh' ? root.querySelector('.content') : root.querySelector('.layer-shadow canvas')) as HTMLElement;
        const a = ref.getBoundingClientRect();
        const b = tint.getBoundingClientRect();
        const err = Math.max(Math.abs(a.left - b.left), Math.abs(a.top - b.top), Math.abs(a.right - b.right), Math.abs(a.bottom - b.bottom));
        check(`${id}: tilted acrylic lines up with the other layers`, err < 0.5, `err=${err.toFixed(3)}`);
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
