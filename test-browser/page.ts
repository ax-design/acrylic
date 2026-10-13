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
    const rect = (id: string) => document.getElementById(id)!.getBoundingClientRect().toJSON();
    return { userAgent: navigator.userAgent, checks, rects: { a: rect('a'), s: rect('s') }, dpr: devicePixelRatio, fallback };
}

run().then(
    (r) => (window.__result = r),
    (e) => (window.__result = { error: String((e && e.stack) || e) })
);
