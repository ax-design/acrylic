// The acrylic texture as a surface layer: a backdrop blur, a tint and a noise layer, each cut to
// the surface shape. The cut goes on each element itself: a clip on an ancestor makes that
// ancestor a backdrop root, and the blur then sees nothing behind it.
// Rounded rectangles use border-radius. Other shapes use a mask of the outline, not clip-path:
// Chromium ignores an element's clip-path for its backdrop-filter when an ancestor clips its
// overflow with a border-radius (a rounded card), and filters the whole box. Gecko uses
// clip-path: while the mask image changes quickly (a shape animation, dragging a slider), it
// draws stretches of frames with the whole element masked away, decoded images or not.
// The tilt goes on the elements too: inside position: sticky, Firefox renders a backdrop-filter
// under an animated 3D transform of an ancestor with the wrong backdrop.
// The surface is a stacking context of its own (isolation: isolate, a :host rule, so any style
// of the page wins): in an ancestor with a transform, such as a tile placed by a tile group,
// Firefox turns the blur clear as soon as the surface is pressed, without it.
import type { SurfaceFrame, SurfaceLayer } from '@ax-design/surface';
import type { Contour, Segment } from '@ax-design/shape';
import { IDENTITY, apply, toSvgPath } from '@ax-design/shape';
import type { Homography, Point } from '@ax-design/shape';
import { useFallback } from '@ax-design/surface';

// WinUI's AcrylicBrush cross-fades between its glass and its fallback in 167 ms.
const FADE_MS = 167;

const STYLE = `
:host { isolation: isolate; }
.acrylic-filter, .acrylic-tint, .acrylic-noise {
  position: absolute; pointer-events: none; border-radius: var(--acrylic-shape-radius, 0);
  left: var(--acrylic-box-left, 0); top: var(--acrylic-box-top, 0); width: var(--acrylic-box-width, 100%); height: var(--acrylic-box-height, 100%);
  -webkit-mask-size: 100% 100%; mask-size: 100% 100%; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
  transform: var(--acrylic-tilt, none); transform-origin: var(--acrylic-tilt-origin, 50% 50%);
}
/* The motion opacity (--acrylic-motion, see writeOpacity) multiplies into the opacity of each
   element. The cross-fade drives the same opacity property, from 0 to the motion opacity and back,
   so the two compose without a second property. */
.acrylic-filter { opacity: var(--acrylic-motion, 1); }
.acrylic-noise { opacity: calc(var(--acrylic-noise-opacity, 0.03) * var(--acrylic-motion, 1)); }
.acrylic-tint { background-color: var(--acrylic-tint-color, black); opacity: calc(var(--acrylic-tint-opacity, 0.6) * var(--acrylic-motion, 1)); }
.acrylic-tint.fallback { background-color: var(--acrylic-fallback-color, black); opacity: var(--acrylic-motion, 1); }
.acrylic-filter {
  -webkit-backdrop-filter: blur(var(--acrylic-blur, 25px)) saturate(var(--acrylic-saturate, 200%)) brightness(var(--acrylic-brightness, 95%));
  backdrop-filter: blur(var(--acrylic-blur, 25px)) saturate(var(--acrylic-saturate, 200%)) brightness(var(--acrylic-brightness, 95%));
}
.acrylic-fallback .acrylic-filter, .acrylic-fallback .acrylic-noise { display: none; }
/* The cross-fade into or out of the fallback, only while it runs: the tint transitions its color
   and opacity, the glass fades out with acrylic-out (or back in, once drawn at opacity 0). */
.acrylic-fading .acrylic-tint { transition: background-color ${FADE_MS}ms linear, opacity ${FADE_MS}ms linear; }
.acrylic-fading .acrylic-filter, .acrylic-fading .acrylic-noise { transition: opacity ${FADE_MS}ms linear; }
.acrylic-fading.acrylic-out .acrylic-filter, .acrylic-fading.acrylic-out .acrylic-noise { opacity: 0; }
/* Forced colors (Windows High Contrast) replace the acrylic brushes with an opaque
   SystemColorWindowColor: no blur, no transparency, no noise. The fallback selector is listed
   too, so this wins over .acrylic-tint.fallback. Forced colors never fade. */
@media (forced-colors: active) {
  .acrylic-filter, .acrylic-noise { display: none; }
  .acrylic-tint, .acrylic-tint.fallback { background-color: Canvas; opacity: var(--acrylic-motion, 1); }
  .acrylic-fading .acrylic-tint, .acrylic-fading .acrylic-filter, .acrylic-fading .acrylic-noise { transition: none; }
}
`;

function supports(property: string, value: string): boolean {
    return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports(property, value);
}

// Checked once: Safari before 18 only has the prefixed backdrop-filter.
let backdropSupport: boolean | null = null;
function canBlur(): boolean {
    if (backdropSupport === null) backdropSupport = supports('backdrop-filter', 'blur(1px)') || supports('-webkit-backdrop-filter', 'blur(1px)');
    return backdropSupport;
}

// Gecko, with clip-path: path() (Firefox 71). -moz-appearance exists in Gecko only.
let clipPaths: boolean | null = null;
function useClipPath(): boolean {
    if (clipPaths === null) clipPaths = supports('-moz-appearance', 'none') && supports('clip-path', 'path("M0 0H1V1Z")');
    return clipPaths;
}

// The outline as an SVG image for mask-image. A data URL references no id, so it works with a
// <base> element on the page (old Safari resolves url(#id) against it).
function maskImage(d: string, width: number, height: number): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path d="${d}"/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// 128 x 128 random gray noise, tiled, made once per page on first use. Small: making it (and
// encoding it as PNG) runs when the first acrylic is made, which may be during an animation.
let noise: string | null = null;
function noiseTexture(): string {
    if (noise !== null) return noise;
    noise = '';
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return noise;
    const data = ctx.createImageData(size, size);
    const buffer = data.data;
    for (let i = 0; i < buffer.length; i += 4) {
        const color = Math.round(Math.random() * 255);
        buffer[i] = buffer[i + 1] = buffer[i + 2] = color;
        buffer[i + 3] = Math.round(Math.random() * 255);
    }
    ctx.putImageData(data, 0, 0);
    noise = canvas.toDataURL('image/png');
    return noise;
}

// The outline moved into the coordinates of the layer elements (their origin is the paint box).
function shifted(contour: Contour, dx: number, dy: number): Contour {
    return {
        segments: contour.segments.map((s): Segment => {
            const moved = { ...s, x0: s.x0 + dx, y0: s.y0 + dy, x1: s.x1 + dx, y1: s.y1 + dy };
            if (s.type === 'arc') return { ...moved, type: 'arc', cx: s.cx + dx, cy: s.cy + dy } as Segment;
            return moved as Segment;
        }),
    };
}

// The corner radii [top-left, top-right, bottom-right, bottom-left] when the outline is a
// rectangle of the box with circular corners, else null. Such shapes are drawn with
// border-radius, which the browser cuts for the backdrop without the cost of a mask.
export function roundedRectRadii(contour: Contour, width: number, height: number): [number, number, number, number] | null {
    const e = 0.01;
    const near = (a: number, b: number) => Math.abs(a - b) < e;
    const radii: [number, number, number, number] = [0, 0, 0, 0];
    for (const s of contour.segments) {
        if (s.type === 'line') {
            const vertical = near(s.x0, s.x1) && (near(s.x0, 0) || near(s.x0, width));
            const horizontal = near(s.y0, s.y1) && (near(s.y0, 0) || near(s.y0, height));
            if (!vertical && !horizontal) return null;
            continue;
        }
        // A clockwise quarter turn, bulging out of a box corner: the middle of the arc points
        // at the corner, and the center sits r away from both of its sides.
        const sweep = (((s.end - s.start) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        if (s.anticlockwise || !near(sweep, Math.PI / 2)) return null;
        const mid = s.start + sweep / 2;
        const right = Math.cos(mid) > 0;
        const bottom = Math.sin(mid) > 0;
        const corner = bottom ? (right ? 2 : 3) : right ? 1 : 0;
        if (!near(s.cx, right ? width - s.r : s.r) || !near(s.cy, bottom ? height - s.r : s.r)) return null;
        radii[corner] = s.r;
    }
    return radii;
}

export function createAcrylicLayer(): SurfaceLayer {
    let elements: HTMLElement[] = [];
    let root: HTMLElement | null = null;
    let lastShape = '';
    let lastTilt = '';
    // Where the elements sit, relative to the surface element: at the shape's bounds.
    let boundsLeft = 0;
    let boundsTop = 0;
    // Gecko: the cut of the last frame, and the margin the box keeps around the shape.
    let lastProjected = '';
    let projectMargin = 8;
    // The fallback as drawn: the solid tint, no blur, no noise. WinUI's AcrylicBrush draws its
    // FallbackColor when transparency effects are off or AlwaysUseFallback is set, so it follows
    // the user's preferences as they change. Null until attach or the first frame sets it.
    let inFallback: boolean | null = null;
    let appearanceSeen = false;
    // The cross-fade: `fading` while the root has acrylic-fading, `acrylic-out` while the glass is
    // (going) faded out. Its end is the transitionend of the blur, or the timer when none comes.
    let fading = false;
    let fadeTimer: number | null = null;
    // The motion opacity last written to the root (see writeOpacity).
    let lastOpacity = -1;

    const stopFadeTimer = () => {
        if (fadeTimer !== null) window.clearTimeout(fadeTimer);
        fadeTimer = null;
    };

    // The classes of the state the fade settles in. The blur and the noise are hidden (display:
    // none, the fallback class) only now, when they no longer show.
    const endFade = () => {
        stopFadeTimer();
        if (!root || !fading) return;
        fading = false;
        root.classList.remove('acrylic-fading', 'acrylic-out');
        root.classList.toggle('acrylic-fallback', inFallback === true);
        if (inFallback) elements[2].style.backgroundImage = '';
    };

    const onTransitionEnd = (e: Event) => {
        if (fading && e.target === elements[0] && (e as TransitionEvent).propertyName === 'opacity') endFade();
    };

    // Sets the fallback, only when the state changes. Without `animate` (the first state of the
    // layer, reduced motion, or no appearance on the frame) it switches at once. Otherwise the
    // glass fades out to the solid tint, or the other way, over FADE_MS. The noise is made on
    // first use, so a page that never draws it never makes it.
    const setFallback = (on: boolean, animate: boolean) => {
        if (!root || on === inFallback) return;
        inFallback = on;
        const tint = elements[1];
        const noiseEl = elements[2];
        stopFadeTimer();
        if (!animate) {
            fading = false;
            root.classList.remove('acrylic-fading', 'acrylic-out');
            root.classList.toggle('acrylic-fallback', on);
            tint.classList.toggle('fallback', on);
            noiseEl.style.backgroundImage = on ? '' : `url(${noiseTexture()})`;
            return;
        }
        if (on) {
            // The glass fades out; a fade already running goes on from where it is.
            root.classList.add('acrylic-fading', 'acrylic-out');
            tint.classList.add('fallback');
        } else {
            if (!fading) {
                // Out of the settled fallback: the blur is shown again at opacity 0, which needs
                // a style flush before the change to 1 starts the fade. Nothing is added to or
                // removed from the elements' boxes: only the display and the opacity change.
                root.classList.remove('acrylic-fallback');
                root.classList.add('acrylic-fading', 'acrylic-out');
                noiseEl.style.backgroundImage = `url(${noiseTexture()})`;
                tint.classList.remove('fallback');
                void elements[0].offsetWidth;
            } else {
                // A fade out of the glass was running: it turns back from where it is.
                noiseEl.style.backgroundImage = `url(${noiseTexture()})`;
                tint.classList.remove('fallback');
            }
            root.classList.remove('acrylic-out');
        }
        fading = true;
        fadeTimer = window.setTimeout(endFade, FADE_MS + 50);
    };

    // The motion opacity (AxSurface.motion), as --acrylic-motion on the root: the stylesheet
    // multiplies it into each element's own opacity, never into an ancestor's.
    const writeOpacity = (frame: SurfaceFrame, rs: CSSStyleDeclaration) => {
        // Missing on surfaces built before motion(): fully opaque.
        const opacity = frame.opacity === undefined ? 1 : frame.opacity;
        if (opacity === lastOpacity) return;
        lastOpacity = opacity;
        rs.setProperty('--acrylic-motion', String(opacity));
    };

    // The outline as points, its arcs in steps of about 2 px.
    const outlinePoints = (contour: Contour): Point[] => {
        const points: Point[] = [];
        for (const seg of contour.segments) {
            if (seg.type === 'line') {
                points.push({ x: seg.x0, y: seg.y0 });
                continue;
            }
            let sweep = seg.end - seg.start;
            if (seg.anticlockwise && sweep > 0) sweep -= 2 * Math.PI;
            if (!seg.anticlockwise && sweep < 0) sweep += 2 * Math.PI;
            const steps = Math.min(64, Math.max(2, Math.ceil((Math.abs(sweep) * seg.r) / 2)));
            for (let i = 0; i < steps; i++) {
                const angle = seg.start + (sweep * i) / steps;
                points.push({ x: seg.cx + seg.r * Math.cos(angle), y: seg.cy + seg.r * Math.sin(angle) });
            }
        }
        return points;
    };

    // Gecko: flat elements over the bounds and a margin, cut to the outline seen through the
    // tilt (the outline itself when flat). A 3D transform of the elements turns the backdrop
    // clear there, so the elements never transform: the blur is of the page behind, which does
    // not tilt either, and only the cut follows the tilt, exact, in the clip-path it uses
    // anyway.
    const writeProjected = (frame: SurfaceFrame, rs: CSSStyleDeclaration, shape: SurfaceFrame['shape']) => {
        const h = (frame.tilt as Homography | null) || IDENTITY;
        const points = outlinePoints(shape.outline).map((p) => apply(h, p));
        const b = shape.bounds;
        let left = b.left;
        let top = b.top;
        let right = b.right;
        let bottom = b.bottom;
        for (const p of points) {
            left = Math.min(left, p.x);
            top = Math.min(top, p.y);
            right = Math.max(right, p.x);
            bottom = Math.max(bottom, p.y);
        }
        // The box is the bounds and a margin, the same through a tilt: a backdrop-filter whose
        // box changes while it tilts can turn clear too. It only grows when the tilt needs more.
        const need = Math.ceil(Math.max(b.left - left, b.top - top, right - b.right, bottom - b.bottom, 0));
        if (need > projectMargin) projectMargin = need + 8;
        // To 1 px: the bounds of a shape in a transition wiggle by fractions of a pixel a frame,
        // and a box rewritten every frame turns the backdrop clear like a rewritten cut. A drag
        // moves by pixels a frame, so it still follows. The cut is relative to the box, so the
        // pixel the box can be off by moves the cut with it, unseen.
        const snap = (n: number) => Math.round(n);
        left = snap(b.left - projectMargin);
        top = snap(b.top - projectMargin);
        right = snap(b.right + projectMargin);
        bottom = snap(b.bottom + projectMargin);
        const round = (n: number) => Math.round(n * 100) / 100;
        const { paint } = frame;
        const d = `M${points.map((p) => `${round(p.x - left)} ${round(p.y - top)}`).join(' L')} Z`;
        const key = `${left} ${top} ${right} ${bottom} ${paint.left} ${paint.top} ${d}`;
        if (key === lastProjected) return;
        lastProjected = key;
        rs.removeProperty('--acrylic-shape-radius');
        rs.setProperty('--acrylic-box-left', `${left - paint.left}px`);
        rs.setProperty('--acrylic-box-top', `${top - paint.top}px`);
        rs.setProperty('--acrylic-box-width', `${right - left}px`);
        rs.setProperty('--acrylic-box-height', `${bottom - top}px`);
        for (const e of elements) {
            const s = e.style;
            s.setProperty('-webkit-mask-image', '');
            s.setProperty('mask-image', '');
            s.setProperty('clip-path', `path("${d}")`);
        }
    };

    // Every shape, however it is cut, covers its own bounds, so a change of the cut (a corner
    // shifted away from a rounded rectangle) leaves the elements in place. The blur near the
    // edges and the noise pattern depend on the element box, and used to jump when a rounded
    // rectangle covered the element and other shapes the whole paint box.
    const writeShape = (frame: SurfaceFrame, rs: CSSStyleDeclaration) => {
        const { paint } = frame;
        const b = frame.shape.bounds;
        const width = b.right - b.left;
        const height = b.bottom - b.top;
        const radii = roundedRectRadii(frame.shape.outline, frame.width, frame.height);
        const d = radii ? '' : toSvgPath(shifted(frame.shape.outline, -b.left, -b.top));
        const place = `${b.left - paint.left} ${b.top - paint.top} ${width} ${height}`;
        const key = radii ? `radius ${radii.join(' ')} ${place}` : `${place} ${d}`;
        if (key === lastShape) return;
        lastShape = key;
        boundsLeft = b.left;
        boundsTop = b.top;
        let mask = '';
        let clip = '';
        if (radii) {
            rs.setProperty('--acrylic-shape-radius', radii.map((r) => `${r}px`).join(' '));
        } else {
            rs.removeProperty('--acrylic-shape-radius');
            if (useClipPath()) clip = `path("${d}")`;
            else mask = maskImage(d, width, height);
        }
        // The layer box is the paint box, which other layers (an elevation shadow) may make
        // larger than the shape. Without them it is the element's box, where a shape inside
        // the box needs no placement.
        const fills = b.left === paint.left && b.top === paint.top && width === paint.width && height === paint.height;
        if (fills) {
            for (const name of ['left', 'top', 'width', 'height']) rs.removeProperty(`--acrylic-box-${name}`);
        } else {
            rs.setProperty('--acrylic-box-left', `${b.left - paint.left}px`);
            rs.setProperty('--acrylic-box-top', `${b.top - paint.top}px`);
            rs.setProperty('--acrylic-box-width', `${width}px`);
            rs.setProperty('--acrylic-box-height', `${height}px`);
        }
        for (const e of elements) {
            const s = e.style;
            s.setProperty('-webkit-mask-image', mask);
            s.setProperty('mask-image', mask);
            s.setProperty('clip-path', clip);
        }
    };

    // The origin is the center of the element's box. Surfaces before tiltsItself existed pass
    // no transform and tilt the container instead.
    const writeTilt = (frame: SurfaceFrame, rs: CSSStyleDeclaration) => {
        const transform = frame.tiltTransform || '';
        // The center of the surface element, in the coordinates of the elements' box.
        const origin = `${frame.width / 2 - boundsLeft}px ${frame.height / 2 - boundsTop}px`;
        const key = transform && `${transform}|${origin}`;
        if (key === lastTilt) return;
        lastTilt = key;
        if (transform) rs.setProperty('--acrylic-tilt', transform);
        else rs.removeProperty('--acrylic-tilt');
        if (transform) rs.setProperty('--acrylic-tilt-origin', origin);
        else rs.removeProperty('--acrylic-tilt-origin');
    };

    return {
        static: true,
        tiltsItself: true,
        attach(container) {
            root = document.createElement('div');
            root.style.display = 'contents';
            const style = document.createElement('style');
            style.textContent = STYLE;
            root.appendChild(style);
            elements = ['acrylic-filter', 'acrylic-tint', 'acrylic-noise'].map((name) => {
                const e = document.createElement('div');
                e.className = name;
                root!.appendChild(e);
                return e;
            });
            root.addEventListener('transitionend', onTransitionEnd);
            // Without backdrop-filter the first paint is the fallback; a frame may change it.
            inFallback = null;
            lastOpacity = -1;
            setFallback(!canBlur(), false);
            container.appendChild(root);
        },
        detach() {
            stopFadeTimer();
            fading = false;
            if (root && root.parentNode) root.parentNode.removeChild(root);
            root = null;
            elements = [];
            inFallback = null;
            appearanceSeen = false;
            lastOpacity = -1;
            lastShape = lastTilt = '';
            boundsLeft = boundsTop = 0;
            lastProjected = '';
            projectMargin = 8;
        },
        write(frame: SurfaceFrame) {
            if (!root) return false;
            const { changed } = frame;
            // Missing on surfaces built before the appearance API: no fallback then. The first
            // state is drawn at once; a change of the preferences after it cross-fades, unless
            // reduced motion is on or the appearance is missing.
            if (changed.appearance || !appearanceSeen) {
                const animate = appearanceSeen && !!frame.appearance && !frame.appearance.reducedMotion;
                appearanceSeen = true;
                setFallback(!canBlur() || (!!frame.appearance && useFallback(frame.appearance)), animate);
            }
            writeOpacity(frame, root.style);
            // The cut below also runs in fallback: the solid tint is the shape, so it stays cut.
            // Gecko cuts the glass the same way flat and tilted: one box, one clip-path, no
            // transform of the elements anywhere.
            if (useClipPath()) {
                if (changed.style || changed.size || changed.tilt || frame.tilt) writeProjected(frame, root.style, frame.shape);
                return false;
            }
            if (changed.style || changed.size) writeShape(frame, root.style);
            if (!useClipPath() && (changed.tilt || changed.style || changed.size)) writeTilt(frame, root.style);
            return false;
        },
    };
}
