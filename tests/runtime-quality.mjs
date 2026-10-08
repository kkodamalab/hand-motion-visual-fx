import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {selectedFingertips,FINGER_TIPS} from '../src/core/threeOverlay.js';
import {FXRenderer,handFlowForce} from '../src/core/renderer.js';
import {FaceExpressionSmoother} from '../src/core/faceExpressions.js';

// TEST 1: all five MediaPipe tips can be selected independently, including none.
const hand={p:Array.from({length:21},(_,i)=>({x:i/21,y:i/21})),speed:0};
for(const name of Object.keys(FINGER_TIPS)){const selected=Object.fromEntries(Object.keys(FINGER_TIPS).map(key=>[key,key===name]));const points=selectedFingertips([hand],selected);assert.equal(points.length,1);assert.equal(points[0].p,hand.p[FINGER_TIPS[name]]);}
assert.equal(selectedFingertips([hand],{}).length,0);
assert.equal(selectedFingertips([hand,hand],{thumb:true,index:true}).length,4);

class ContextSpy{
  constructor(){this.rects=[];this.images=[];this.clips=0;this.stack=[];this.globalCompositeOperation='source-over';}
  save(){this.stack.push(1);} restore(){this.stack.pop();} fillRect(...v){this.rects.push(v);} drawImage(...v){this.images.push(v);} clearRect(){} beginPath(){} moveTo(){} lineTo(){} closePath(){} clip(){this.clips++;} translate(){} rotate(){} arc(){} fill(){this.fills=(this.fills||0)+1;} stroke(){} fillText(){} setTransform(){} getImageData(){return {data:new Uint8ClampedArray(4)}} putImageData(){}
}
const layerContext=new ContextSpy(),mainContext=new ContextSpy();
const renderer=Object.create(FXRenderer.prototype);Object.assign(renderer,{c:{width:320,height:180},x:mainContext,particleLayer:{getContext:()=>layerContext},particles:[],lastParticleTime:0,particleCursor:0,stableQuad:null,quadSeen:0,emoji:{draw:(ctx,name)=>{ctx.emoji=(ctx.emoji||[]).concat(name);}}});
renderer.point=FXRenderer.prototype.point;
const settings={particles:30,particleSize:3,particleColor:'#35f4ff',particleMode:'hand',flowStrength:2,flowRadius:160,particleTrail:55,speed:1,mirror:false};
// TEST 2: no segmentation and no hand data still produce visible particle draw calls.
renderer.dissolve(settings,null,{hands:[]},1000);assert.equal(renderer.particles.length,30);assert.equal(layerContext.rects.length+(layerContext.fills||0),31);assert.equal(mainContext.images.length,1);
// TEST 3/4: force direction is radial-out for OPEN and inward for FIST.
const particle={x:140,y:90},center={x:100,y:90};
const openForce=handFlowForce(particle,[{gesture:'OPEN',screen:center}],settings);assert.ok(openForce.x>0,'OPEN must push away from center');
const fistForce=handFlowForce(particle,[{gesture:'FIST',screen:center}],settings);assert.ok(fistForce.x<0,'FIST must pull toward center');
// TEST 5: independent opposite gestures both contribute to one force field.
const mixed=handFlowForce({x:160,y:90},[{gesture:'OPEN',screen:{x:80,y:90}},{gesture:'FIST',screen:{x:240,y:90}}],settings);assert.ok(mixed.x>0,'OPEN source and FIST sink must combine left-to-right');

const quad=[{x:40,y:30},{x:280,y:40},{x:260,y:160},{x:50,y:150}],inside={x:.5,y:.5,size:.2,angle:0,expression:'SMILE'},outside={x:.02,y:.02,size:.2,angle:0,expression:'ANGRY'};
renderer.path=FXRenderer.prototype.path;renderer.facesInsideFrame=FXRenderer.prototype.facesInsideFrame;
// TEST 6: emoji rendering is forbidden without an active hand frame.
assert.equal(renderer.drawFaceEmojis([inside],settings,1000),0);assert.equal(mainContext.emoji,undefined);
// TEST 7/8: only inside faces render and the exact shared quad clips drawing.
renderer.stableQuad=quad;renderer.quadSeen=900;assert.equal(renderer.drawFaceEmojis([inside,outside],{...settings,emojiSize:1},1000),1);assert.deepEqual(mainContext.emoji,['SMILE']);assert.equal(mainContext.clips,1);

// TEST 9: sustained Blendshape change switches emoji, not a one-frame spike.
const landmarks=Array.from({length:478},()=>({x:.4,y:.4}));landmarks[33]={x:.4,y:.4};landmarks[263]={x:.6,y:.4};landmarks[10]={x:.5,y:.2};landmarks[152]={x:.5,y:.7};
const cats=values=>Object.entries(values).map(([categoryName,score])=>({categoryName,score}));const result=values=>({faceLandmarks:[landmarks],faceBlendshapes:[{categories:cats(values)}]});
const smoother=new FaceExpressionSmoother();let face=smoother.update(result({mouthSmileLeft:.9,mouthSmileRight:.9}),0)[0];assert.equal(face.expression,'SMILE');face=smoother.update(result({browDownLeft:1,browDownRight:1}),100)[0];assert.equal(face.expression,'SMILE');for(const time of [250,400,550,700])face=smoother.update(result({browDownLeft:1,browDownRight:1}),time)[0];assert.equal(face.expression,'ANGRY');

// TEST 10: legacy render paths remain wired and existing suites exercise their pixels/masks.
const source=await readFile(new URL('../src/core/renderer.js',import.meta.url),'utf8');for(const method of ['frame(v,d,s','invisibleFx(s,bg,seg)','classicFrame(context,s)'])assert.ok(source.includes(method));
console.log('Runtime quality tests passed');
