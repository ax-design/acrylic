import 'resize-observer-browser';
import { AxAcrylic } from './CustomElements';

interface AcrylicStyle {
  tintColor: string;
  fallbackColor: string;
  tintOpacity: number;
  noiseOpacity: number;
  blur: number;
  saturate: number;
  brightness: number;
}

const extractColor = (rgba: string): string => {
  const match = rgba.match(/\((\d+,\s*\d+,\s*\d+)[\s\S]*?\)/);

  return match && match[1] || '0, 0, 0'
}

const getStyle = ($inEl: HTMLElement): AcrylicStyle => {
  const computedStyle = $inEl.computedStyleMap();

  return {
    tintColor: extractColor(computedStyle.get('--acrylic-tint-color').toString()),
    fallbackColor: extractColor(computedStyle.get('--acrylic-fallback-color').toString()),
    tintOpacity: computedStyle.get('--acrylic-tint-opacity').value as number,
    noiseOpacity: computedStyle.get('--acrylic-noise-opacity').value as number,
    blur: computedStyle.get('--acrylic-blur').value as number,
    saturate: computedStyle.get('--acrylic-saturate').value as number,
    brightness: computedStyle.get('--acrylic-brightness').value as number,
  }
}

const resizeObserver = new window.ResizeObserver(entries => {
  entries.forEach(entry => paintAcrylic(entry.target as HTMLCanvasElement, entry.contentRect));
});

const addCanvas = ($el: HTMLCanvasElement) => {
  resizeObserver.observe($el);
}

const removeCanvas = ($el: HTMLCanvasElement) => {
  resizeObserver.unobserve($el);
}

const paintAcrylic = ($el: HTMLCanvasElement, rect: DOMRectReadOnly): void => {
  const props = getStyle($el);

  let {width, height} = rect;

  width = Math.ceil(width);
  height = Math.ceil(height);

  $el.width = width;
  $el.height = height;

  const ctx = $el.getContext('2d');

  if (!ctx) return;

  if ('backdropFilter' in document.documentElement.style) {
    $el.style.backdropFilter = `saturate(${props.saturate}%) blur(${props.blur}px) brightness(${props.brightness}%)`;

    ctx.fillStyle = `rgba(${props.tintColor}, ${props.tintOpacity})`;
    ctx.fillRect(0, 0, width, height);

    console.log(width, height);


    const data = ctx.createImageData(width, height);
    const buffer = data.data;

    let color, alpha;
    for (let i = 0; i < buffer.length; i += 4) {
      color = Math.round(Math.random() * 255);
      alpha = Math.round(Math.random() * 255);

      for (let j = 0; j < 3; j++) {
        buffer[i + j] = color;
      }

      buffer[i + 3] = alpha * props.noiseOpacity;
    }

    createImageBitmap(data).then((bitmap) => {
      ctx.drawImage(bitmap, 0, 0);
    });
  } else {
    ctx.fillStyle = `rgba(${props.fallbackColor}, 1)`;
    ctx.fillRect(0, 0, width, height);
  }
}

export { addCanvas, removeCanvas }