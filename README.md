<h1 align="center">
  <img src="https://raw.githubusercontent.com/ax-design/acrylic/master/docs/logo.png" alt="acrylic">
</h1>

<p align="center">
  Web component that implements Acrylic texture of Axiom Design System.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@ax-design/acrylic"><img src="https://img.shields.io/npm/v/@ax-design/acrylic.svg" alt="npm version"></a>
  <a href="https://travis-ci.com/ax-design/acrylic"><img src="https://travis-ci.com/ax-design/acrylic.svg?branch=master" alt="CI Status"></a>
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="MIT Licence" />

</p>

<!-- <p align="center">
  <img src="https://raw.githubusercontent.com/ax-design/acrylic/master/docs/screen-record.gif" alt="Screenshot">
</p> -->

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

To add a reveal effect on your web application, you need to wrap a `ax-acrylic` component with the component you want to add tile effect.
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