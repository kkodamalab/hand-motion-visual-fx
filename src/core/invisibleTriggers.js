export const TRIGGER_TYPES = ['OPEN', 'FIST', 'OPEN WAVE', 'SALUTE', 'WINK'];
export const INVISIBLE_TRIGGER_DEFAULTS = Object.freeze({
  invisibleOnTrigger: 'OPEN', invisibleOnHold: 300,
  invisibleOffTrigger: 'FIST', invisibleOffHold: 300,
});
export const RECOGNITION_HOLD_MS = 120;

export function normalizeInvisibleTriggers(settings = {}) {
  const result = {};
  for (const side of ['On', 'Off']) {
    const type = `invisible${side}Trigger`, hold = `invisible${side}Hold`;
    result[type] = TRIGGER_TYPES.includes(settings[type]) ? settings[type] : INVISIBLE_TRIGGER_DEFAULTS[type];
    const value = Number(settings[hold]);
    result[hold] = settings[hold] == null || settings[hold] === '' || !Number.isFinite(value)
      ? INVISIBLE_TRIGGER_DEFAULTS[hold] : Math.round(Math.max(100, Math.min(2000, value)) / 50) * 50;
  }
  return result;
}
export function invisibleTriggerSummary(settings) {
  const s = normalizeInvisibleTriggers(settings);
  return `INVISIBLE: ${s.invisibleOnTrigger} ${s.invisibleOnHold}ms / ${s.invisibleOffTrigger} ${s.invisibleOffHold}ms`;
}

// Pure conditions only. Duration, cooldown, and firing belong to HoldTriggerEngine.
export class InvisibleTriggerConditions {
  constructor() { this.histories = new Map(); }
  update(hands, faces, now) {
    const matches = Object.fromEntries(TRIGGER_TYPES.map(type => [type, []]));
    const wave = {amplitude: 0, reversals: 0, window: 0};
    const face = faces.find(f => f.lastSeen == null || now - f.lastSeen <= 200);
    const salute = {faceDetected: !!face, handFacePosition: false};
    const left = face?.blendshapes?.eyeBlinkLeft || 0, right = face?.blendshapes?.eyeBlinkRight || 0;
    const wink = {left, right, side: left > .65 && right < .35 ? 'LEFT' : right > .65 && left < .35 ? 'RIGHT' : ''};
    if (wink.side) matches.WINK.push(wink.side);
    const seen = new Set();
    for (const hand of hands) {
      const key = hand.label || 'hand';
      seen.add(key);
      const gesture = hand.triggerGesture ?? hand.gesture;
      if (gesture === 'OPEN' || gesture === 'FIST') matches[gesture].push(key);
      const history = this.histories.get(key) || [];
      if (gesture === 'OPEN') {
        history.push({x: hand.center.x, t: now});
        while (history.length && now - history[0].t > 1200) history.shift();
        const xs = history.map(p => p.x);
        const amplitude = Math.max(...xs) - Math.min(...xs);
        let reversals = 0, lastSign = 0;
        for (let i = 1; i < history.length; i++) {
          const dx = history[i].x - history[i - 1].x, sign = Math.abs(dx) > .008 ? Math.sign(dx) : 0;
          if (sign && lastSign && sign !== lastSign) reversals++;
          if (sign) lastSign = sign;
        }
        if (amplitude >= wave.amplitude) Object.assign(wave, {amplitude, reversals, window: now - history[0].t});
        if (reversals >= 2 && amplitude > .14) matches['OPEN WAVE'].push(key);
      } else history.length = 0;
      this.histories.set(key, history);
      if (face && hand.fingers >= 3 && gesture === 'OPEN') {
        const dx = Math.abs(hand.center.x - face.x), dy = hand.center.y - (face.y - face.size * .3);
        if (dx > face.size * .18 && dx < face.size * .75 && Math.abs(dy) < face.size * .4) {
          matches.SALUTE.push(key);
          salute.handFacePosition = true;
        }
      }
    }
    for (const key of this.histories.keys()) if (!seen.has(key)) this.histories.delete(key);
    const detected = TRIGGER_TYPES.filter(type => matches[type].length).join(' / ') || 'UNKNOWN';
    return {matches, detected, wave, salute, wink};
  }
}

export class HoldTriggerEngine {
  constructor(cooldown = 400) { this.cooldown = cooldown; this.reset(); }
  reset() { this.holds = new Map(); this.locked = new Set(); this.lastTrigger = -Infinity; }
  update(matches, activeType, hold, now, enabled) {
    for (const type of TRIGGER_TYPES) {
      const keys = matches[type] || [];
      if (!keys.length) this.locked.delete(type);
      let candidate = this.holds.get(type);
      if (!enabled || type !== activeType || !keys.length || this.locked.has(type)) this.holds.delete(type);
      else if (!candidate || !keys.includes(candidate.key)) this.holds.set(type, {key: keys[0], since: now});
    }
    const candidate = this.holds.get(activeType);
    const elapsed = candidate ? Math.max(0, now - candidate.since) : 0;
    const ready = enabled && !this.locked.has(activeType) && now - this.lastTrigger >= this.cooldown;
    const fired = !!candidate && ready && elapsed >= hold;
    if (fired) {
      this.locked.add(activeType);
      this.lastTrigger = now;
      this.holds.clear();
    }
    return {elapsed, ready, fired};
  }
}

export function invisibleTriggerDebugLines(state, debug = {}) {
  const lines = ['INVISIBLE TRIGGER DEBUG', `STATE: ${state}`, `DETECTED: ${debug.detected || 'UNKNOWN'}`];
  if (debug.event) lines.push(`TRIGGERED: INVISIBLE ${debug.event}`);
  for (const side of ['on', 'off']) {
    const d = debug[side];
    if (!d) continue;
    lines.push(`${side.toUpperCase()} · TRIGGER: ${d.type}`, `HOLD: ${Math.round(d.elapsed)} / ${d.hold} ms · READY: ${d.ready ? 'YES' : 'NO'}`);
  }
  const selected = [debug.on?.type, debug.off?.type];
  if (selected.includes('OPEN WAVE')) lines.push(`AMPLITUDE: ${(debug.wave?.amplitude || 0).toFixed(2)} · REVERSALS: ${debug.wave?.reversals || 0}`, `WINDOW: ${Math.round(debug.wave?.window || 0)} / 1200 ms`);
  if (selected.includes('SALUTE')) lines.push(`FACE DETECTED: ${debug.salute?.faceDetected ? 'YES' : 'NO'}`, `HAND-FACE POSITION: ${debug.salute?.handFacePosition ? 'TEMPLE' : 'OUTSIDE / NONE'}`, `SALUTE HOLD: ${Math.round(debug.on?.type === 'SALUTE' ? debug.on.elapsed : debug.off?.elapsed || 0)} ms`);
  if (selected.includes('WINK')) lines.push(`LEFT BLINK: ${(debug.wink?.left || 0).toFixed(2)} · RIGHT BLINK: ${(debug.wink?.right || 0).toFixed(2)}`, `WINK HOLD: ${Math.round(debug.on?.type === 'WINK' ? debug.on.elapsed : debug.off?.elapsed || 0)} ms`);
  return lines;
}
