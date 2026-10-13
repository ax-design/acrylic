// The acrylic texture as a surface layer: a backdrop blur, a tint and a noise layer, each
// clipped to the surface shape. The clip goes on each element itself: a clip on an ancestor
// makes that ancestor a backdrop root, and the blur then sees nothing behind it.
import type { SurfaceFrame, SurfaceLayer } from '@ax-design/surface';
import type { Contour, Segment } from '@ax-design/shape';
import { toSvgPath } from '@ax-design/shape';

const STYLE = `
.acrylic-filter, .acrylic-tint, .acrylic-noise { position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; border-radius: var(--acrylic-shape-radius, 0); }
.acrylic-noise { opacity: var(--acrylic-noise-opacity, 0.03); }
.acrylic-tint { background-color: var(--acrylic-tint-color, black); opacity: var(--acrylic-tint-opacity, 0.6); }
.acrylic-tint.fallback { background-color: var(--acrylic-fallback-color, black); opacity: 1; }
.acrylic-filter {
  -webkit-backdrop-filter: blur(var(--acrylic-blur, 25px)) saturate(var(--acrylic-saturate, 200%)) brightness(var(--acrylic-brightness, 95%));
  backdrop-filter: blur(var(--acrylic-blur, 25px)) saturate(var(--acrylic-saturate, 200%)) brightness(var(--acrylic-brightness, 95%));
}
.acrylic-fallback .acrylic-filter, .acrylic-fallback .acrylic-noise { display: none; }
`;

const SVG_NS = 'http://www.w3.org/2000/svg';

function supports(property: string, value: string): boolean {
    return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports(property, value);
}

// Checked once: Safari before 18 only has the prefixed backdrop-filter.
let capabilities: { backdrop: boolean; path: boolean } | null = null;
function capable() {
    if (!capabilities) {
        capabilities = {
            backdrop: supports('backdrop-filter', 'blur(1px)') || supports('-webkit-backdrop-filter', 'blur(1px)'),
            // path() avoids url(#id), which old Safari fails to resolve on pages with a <base>.
            path: supports('clip-path', 'path("M0 0")') || supports('-webkit-clip-path', 'path("M0 0")'),
        };
    }
    return capabilities;
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
// border-radius, which the browser clips for the backdrop without the cost of a clip path.
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

let instance = 0;

export function createAcrylicLayer(): SurfaceLayer {
    const id = `ax-acrylic-clip-${instance++}`;
    let elements: HTMLElement[] = [];
    let root: HTMLElement | null = null;
    let clipPath: SVGPathElement | null = null;
    let lastClip = '';

    return {
        static: true,
        attach(container) {
            const { backdrop, path } = capable();
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
            if (!path) {
                const svg = document.createElementNS(SVG_NS, 'svg');
                svg.setAttribute('width', '0');
                svg.setAttribute('height', '0');
                svg.setAttribute('aria-hidden', 'true');
                svg.style.position = 'absolute';
                const clip = document.createElementNS(SVG_NS, 'clipPath');
                clip.setAttribute('id', id);
                clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
                clipPath = document.createElementNS(SVG_NS, 'path');
                clip.appendChild(clipPath);
                svg.appendChild(clip);
                root.appendChild(svg);
            }
            container.appendChild(root);
        },
        detach() {
            if (root && root.parentNode) root.parentNode.removeChild(root);
            root = null;
            elements = [];
            clipPath = null;
            lastClip = '';
        },
        write(frame: SurfaceFrame) {
            if (!root || (!frame.changed.style && !frame.changed.size)) return false;
            const radii = roundedRectRadii(frame.shape.outline, frame.width, frame.height);
            const d = radii ? `radius ${radii.join(' ')}` : toSvgPath(shifted(frame.shape.outline, -frame.paint.left, -frame.paint.top));
            if (d === lastClip) return false;
            lastClip = d;
            let value: string;
            if (radii) {
                root.style.setProperty('--acrylic-shape-radius', radii.map((r) => `${r}px`).join(' '));
                value = '';
            } else if (clipPath) {
                root.style.removeProperty('--acrylic-shape-radius');
                clipPath.setAttribute('d', d);
                value = `url(#${id})`;
            } else {
                root.style.removeProperty('--acrylic-shape-radius');
                value = `path('${d}')`;
            }
            for (const e of elements) {
                e.style.setProperty('-webkit-clip-path', value);
                e.style.setProperty('clip-path', value);
            }
            return false;
        },
    };
}
