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
import type { SurfaceFrame, SurfaceLayer } from '@ax-design/surface';
import type { Contour, Segment } from '@ax-design/shape';
import { toSvgPath } from '@ax-design/shape';

const STYLE = `
.acrylic-filter, .acrylic-tint, .acrylic-noise {
  position: absolute; pointer-events: none; border-radius: var(--acrylic-shape-radius, 0);
  left: var(--acrylic-box-left, 0); top: var(--acrylic-box-top, 0); width: var(--acrylic-box-width, 100%); height: var(--acrylic-box-height, 100%);
  -webkit-mask-size: 100% 100%; mask-size: 100% 100%; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
  transform: var(--acrylic-tilt, none); transform-origin: var(--acrylic-tilt-origin, 50% 50%);
}
.acrylic-noise { opacity: var(--acrylic-noise-opacity, 0.03); }
.acrylic-tint { background-color: var(--acrylic-tint-color, black); opacity: var(--acrylic-tint-opacity, 0.6); }
.acrylic-tint.fallback { background-color: var(--acrylic-fallback-color, black); opacity: 1; }
.acrylic-filter {
  -webkit-backdrop-filter: blur(var(--acrylic-blur, 25px)) saturate(var(--acrylic-saturate, 200%)) brightness(var(--acrylic-brightness, 95%));
  backdrop-filter: blur(var(--acrylic-blur, 25px)) saturate(var(--acrylic-saturate, 200%)) brightness(var(--acrylic-brightness, 95%));
}
.acrylic-fallback .acrylic-filter, .acrylic-fallback .acrylic-noise { display: none; }
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

// 256 x 256 random gray noise, made once per page on first use.
let noise: string | null = null;
function noiseTexture(): string {
    if (noise !== null) return noise;
    noise = '';
    const size = 256;
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
            const backdrop = canBlur();
            root = document.createElement('div');
            root.style.display = 'contents';
            if (!backdrop) root.className = 'acrylic-fallback';
            const style = document.createElement('style');
            style.textContent = STYLE;
            root.appendChild(style);
            elements = ['acrylic-filter', 'acrylic-tint', 'acrylic-noise'].map((name) => {
                const e = document.createElement('div');
                e.className = name;
                root!.appendChild(e);
                return e;
            });
            if (!backdrop) elements[1].classList.add('fallback');
            else elements[2].style.backgroundImage = `url(${noiseTexture()})`;
            container.appendChild(root);
        },
        detach() {
            if (root && root.parentNode) root.parentNode.removeChild(root);
            root = null;
            elements = [];
            lastShape = lastTilt = '';
            boundsLeft = boundsTop = 0;
        },
        write(frame: SurfaceFrame) {
            if (!root) return false;
            const { changed } = frame;
            if (changed.style || changed.size) writeShape(frame, root.style);
            if (changed.tilt || changed.style || changed.size) writeTilt(frame, root.style);
            return false;
        },
    };
}
