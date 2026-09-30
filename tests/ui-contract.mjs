import { readFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';

const [main, ui, renderer] = await Promise.all([
  readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/ui/controls.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/renderer.js', import.meta.url), 'utf8'),
]);
const required = ['#studio', '#camera', '#output', '#overlay', '#three', '#status', '#metrics', '#maskStatus', '#gestureStatus', '#importFile', '#backgroundStatus'];
for (const selector of required) {
  assert(ui.includes(`id="${selector.slice(1)}"`), `buildUI() must generate ${selector}`);
  if (main.includes(`$('${selector}')`)) assert(ui.includes(`id="${selector.slice(1)}"`), `${selector} is referenced by main.js but absent from buildUI()`);
}
assert(!main.includes("$('#home')"), 'main.js must not reference removed #home');
assert(!main.includes("$('#studio').hidden"), 'main.js must not hide/show the permanent studio');
assert(!ui.includes('Hand Twist'), 'Hand Twist menu must not be rendered');
assert(main.includes('scheduleBackgroundCapture'), 'background capture must be independent from segmentation');
assert(main.includes("background=renderer.capture(video)"), 'camera frames must be capturable without a mask');
assert(renderer.includes("if(!bg||!seg?.data)"), 'invisible rendering must require both background and mask');
assert(main.includes('backgroundPreview'), 'background preview must be wired');
assert(main.includes('backgroundDifference'), 'background-difference fallback must be wired');
assert(main.includes('differenceSensitivity'), 'background-difference sensitivity must be exposed');
assert(main.includes('segmenter.loading'), 'segmenter initialization promise must be shared');
assert(main.includes('segmenter.failed'), 'segmenter failure must stop retry loops');
assert(renderer.includes('!bg||!seg?.data'), 'invisible effect must wait for background and mask');
console.log('UI contract passed');

const mosw = await readFile(new URL('../src/core/moswFx.js', import.meta.url), 'utf8');
for (const effect of ['rgb','glitch','mirror','wave','mono','invert','mosaic','strobe','zoom','film']) {
  assert(ui.includes(`'${effect}'`), `${effect} must be included in the FX catalog`);
  assert(mosw.includes(`  ${effect}(`), `${effect} must have a rendering implementation`);
}
assert(main.includes('active>=3'), 'the UI must enforce the three-effect limit');
assert(main.includes('getUserMedia({audio:true})'), 'microphone sync must request an audio stream');
assert(renderer.includes("s.frameRenderer !== 'mosw'"), 'Hand Frame must bypass classic processing in MOSW mode');
assert(renderer.includes('drawClippedFrame(this.x, rendered, quad)'), 'MOSW FX must be clipped to Hand Frame mode');
assert(ui.includes('value="classic"') && ui.includes('value="mosw"'), 'Hand Frame must offer CLASSIC / MOSW FX modes');

assert(main.includes('stream?.getTracks().forEach((track) => track.stop())'), 'microphone tracks must stop when sync is disabled');
assert(main.includes('await context.close()'), 'the microphone AudioContext must close when sync is disabled');
