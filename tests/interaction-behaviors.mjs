import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {FXRenderer} from '../src/core/renderer.js';
import {bodyAxis} from '../src/core/poseTracker.js';
import {stepBodyWindParticles} from '../src/core/particleFlow.js';
import {WinkDetector,InvisibleGestureController,ThrowDetector,createThrownBody,stepThrownBody} from '../src/core/interactionGestures.js';

// TEST 1: every shape takes the requested Canvas path and MIXED remains stable.
const calls={rect:0,arc:0,line:0,fill:0},ctx={fillRect(){calls.rect++;},beginPath(){},arc(){calls.arc++;},moveTo(){},lineTo(){calls.line++;},closePath(){},fill(){calls.fill++;}};
const renderer=Object.create(FXRenderer.prototype);for(const shape of ['square','circle','star'])renderer.drawParticle(ctx,{x:10,y:10,shape},6);
assert.equal(calls.rect,1);assert.equal(calls.arc,1);assert.equal(calls.line,9);assert.equal(calls.fill,2);
const mixed=Array.from({length:120},(_,i)=>({x:i,y:i,vx:0,vy:0,shape:['square','circle','star'][i%3]})),before=mixed.map(p=>p.shape);for(const p of mixed)renderer.drawParticle(ctx,p,3);assert.deepEqual(mixed.map(p=>p.shape),before);

// TEST 2: body-axis tilt controls average wind direction with inertial convergence.
const pose=(shoulderX,hipX)=>{const points=Array.from({length:33},()=>({x:.5,y:.5}));points[11]={x:shoulderX-.1,y:.3};points[12]={x:shoulderX+.1,y:.3};points[23]={x:hipX-.08,y:.7};points[24]={x:hipX+.08,y:.7};return bodyAxis(points,null);};
const makeParticles=()=>Array.from({length:140},(_,i)=>({x:i%70,y:i*2%100,vx:0,vy:0,phase:i*.3}));
for(const [axis,sign] of [[pose(.65,.5),1],[pose(.35,.5),-1]]){const particles=makeParticles(),state={bodyWindStrength:1.5,bodyWindTurbulence:.2,speed:1};for(let frame=0;frame<90;frame++)stepBodyWindParticles(particles,axis,state,{width:640,height:360},frame*16,1);const average=particles.reduce((sum,p)=>sum+p.vx,0)/particles.length;assert.ok(average*sign>.15);}

// TEST 3: unilateral wink requires duration and locks only after the threshold.
const wink=new WinkDetector(),winkFace={blendshapes:{eyeBlinkLeft:.85,eyeBlinkRight:.1}};assert.equal(wink.update([winkFace],0),'');assert.equal(wink.update([winkFace],190),'LEFT');

// TEST 4/5: locked snapshot survives missing hands and follows face translation without scaling.
class PhotoContext{constructor(){this.transforms=[];this.alpha=[];}drawImage(){}save(){}restore(){}beginPath(){}moveTo(){}lineTo(){}closePath(){}clip(){}translate(x,y){this.transforms.push([x,y]);}rotate(){}set globalAlpha(value){this.alpha.push(value);} }
const photoContext=new PhotoContext();globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){}})})};
const photoRenderer=Object.create(FXRenderer.prototype);Object.assign(photoRenderer,{c:{width:200,height:100},x:photoContext,stableQuad:[{x:20,y:20},{x:180,y:20},{x:180,y:80},{x:20,y:80}],photoFrame:null});photoRenderer.point=FXRenderer.prototype.point;photoRenderer.path=FXRenderer.prototype.path;
assert.equal(photoRenderer.lockPhotoFrame([{x:.5,y:.5,angle:0}],null,{hands:[]}),true);const locked=photoRenderer.photoFrame;assert.ok(locked?.snapshot);photoRenderer.drawPhotoFrame([],null,{hands:[]},{mirror:false,followRotation:false},0);assert.equal(photoRenderer.photoFrame,locked,'hand loss must not remove a photo');photoRenderer.drawPhotoFrame([{x:.65,y:.4,angle:.2}],null,{hands:[]},{mirror:false,followRotation:false},16);assert.ok(photoContext.transforms.some(([x,y])=>x===130&&y===40),'photo must follow the captured face delta');
// TEST 6: second valid wink enters fade and deletes the photo.
assert.equal(wink.update([winkFace],1000),'');assert.equal(wink.update([winkFace],1190),'LEFT');photoRenderer.releasePhotoFrame();for(let i=0;i<21;i++)photoRenderer.drawPhotoFrame([],null,{hands:[]},{mirror:false},i);assert.equal(photoRenderer.photoFrame,null);

// TEST 7/8: a directional burst followed by deceleration produces a detached throw velocity.
const thrower=new ThrowDetector(),hand=(x,y)=>({label:'Right',center:{x,y}});let events=[];for(const [time,x,y] of [[0,.2,.5],[70,.28,.5],[140,.45,.5],[200,.46,.5]])events.push(...thrower.update([hand(x,y)],time,1));assert.equal(events.length,1);assert.ok(events[0].velocity.x>0);assert.ok(events[0].velocity.y===0);const upward=new ThrowDetector();let up=[];for(const [time,y] of [[0,.7],[70,.62],[140,.45],[200,.44]])up.push(...upward.update([hand(.5,y)],time,1));assert.ok(up[0].velocity.y>0,'screen-up throw must have positive Three.js Y velocity');const mesh={position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0}},body=createThrownBody(mesh,events[0]);assert.equal(body.detached,true);stepThrownBody(body,.1,1.4);assert.ok(mesh.position.x>0,'detached cube must advance independently from the hand');

// TEST 9/10/11: OPEN alone is inert; a full wave hides; a held salute restores.
const invisible=new InvisibleGestureController(),openHand=(x,y=.5)=>({label:'Left',gesture:'OPEN',fingers:4,center:{x,y}});let result=invisible.update([openHand(.4)],[],0,16,200);assert.equal(result.state,'VISIBLE');for(const [time,x] of [[100,.3],[350,.52],[600,.28],[850,.54]])result=invisible.update([openHand(x)],[],time,16,200);assert.equal(result.state,'FADING OUT');for(let i=0;i<15;i++)result=invisible.update([],[],900+i*20,20,200);assert.equal(result.state,'INVISIBLE');const face={x:.5,y:.3,size:.2};result=invisible.update([openHand(.58,.24)],[face],1300,16,200);result=invisible.update([openHand(.58,.24)],[face],1700,16,200);assert.equal(result.state,'FADING IN');for(let i=0;i<15;i++)result=invisible.update([],[],1720+i*20,20,200);assert.equal(result.state,'VISIBLE');

// TEST 12: labels changed while legacy IDs and recording/export paths remain.
const [ui,main]=await Promise.all([readFile(new URL('../src/ui/controls.js',import.meta.url),'utf8'),readFile(new URL('../src/main.js',import.meta.url),'utf8')]);for(const old of ['Invisible 2.0','Particle Dissolve','Hand Frame / 8-bit'])assert.ok(!ui.includes(old));for(const label of ["['invisible','Invisible']","['dissolve','Particle']","['frame','Hand Frame']"])assert.ok(ui.includes(label));assert.ok(main.includes('MediaRecorder'));assert.ok(main.includes("toDataURL('image/png')"));
console.log('Interaction behavior tests passed');
