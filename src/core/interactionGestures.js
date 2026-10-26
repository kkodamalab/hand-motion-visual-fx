import { InvisibleTriggerConditions, HoldTriggerEngine, normalizeInvisibleTriggers } from './invisibleTriggers.js';
export class WinkDetector{reset(){this.candidate='';this.since=0;this.lastTrigger=-Infinity;}constructor(){this.candidate='';this.since=0;this.lastTrigger=-Infinity;}update(faces,now){const b=faces[0]?.blendshapes||{},left=b.eyeBlinkLeft||0,right=b.eyeBlinkRight||0,next=left>.65&&right<.35?'LEFT':right>.65&&left<.35?'RIGHT':'';if(next!==this.candidate){this.candidate=next;this.since=now;}if(next&&now-this.since>=180&&now-this.lastTrigger>=800){this.lastTrigger=now;this.candidate='';return next;}return '';}}
export class InvisibleGestureController {
  constructor() { this.reset(); }
  reset() {
    this.state = 'VISIBLE'; this.amount = 0;
    this.conditions = new InvisibleTriggerConditions(); this.engine = new HoldTriggerEngine();
    this.settingsKey = ''; this.event = ''; this.eventUntil = -Infinity; this.debug = {};
  }
  update(hands, faces, now, dt, transition = 1000, settings = {}) {
    const s = normalizeInvisibleTriggers(settings), key = JSON.stringify(s);
    // Editing settings cancels a partial hold but never bypasses an existing re-arm lock.
    if (key !== this.settingsKey) { this.engine.holds.clear(); this.settingsKey = key; }
    const conditions = this.conditions.update(hands, faces, now);
    const side = this.state === 'VISIBLE' ? 'on' : this.state === 'INVISIBLE' ? 'off' : null;
    const type = side === 'off' ? s.invisibleOffTrigger : s.invisibleOnTrigger;
    const hold = side === 'off' ? s.invisibleOffHold : s.invisibleOnHold;
    const result = this.engine.update(conditions.matches, type, hold, now, !!side);
    if (result.fired) {
      this.state = side === 'on' ? 'FADING OUT' : 'FADING IN';
      this.event = side.toUpperCase(); this.eventUntil = now + 1200;
    }
    const step = Math.max(0, dt) / Math.max(200, transition);
    if (this.state === 'FADING OUT') { this.amount = Math.min(1, this.amount + step); if (this.amount >= 1) this.state = 'INVISIBLE'; }
    else if (this.state === 'FADING IN') { this.amount = Math.max(0, this.amount - step); if (this.amount <= 0) this.state = 'VISIBLE'; }
    this.debug = {...conditions, event: now < this.eventUntil ? this.event : '',
      on: {type: s.invisibleOnTrigger, hold: s.invisibleOnHold, elapsed: side === 'on' ? result.elapsed : 0, ready: side === 'on' && result.ready && result.elapsed >= s.invisibleOnHold},
      off: {type: s.invisibleOffTrigger, hold: s.invisibleOffHold, elapsed: side === 'off' ? result.elapsed : 0, ready: side === 'off' && result.ready && result.elapsed >= s.invisibleOffHold}};
    return {state: this.state, amount: this.amount, gesture: conditions.detected, debug: this.debug, triggered: result.fired ? side : ''};
  }
}
export class ThrowDetector{constructor(){this.hands=new Map();this.cooldown=900;}update(hands,now,sensitivity=1){const events=[];for(const hand of hands){const key=hand.label||'hand',state=this.hands.get(key)||{history:[],lastThrow:-Infinity,peak:null};state.history.push({x:hand.center.x,y:hand.center.y,t:now});while(state.history.length&&now-state.history[0].t>300)state.history.shift();if(state.history.length>1){const a=state.history[state.history.length-2],b=state.history.at(-1),dt=Math.max(.001,(b.t-a.t)/1000),velocity={x:(b.x-a.x)/dt,y:-(b.y-a.y)/dt},speed=Math.hypot(velocity.x,velocity.y);this.debug={label:key,velocity,speed};const threshold=1.05/Math.max(.5,sensitivity);if(speed>threshold&&state.history.at(-1).t-state.history[0].t>=120)state.peak={...velocity,speed,t:now};if(state.peak&&now-state.peak.t<180&&speed<state.peak.speed*.52&&now-state.lastThrow>=this.cooldown){events.push({label:key,velocity:{x:state.peak.x,y:state.peak.y,z:.18},speed:state.peak.speed});state.lastThrow=now;state.peak=null;}}this.hands.set(key,state);}return events;}}
export function createThrownBody(mesh,event){return {mesh,detached:true,velocity:{x:event.velocity.x*1.4,y:event.velocity.y*1.4,z:event.velocity.z||.18},angular:{x:event.speed*1.2,y:event.speed*.8,z:event.speed},age:0};}
export function stepThrownBody(body,seconds,gravity){body.age+=seconds;body.velocity.y-=gravity*seconds;body.mesh.position.x+=body.velocity.x*seconds;body.mesh.position.y+=body.velocity.y*seconds;body.mesh.position.z+=body.velocity.z*seconds;body.mesh.rotation.x+=body.angular.x*seconds;body.mesh.rotation.y+=body.angular.y*seconds;body.mesh.rotation.z+=body.angular.z*seconds;return body;}
