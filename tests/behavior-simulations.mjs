import {strict as assert} from 'node:assert';
import * as THREE from 'three';
import {cubeTarget} from '../src/core/threeOverlay.js';
import {stepHandFlowParticles,radialParticle,edgeParticle,meanDistance} from '../src/core/particleFlow.js';
import {FXRenderer} from '../src/core/renderer.js';
import {pointInPolygon} from '../src/core/geometry.js';

const camera=new THREE.PerspectiveCamera(50,16/9,.1,20);camera.position.z=2;
const hand={center:{x:.45,y:.58},p:Array.from({length:21},()=>({x:.5,y:.5}))},point={p:{x:.7,y:.35},hand,speed:0},base={mirror:false,floatDirection:'camera'};
const cameraTargets=[0,5,10].map(cubeDistance=>cubeTarget(point,{...base,cubeDistance},camera));
cameraTargets.forEach((target,index)=>assert.ok(Math.abs(target.z-[0,.45,.9][index])<1e-9));
assert.ok(cameraTargets[0].apparentScale<cameraTargets[1].apparentScale&&cameraTargets[1].apparentScale<cameraTargets[2].apparentScale,'CAMERA distance must visibly increase perspective scale');
const upTargets=[0,5,10].map(cubeDistance=>cubeTarget(point,{...base,floatDirection:'up',cubeDistance},camera));
assert.ok(upTargets[1].y>upTargets[0].y&&upTargets[2].y>upTargets[1].y,'UP must move continuously above the fingertip');
const outwardTargets=[0,5,10].map(cubeDistance=>cubeTarget(point,{...base,floatDirection:'outward',cubeDistance},camera));
const displacement=p=>Math.hypot(p.x-outwardTargets[0].x,p.y-outwardTargets[0].y);assert.ok(displacement(outwardTargets[1])>0&&displacement(outwardTargets[2])>displacement(outwardTargets[1]),'OUTWARD displacement must grow with distance');

const random=(()=>{let seed=123456;return()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);})();
const bounds={width:640,height:360},center={x:320,y:180},settings={flowStrength:1.6,flowRadius:260,speed:1};
const openParticles=Array.from({length:120},()=>radialParticle(center,random));const openStart=meanDistance(openParticles,center);let openRespawns=0,cursor=0;
for(let frame=0;frame<60;frame++){const result=stepHandFlowParticles(openParticles,[{gesture:'OPEN',screen:center}],settings,bounds,{random,dt:1,cursor});cursor=result.cursor;openRespawns+=result.respawns;}
assert.ok(meanDistance(openParticles,center)>openStart+25,'OPEN cloud must move radially away over multiple frames');assert.ok(openRespawns>=120,'OPEN must progressively re-seed the existing cloud');
openParticles.forEach((p,i)=>{if(i<20){p.x=700;p.y=180;}});const recycledOpen=stepHandFlowParticles(openParticles,[{gesture:'OPEN',screen:center}],settings,bounds,{random,dt:1,cursor});assert.ok(recycledOpen.respawns>=18,'off-screen OPEN particles must continuously return to the source');

const fistParticles=Array.from({length:120},()=>edgeParticle(bounds,center,random)),fistStart=meanDistance(fistParticles,center);let fistRespawns=0;
for(let frame=0;frame<35;frame++){const result=stepHandFlowParticles(fistParticles,[{gesture:'FIST',screen:center}],settings,bounds,{random,dt:1});fistRespawns+=result.respawns;}
assert.ok(meanDistance(fistParticles,center)<fistStart-35,'FIST must redirect an entire cloud toward the palm');
for(const p of fistParticles){p.x=center.x+2;p.y=center.y+2;}const recycledFist=stepHandFlowParticles(fistParticles,[{gesture:'FIST',screen:center}],settings,bounds,{random,dt:1});assert.equal(recycledFist.respawns,120,'particles reaching a FIST must recycle at the perimeter');
const stream=Array.from({length:120},()=>radialParticle({x:120,y:180},random));for(let frame=0;frame<30;frame++)stepHandFlowParticles(stream,[{gesture:'OPEN',screen:{x:120,y:180}},{gesture:'FIST',screen:{x:520,y:180}}],settings,bounds,{random,dt:1});assert.ok(stream.reduce((sum,p)=>sum+p.vx,0)/stream.length>0,'mixed OPEN/FIST must form a source-to-sink stream');

class RasterContext{
  constructor(width,height){this.width=width;this.height=height;this.data=new Uint8Array(width*height);this.path=[];this.clipPolygon=null;this.tx=0;this.ty=0;this.sizes=[];this.stack=[];}
  save(){this.stack.push({clip:this.clipPolygon&&this.clipPolygon.map(p=>({...p})),tx:this.tx,ty:this.ty});}restore(){const v=this.stack.pop();this.clipPolygon=v.clip;this.tx=v.tx;this.ty=v.ty;}beginPath(){this.path=[];}moveTo(x,y){this.path=[{x,y}];}lineTo(x,y){this.path.push({x,y});}closePath(){}clip(){this.clipPolygon=this.path.map(p=>({...p}));}translate(x,y){this.tx+=x;this.ty+=y;}rotate(){}
  drawEmoji(size){this.sizes.push(size);for(let y=Math.floor(this.ty-size/2);y<this.ty+size/2;y++)for(let x=Math.floor(this.tx-size/2);x<this.tx+size/2;x++)if(x>=0&&y>=0&&x<this.width&&y<this.height&&(!this.clipPolygon||pointInPolygon({x:x+.5,y:y+.5},this.clipPolygon)))this.data[y*this.width+x]=1;}
}
const renderEmoji=quad=>{const context=new RasterContext(100,100),renderer=Object.create(FXRenderer.prototype);Object.assign(renderer,{c:{width:100,height:100},x:context,stableQuad:quad,quadSeen:100,emoji:{draw:(ctx,name,x,y,size)=>ctx.drawEmoji(size)}});renderer.point=FXRenderer.prototype.point;renderer.path=FXRenderer.prototype.path;renderer.facesInsideFrame=FXRenderer.prototype.facesInsideFrame;const count=renderer.drawFaceEmojis([{x:.5,y:.5,size:.6,angle:0,expression:'SMILE'}],{mirror:false,emojiSize:1},200);return {context,count};};
const quads=[[{x:5,y:5},{x:95,y:5},{x:95,y:95},{x:5,y:95}],[{x:25,y:25},{x:75,y:25},{x:75,y:75},{x:25,y:75}],[{x:43,y:43},{x:57,y:43},{x:57,y:57},{x:43,y:57}]],renders=quads.map(renderEmoji);
assert.deepEqual(renders.map(r=>r.context.sizes[0]),[60,60,60],'frame size must never change emoji draw size');
const visible=renders.map(r=>r.context.data.reduce((a,b)=>a+b,0));assert.ok(visible[0]>visible[1]&&visible[1]>visible[2],'smaller frames must reveal less of the same-size emoji');
for(let i=0;i<renders.length;i++)for(let y=0;y<100;y++)for(let x=0;x<100;x++)if(!pointInPolygon({x:x+.5,y:y+.5},quads[i]))assert.equal(renders[i].context.data[y*100+x],0,'emoji pixels must not escape the shared frame clip');
const overlap=renderEmoji([{x:70,y:35},{x:95,y:35},{x:95,y:65},{x:70,y:65}]);assert.equal(overlap.count,1,'an intersecting emoji must render even when its center is outside the frame');assert.ok(overlap.context.data.some(Boolean));
console.log('Behavior simulations passed');
