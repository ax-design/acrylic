const a = 256;

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d', { alpha: true });

const noiseCanvasData = new Promise<string>((res, rej) => {
  if (ctx) {
    const data = ctx.createImageData(a, a);
    const buffer = data.data;

    let color, alpha;
    for (let i = 0; i < buffer.length; i += 4) {
      color = Math.round(Math.random() * 255);
      alpha = Math.round(Math.random() * 255);

      for (let j = 0; j < 3; j++) {
        buffer[i + j] = color;
      }

      buffer[i + 3] = alpha;
    }

    createImageBitmap(data).then((bitmap) => {
      ctx.drawImage(bitmap, 0, 0);

      res(canvas.toDataURL("image/png"));
    });

  } else {
    rej('Ctx not found.')
  }
});

export default noiseCanvasData;