import { readFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';

const [main, ui] = await Promise.all([
  readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/ui/controls.js', import.meta.url), 'utf8'),
]);
const required = ['#studio', '#camera', '#output', '#overlay', '#three', '#status', '#metrics', '#maskStatus', '#gestureStatus', '#importFile', '#backgroundStatus'];
for (const selector of required) {
  assert(ui.includes(`id="${selector.slice(1)}"`), `buildUI() must generate ${selector}`);
  if (main.includes(`$('${selector}')`)) assert(ui.includes(`id="${selector.slice(1)}"`), `${selector} is referenced by main.js but absent from buildUI()`);
}
assert(!main.includes("$('#home')"), 'main.js must not reference removed #home');
assert(!main.includes("$('#studio').hidden"), 'main.js must not hide/show the permanent studio');
assert(!ui.includes('Hand Twist'), 'Hand Twist menu must not be rendered');
console.log('UI contract passed');
