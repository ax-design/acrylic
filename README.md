<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/ax-design/acrylic/master/docs/logo-r.png">
    <img src="https://raw.githubusercontent.com/ax-design/acrylic/master/docs/logo.png" alt="Ax Acrylic">
  </picture>
</h1>

<p align="center">
  Web component that implements Acrylic texture of Axiom Design System.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@ax-design/acrylic"><img src="https://img.shields.io/npm/v/@ax-design/acrylic.svg" alt="npm version"></a>
  <a href="https://github.com/ax-design/acrylic/actions/workflows/ci.yml"><img src="https://github.com/ax-design/acrylic/actions/workflows/ci.yml/badge.svg" alt="CI Status"></a>
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="MIT Licence" />
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/ax-design/acrylic/master/docs/screenshot.png" alt="Screenshot">
</p>

## Installation

```bash
// with npm
npm install @ax-design/acrylic

// with yarn
yarn add @ax-design/acrylic
```

and import it:

```javascript
//CommonJS
require('@ax-design/acrylic').register();

//ESModule
import { register } from '@ax-design/acrylic';
register();
```

## Usage

To add an acrylic texture on your web application, you need to wrap a `ax-acrylic` component with the component you want to add acrylic texture.
Here's an example:

```html
<ax-acrylic>
  Acrylic!
</ax-acrylic>
```

## Style Controlling

Acrylic component uses custom properties to manage the style of the tile effect.


### --acrylic-tint-color

**Type:** `<color>`

**Default:** `black`

**Description:** The base color of your Acrylic texture if `dropback-filter` is available for your user.


### --acrylic-tint-opacity

**Type:** `number`

**Default:** `0.6`

**Description:** The opacity of your Actylic texture if `dropback-filter` is available for your user.


### --acrylic-fallback-color

**Type:** `<color>`

**Default:** `black`

**Description:** The color of the Acrylic texture if `dropback-filter` is not available for your user, PLEASE NOTICE THAT there isn't an option called `--acrylic-fallback-opacity`, the opacity of fallback Acrylic texture is always 1 for the concern of a11y.

### --acrylic-noise-opacity

**Type:** `number`

**Default:** `0.03`

**Description:** The opacity of the noise layer, please notice that while in fallback mode, the noise layer will be removed.

### --acrylic-blur

**Type:** `<length>`

**Default:** `20px`

**Description:** The radius of blur filter, The greater the radius means the deeper blur effect.

### --acrylic-saturate

**Type:** `<percentage>`

**Default:** `200%`

**Description:** The saturation of the blurred background.

### --acrylic-brightness

**Type:** `<percentage>`

**Default:** `95%`

**Description:** The brightness of the blurred background.

## Shapes

`ax-acrylic` runs on [Surface](https://github.com/ax-design/surface), so the texture follows the Surface shape properties, like `--ax-radius` or `--ax-corner-shape`:

```css
ax-acrylic {
  --ax-radius: 16px;
}
```

The texture is also a layer of `ax-surface`. Here's a tilting surface with acrylic and reveal highlight on the same shape:

```html
<ax-surface layers="acrylic reveal" style="--ax-radius: 16px; --ax-tilt-mode: absolute">
  Hello
</ax-surface>
```

## Changes in 0.1

* Acrylic runs on Surface and can be shaped with the `--ax-*` properties.
* Safari uses the blur now, it used to fall back to the plain color because only `-webkit-backdrop-filter` is available there.
* It works in Firefox, and in browsers without `CSS.registerProperty` or `createImageBitmap`.
* 0.1.1: Shapes other than rounded rectangles are cut with a mask. In Chrome, the blur used to cover the whole box when the acrylic sat inside a rounded container with `overflow: hidden`.
* 0.1.2: Together with a layer that paints outside the shape (like a shadow), the acrylic of a rounded rectangle used to cover the whole painted area instead of the element.

## Changes in 0.2

* Needs Surface 0.2. The acrylic tilts its own elements, so it shows the right backdrop in Firefox inside `position: sticky` while the surface is pressed.
* In Firefox, shapes other than rounded rectangles are cut with `clip-path`: the glass used to vanish for a moment while the shape changed quickly. The other browsers keep the mask.
* The glass covers the bounds of the shape, whatever the shape. The blur at the edges and the noise used to jump when a corner moved off a rounded rectangle.

## Development

```bash
bun install
bun run build         # es/, build/index.mjs, build/main.js
bun run check         # type check
bun run test:browser  # browser tests
```
