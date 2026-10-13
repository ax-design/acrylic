// The acrylic texture as a surface layer: a backdrop blur, a tint and a noise layer, each
// clipped to the surface shape. The clip goes on each element itself: a clip on an ancestor
// makes that ancestor a backdrop root, and the blur then sees nothing behind it.
import type { SurfaceFrame, SurfaceLayer } from '@ax-design/surface';
import type { Contour, Segment } from '@ax-design/shape';
import { toSvgPath } from '@ax-design/shape';

const STYLE = `
.acrylic-filter, .acrylic-tint, .acrylic-noise { position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; }
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
            const d = toSvgPath(shifted(frame.shape.outline, -frame.paint.left, -frame.paint.top));
            if (d === lastClip) return false;
            lastClip = d;
            let value: string;
            if (clipPath) {
                clipPath.setAttribute('d', d);
                value = `url(#${id})`;
            } else {
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
