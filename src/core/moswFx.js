export const MOSW_EFFECTS = ['rgb', 'glitch', 'mirror', 'wave', 'mono', 'invert', 'mosaic', 'strobe', 'zoom', 'film'];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function rgbSplitPixels(source, width, height, amount) {
  const offset = Math.max(0, Math.round(amount));
  const output = new Uint8ClampedArray(source.length);
  if (!offset) { output.set(source); return output; }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const target = (y * width + x) * 4;
    const redX = x + offset; // sample from the right, moving red to the left
    const blueX = x - offset; // sample from the left, moving blue to the right
    output[target] = redX < width ? source[(y * width + redX) * 4] : 0;
    output[target + 1] = source[target + 1];
    output[target + 2] = blueX >= 0 ? source[(y * width + blueX) * 4 + 2] : 0;
    output[target + 3] = source[target + 3];
  }
  return output;
}

export function resetCanvasState(context) {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
  context.filter = 'none';
  context.imageSmoothingEnabled = true;
  context.shadowBlur = 0;
  context.shadowColor = 'rgba(0, 0, 0, 0)';
  context.lineWidth = 1;
  context.lineCap = 'butt';
  context.lineJoin = 'miter';
}

export class MoswFx {
  constructor(width = 1, height = 1) {
    this.canvases = [document.createElement('canvas'), document.createElement('canvas')];
    this.pixel = document.createElement('canvas');
    this.resize(width, height);
  }

  resize(width, height) {
    this.canvases.forEach((canvas) => { canvas.width = width; canvas.height = height; });
  }

  apply(source, state, time, beat) {
    let input = source;
    let index = 0;
    const active = state.fxOrder.filter((name) => state.fxEnabled[name]).slice(0, 3);
    for (const name of active) {
      const output = this.canvases[index++ % this.canvases.length];
      const context = output.getContext('2d');
      resetCanvasState(context);
      context.clearRect(0, 0, output.width, output.height);
      context.save();
      this[name](context, input, state.fxParams[name], time, beat);
      context.restore();
      resetCanvasState(context);
      input = output;
    }
    return input;
  }

  rgb(x, src, p) {
    const width = x.canvas.width, height = x.canvas.height;
    const source = src.getContext('2d', {willReadFrequently:true}).getImageData(0, 0, width, height);
    const output = x.createImageData(width, height);
    output.data.set(rgbSplitPixels(source.data, width, height, p.amount));
    x.putImageData(output, 0, 0);
  }

  glitch(x, src, p, time) {
    x.drawImage(src, 0, 0);
    for (let i = 0; i < Math.ceil(p.amount / 3); i++) {
      const y = (Math.sin(time * .013 + i * 17) * .5 + .5) * x.canvas.height;
      const height = 2 + (i % 4) * 3;
      const offset = Math.sin(time * .031 + i) * p.amount * 2;
      x.drawImage(src, 0, y, src.width, height, offset, y, src.width, height);
    }
  }

  mirror(x, src) {
    const width = x.canvas.width;
    x.save();
    x.beginPath();
    x.rect(0, 0, width / 2, x.canvas.height);
    x.clip();
    x.drawImage(src, 0, 0);
    x.restore();
    x.save();
    x.translate(width, 0);
    x.scale(-1, 1);
    x.drawImage(src, 0, 0);
    x.restore();
  }

  wave(x, src, p, time) {
    for (let y = 0; y < x.canvas.height; y += 4) {
      x.drawImage(src, 0, y, src.width, 4, Math.sin(y * .035 + time * .004) * p.amount, y, src.width, 4);
    }
  }

  mono(x, src, p) { x.filter = `grayscale(${clamp(p.amount / 100, 0, 1)}) contrast(1.12)`; x.drawImage(src, 0, 0); }
  invert(x, src, p) { x.filter = `invert(${clamp(p.amount / 100, 0, 1)})`; x.drawImage(src, 0, 0); }

  mosaic(x, src, p) {
    const size = Math.max(2, p.amount);
    const width = Math.ceil(x.canvas.width / size);
    const height = Math.ceil(x.canvas.height / size);
    this.pixel.width = width;
    this.pixel.height = height;
    this.pixel.getContext('2d').drawImage(src, 0, 0, width, height);
    x.imageSmoothingEnabled = false;
    x.drawImage(this.pixel, 0, 0, x.canvas.width, x.canvas.height);
  }

  strobe(x, src, p, time, beat) {
    x.drawImage(src, 0, 0);
    if (beat < Math.max(.04, p.amount / 500)) {
      x.fillStyle = `rgba(255,255,255,${clamp(p.amount / 100, 0, .9)})`;
      x.fillRect(0, 0, x.canvas.width, x.canvas.height);
    }
  }

  zoom(x, src, p, time, beat) {
    const scale = 1 + (1 - beat) * p.amount / 300;
    x.translate(x.canvas.width / 2, x.canvas.height / 2);
    x.scale(scale, scale);
    x.drawImage(src, -x.canvas.width / 2, -x.canvas.height / 2);
  }

  film(x, src, p, time) {
    const amount = p.amount / 100;
    x.drawImage(src, 0, 0);
    x.globalAlpha = .08 + .2 * amount;
    x.fillStyle = '#d9a45b';
    x.fillRect(0, 0, x.canvas.width, x.canvas.height);
    x.globalAlpha = .12 * amount;
    x.fillStyle = '#fff';
    for (let i = 0; i < Math.ceil(amount * 180); i++) {
      x.fillRect((Math.sin(i * 991 + time) * .5 + .5) * x.canvas.width, (Math.sin(i * 557 + time * .7) * .5 + .5) * x.canvas.height, 1 + i % 2, 1 + i % 3);
    }
    x.globalAlpha = .25 * amount;
    x.fillStyle = '#000';
    for (let y = 0; y < x.canvas.height; y += 4) x.fillRect(0, y, x.canvas.width, 1);
  }
}
