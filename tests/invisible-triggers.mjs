import {strict as assert} from 'node:assert';
import {InvisibleGestureController} from '../src/core/interactionGestures.js';
import {GestureDetector} from '../src/core/gestureDetector.js';
import {INVISIBLE_TRIGGER_DEFAULTS, normalizeInvisibleTriggers, invisibleTriggerDebugLines} from '../src/core/invisibleTriggers.js';

const hand=(gesture='OPEN',x=.4,y=.5,label='Left')=>({gesture,fingers:gesture==='OPEN'?4:0,center:{x,y},label});
const update=(c,t,h=[hand()],s={},dt=0,f=[])=>c.update(h,f,t,dt,200,s);
let c=new InvisibleGestureController();
assert.equal(update(c,0).triggered,'');
assert.equal(update(c,299).state,'VISIBLE');assert.equal(c.debug.on.ready,false);
assert.equal(update(c,300).triggered,'on');
assert.equal(c.state,'FADING OUT');assert.equal(c.debug.on.ready,true);
assert.equal(update(c,400,[hand('FIST')],{},100).triggered,'','no triggers during fade');
assert.equal(update(c,500,[hand('FIST')],{},100).state,'INVISIBLE');
assert.equal(update(c,501,[hand('FIST')]).triggered,'','OFF hold starts after fade');
assert.equal(update(c,800,[hand('FIST')]).triggered,'');
assert.equal(update(c,801,[hand('FIST')]).triggered,'off');
assert.equal(update(c,1001,[hand('FIST')],{},200).state,'VISIBLE');

// Same trigger on both sides must be released, even across a completed transition.
c=new InvisibleGestureController();const same={invisibleOffTrigger:'OPEN'};
update(c,0,[hand()],same);assert.equal(update(c,300,[hand()],same).triggered,'on');
update(c,500,[hand()],same,200);
assert.equal(update(c,1500,[hand()],same).triggered,'');
update(c,1510,[],same);update(c,1520,[hand()],same);
assert.equal(update(c,1819,[hand()],same).triggered,'');
assert.equal(update(c,1820,[hand()],same).triggered,'off');
update(c,2020,[hand()],same,200);assert.equal(update(c,4000,[hand()],same).triggered,'');

// Interrupted holds, different hands, and configuration edits cannot accumulate time.
c=new InvisibleGestureController();update(c,0);update(c,200,[hand('UNKNOWN')]);update(c,250);
assert.equal(update(c,549).triggered,'');assert.equal(update(c,550).triggered,'on');
c=new InvisibleGestureController();update(c,0);update(c,200,[hand('OPEN',.4,.5,'Right')]);
assert.equal(update(c,300,[hand('OPEN',.4,.5,'Right')]).triggered,'');
c=new InvisibleGestureController();update(c,0);update(c,250,[hand()],{invisibleOnHold:500});
assert.equal(update(c,500,[hand()],{invisibleOnHold:500}).triggered,'');
assert.equal(update(c,750,[hand()],{invisibleOnHold:500}).triggered,'on');

// FIST is independently selectable for ON, and uses the same boundary.
c=new InvisibleGestureController();const fist={invisibleOnTrigger:'FIST'};
update(c,0,[hand('FIST')],fist);assert.equal(update(c,299,[hand('FIST')],fist).triggered,'');
assert.equal(update(c,300,[hand('FIST')],fist).triggered,'on');

// Wave evidence survives long enough to apply a configurable hold; missing hands clear it.
c=new InvisibleGestureController();const wave={invisibleOnTrigger:'OPEN WAVE'};
for(const [t,x] of [[0,.3],[100,.55],[200,.3],[300,.55]])assert.equal(update(c,t,[hand('OPEN',x)],wave).triggered,'');
assert.equal(update(c,599,[hand('OPEN',.3)],wave).triggered,'');
assert.equal(update(c,600,[hand('OPEN',.55)],wave).triggered,'on');
assert.ok(c.debug.wave.amplitude>.14);assert.ok(c.debug.wave.reversals>=2);
update(c,620,[],wave);assert.equal(c.conditions.histories.size,0);

// Salute needs a current face and continuous hand position, including at timestamp zero.
c=new InvisibleGestureController();const salute={invisibleOnTrigger:'SALUTE'},face={x:.5,y:.3,size:.2};
update(c,0,[hand('OPEN',.58,.24)],salute,0,[face]);
assert.equal(update(c,299,[hand('OPEN',.58,.24)],salute,0,[face]).triggered,'');
assert.equal(update(c,300,[hand('OPEN',.58,.24)],salute,0,[face]).triggered,'on');
c=new InvisibleGestureController();update(c,0,[hand('OPEN',.58,.24)],salute,0,[face]);
update(c,200,[],salute,0,[face]);assert.equal(update(c,400,[hand('OPEN',.58,.24)],salute,0,[face]).triggered,'');
assert.equal(update(c,800,[hand('OPEN',.58,.24)],salute,0,[{...face,lastSeen:0}]).triggered,'');

// WINK is a raw unilateral condition: both-eye blinking, side changes, and stale faces break holds.
const wink={invisibleOnTrigger:'WINK',invisibleOffTrigger:'WINK'},winkFace={blendshapes:{eyeBlinkLeft:.9,eyeBlinkRight:.1}};
c=new InvisibleGestureController();update(c,0,[],wink,0,[winkFace]);
assert.equal(update(c,299,[],wink,0,[winkFace]).triggered,'');
assert.equal(update(c,300,[],wink,0,[winkFace]).triggered,'on');
update(c,500,[],wink,200,[winkFace]);assert.equal(update(c,1000,[],wink,0,[winkFace]).triggered,'');
update(c,1010,[],wink,0,[{blendshapes:{eyeBlinkLeft:.9,eyeBlinkRight:.9}}]);
update(c,1020,[],wink,0,[winkFace]);assert.equal(update(c,1320,[],wink,0,[winkFace]).triggered,'off');
c=new InvisibleGestureController();update(c,0,[],wink,0,[winkFace]);
const rightFace={blendshapes:{eyeBlinkLeft:.1,eyeBlinkRight:.9}};
update(c,200,[],wink,0,[rightFace]);assert.equal(update(c,300,[],wink,0,[rightFace]).triggered,'');
assert.equal(update(c,600,[],wink,0,[{...rightFace,lastSeen:0}]).triggered,'');

// Basic finger extension criteria are unchanged; the trigger channel clears sticky recognition.
const detector=new GestureDetector();
const points=count=>{const p=Array.from({length:21},()=>({x:0,y:.1}));p[0]={x:0,y:0};for(const [i,tip] of [8,12,16,20].entries()){p[tip-2]={x:.2,y:0};p[tip]={x:i<count?.3:.1,y:0};}return p;};
const sample=count=>({landmarks:[points(count)],handednesses:[[{categoryName:'Left'}]]});
for(const count of [0,1,2,3,4]){
 const d=new GestureDetector();d.update(sample(count),0,1,1,120);
 assert.equal(d.update(sample(count),120,1,1,120).hands[0].triggerGesture,count>=3?'OPEN':count<=1?'FIST':'UNKNOWN');
}
detector.update(sample(4),0,1,1);assert.equal(detector.update(sample(4),120,1,1).hands[0].triggerGesture,'OPEN');
assert.equal(detector.update(sample(2),150,1,1).hands[0].triggerGesture,'UNKNOWN');
detector.update({landmarks:[]},160,1,1);assert.equal(detector.update(sample(4),170,1,1).hands[0].triggerGesture,'UNKNOWN');

assert.deepEqual(normalizeInvisibleTriggers({invisibleOnTrigger:'VOICE',invisibleOnHold:'bad',invisibleOffHold:Infinity}),INVISIBLE_TRIGGER_DEFAULTS);
assert.equal(normalizeInvisibleTriggers({invisibleOnHold:49}).invisibleOnHold,100);
assert.equal(normalizeInvisibleTriggers({invisibleOnHold:2500}).invisibleOnHold,2000);
assert.equal(normalizeInvisibleTriggers({invisibleOnHold:326}).invisibleOnHold,350);
const lines=invisibleTriggerDebugLines('VISIBLE',{...c.debug,on:{type:'WINK',hold:300,elapsed:140,ready:true},off:{type:'SALUTE',hold:300,elapsed:0,ready:false},event:'ON'}).join('\n');
for(const text of ['TRIGGERED: INVISIBLE ON','LEFT BLINK','RIGHT BLINK','WINK HOLD','FACE DETECTED','HAND-FACE POSITION','SALUTE HOLD','140 / 300'])assert.ok(lines.includes(text));
console.log('Invisible trigger tests passed (boundaries, re-arm, transitions, all five conditions, settings validation, debug)');
