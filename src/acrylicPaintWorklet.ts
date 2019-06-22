const extractColor = (rgba: string): string => {
  const match = rgba.match(/\((\d+,\s*\d+,\s*\d+)[\s\S]*?\)/);

  return match && match[1] || '0, 0, 0'
}

class AcrylicBackgroundPainter implements PaintCtor {
  static get inputProperties() {
    return [
      '--acrylic-tint-color',
      '--acrylic-fallback-color',
      '--acrylic-tint-opacity',
      '--acrylic-noise-opacity',
      '--acrylic-fallback'
    ]
  }

  static get contextOptions() {
    return {
      alpha: true
    }
  }

  paint(ctx: CanvasRenderingContext2D, size: PaintSize, properties: StylePropertyMap) {

    const tintColor = extractColor(properties.get('--acrylic-tint-color').toString());
    const fallbackColor = extractColor(properties.get('--acrylic-fallback-color').toString());
    const tintOpacity = Number(properties.get('--acrylic-tint-opacity'));
    const noiseOpacity = Number(properties.get('--acrylic-noise-opacity'));
    const fallbackMode = properties.get('--acrylic-fallback').value === 'true';

    const { width, height } = size;


    if (!fallbackMode) {
      ctx.fillStyle = `rgba(${tintColor}, ${tintOpacity})`;
      ctx.fillRect(0, 0, width, height);

      let color, alpha;

      for (let x = 0; x < Math.ceil(width); x++) {
        for (let y = 0; y < Math.ceil(height); y++) {
          color = Math.round(Math.random() * 255);
          alpha = Math.round(Math.random());

          ctx.fillStyle = `rgba(${color}, ${color}, ${color}, ${alpha * noiseOpacity})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    } else {
      ctx.fillStyle = `rgba(${fallbackColor}, 1)`;
      ctx.fillRect(0, 0, width, height);
    }
  }
}

registerPaint('acrylic-background', AcrylicBackgroundPainter);