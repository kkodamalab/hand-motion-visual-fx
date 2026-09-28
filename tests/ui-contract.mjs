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
console.log('UI contract passed');
