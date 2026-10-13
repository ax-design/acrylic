import { expect, test } from 'bun:test';
import { resolve } from '@ax-design/shape';
import type { CornerShape, EdgeSpec } from '@ax-design/shape';
import { roundedRectRadii } from '../src/layer.js';

const flat: EdgeSpec = { kind: 'flat', depth: 0, span: 0, at: 0.5, ratio: 0.5, tipRadius: 0, shoulderRadius: 0 };
const corner = (radius: number, shape: CornerShape = 'round', shiftX = 0) => ({ radius, shape, shiftX, shiftY: 0 });
const outline = (corners: ReturnType<typeof corner>[], edges: EdgeSpec[] = [flat, flat, flat, flat]) =>
    resolve({ width: 200, height: 100, corners: corners as never, edges: edges as never }).outline;

test('rectangles and round corners are border-radius shapes', () => {
    expect(roundedRectRadii(outline([corner(0), corner(0), corner(0), corner(0)]), 200, 100)).toEqual([0, 0, 0, 0]);
    expect(roundedRectRadii(outline([corner(12), corner(12), corner(12), corner(12)]), 200, 100)).toEqual([12, 12, 12, 12]);
    expect(roundedRectRadii(outline([corner(4), corner(0), corner(30), corner(8)]), 200, 100)).toEqual([4, 0, 30, 8]);
    // Radii that do not fit are scaled down first; the result is still a rounded rectangle.
    const big = roundedRectRadii(outline([corner(80), corner(80), corner(80), corner(80)]), 200, 100)!;
    expect(big.every((r) => Math.abs(r - 50) < 0.01)).toBe(true);
});

test('other shapes need a clip path', () => {
    for (const shape of ['bevel', 'scoop', 'notch'] as CornerShape[]) {
        expect(roundedRectRadii(outline([corner(12, shape), corner(12), corner(12), corner(12)]), 200, 100)).toBeNull();
    }
    expect(roundedRectRadii(outline([corner(12, 'round', 20), corner(12), corner(12), corner(12)]), 200, 100)).toBeNull();
    for (const depth of [10, -10]) {
        const arc: EdgeSpec = { ...flat, kind: 'arc', depth, span: 40 };
        expect(roundedRectRadii(outline([corner(0), corner(0), corner(0), corner(0)], [flat, arc, flat, flat]), 200, 100)).toBeNull();
    }
});
