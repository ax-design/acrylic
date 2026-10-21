# Changelog

All notable changes to this package are documented in this file.

## 0.3.1

- In Safari, shapes other than rounded rectangles are cut with `clip-path` too: the glass used to vanish while the shape changed quickly, the same defect Gecko had. Chrome keeps the mask.

## 0.3.0

- Built on Surface 0.3. The acrylic follows `motion()`: it turns with a 3D motion, and the opacity of the motion is applied to the acrylic elements themselves.
- It falls back to its solid color with `prefers-reduced-transparency` or on request (`setAlwaysUseFallback()` of Surface), cross-fading into and out of it, and is solid `Canvas` in forced colors.
- The noise is 128 px square, a quarter of the work when the first acrylic is made.

## 0.2.2

- A surface with acrylic is a stacking context of its own. In Firefox, the glass of a surface inside an element with a `transform` used to turn clear as soon as it was pressed. In Firefox the glass is never transformed: it stays flat and is cut to the outline seen through the tilt, since any 3D transform in a surface turns its blur clear there. Use it with Surface 0.2.4, which tilts the rest of the surface with a 2D transform in Firefox.

## 0.2.0

- Needs Surface 0.2. The acrylic tilts its own elements, which helps Firefox show the right backdrop while the surface is pressed.
- In Firefox, shapes other than rounded rectangles are cut with `clip-path`: the glass used to vanish for a moment while the shape changed quickly. The other browsers keep the mask.
- The glass covers the bounds of the shape, whatever the shape. The blur at the edges and the noise used to jump when a corner moved off a rounded rectangle.

## 0.1.2

- Together with a layer that paints outside the shape (like a shadow), the acrylic of a rounded rectangle used to cover the whole painted area instead of the element.

## 0.1.1

- Shapes other than rounded rectangles are cut with a mask. In Chrome, the blur used to cover the whole box when the acrylic sat inside a rounded container with `overflow: hidden`.

## 0.1.0

- Acrylic runs on Surface and can be shaped with the `--ax-*` properties.
- Safari uses the blur now, it used to fall back to the plain color because only `-webkit-backdrop-filter` is available there.
- It works in Firefox, and in browsers without `CSS.registerProperty` or `createImageBitmap`.
