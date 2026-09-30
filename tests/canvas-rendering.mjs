import { strict as assert } from 'node:assert';

class TestCanvas {
  constructor(width=8,height=8){this.width=width;this.height=height;this.data=new Uint8ClampedArray(width*height*4);this.context=new TestContext(this);}
  getContext(){return this.context;}
}
class TestContext {
  constructor(canvas){this.canvas=canvas;this.stack=[];this.path=[];this.setTransform(1,0,0,1,0,0);this.reset();}
  reset(){this.globalAlpha=1;this.globalCompositeOperation='source-over';this.filter='none';this.imageSmoothingEnabled=true;this.fillStyle='#000';this.shadowBlur=0;this.shadowColor='transparent';this.lineWidth=1;this.lineCap='butt';this.lineJoin='miter';this.clipBox=null;}
  save(){this.stack.push({...this,canvas:this.canvas,stack:this.stack,path:[...this.path]});}
  restore(){const state=this.stack.pop();if(state)for(const key of Object.keys(state))if(!['canvas','stack'].includes(key))this[key]=state[key];}
  setTransform(a,b,c,d,e,f){this.transform=[a,b,c,d,e,f];}
  translate(x,y){this.transform[4]+=x;this.transform[5]+=y;}
  scale(x,y){this.transform[0]*=x;this.transform[3]*=y;}
  clearRect(x,y,w,h){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)this.write(xx,yy,[0,0,0,0],true);}
  beginPath(){this.path=[];}
  rect(x,y,w,h){this.path=[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];}
  moveTo(x,y){this.path=[{x,y}];}
  lineTo(x,y){this.path.push({x,y});}
  closePath(){}
  clip(){const xs=this.path.map(p=>p.x),ys=this.path.map(p=>p.y);this.clipBox={x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys)};}
  parseFill(){if(this.fillStyle==='#fff')return [255,255,255,255];if(this.fillStyle==='#000')return [0,0,0,255];if(this.fillStyle==='#d9a45b')return [217,164,91,255];const m=/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(this.fillStyle);return m?[+m[1],+m[2],+m[3],Math.round((m[4]??1)*255)]:[0,0,0,255];}
  fillRect(x,y,w,h){const color=this.parseFill();for(let yy=Math.floor(y);yy<Math.ceil(y+h);yy++)for(let xx=Math.floor(x);xx<Math.ceil(x+w);xx++)this.write(xx,yy,color);}
  createImageData(width,height){return {width,height,data:new Uint8ClampedArray(width*height*4)};}
  getImageData(x,y,width,height){const image=this.createImageData(width,height);for(let yy=0;yy<height;yy++)for(let xx=0;xx<width;xx++){const from=((y+yy)*this.canvas.width+x+xx)*4,to=(yy*width+xx)*4;image.data.set(this.canvas.data.slice(from,from+4),to);}return image;}
  putImageData(image,x,y){for(let yy=0;yy<image.height;yy++)for(let xx=0;xx<image.width;xx++){const from=(yy*image.width+xx)*4,to=((y+yy)*this.canvas.width+x+xx)*4;this.canvas.data.set(image.data.slice(from,from+4),to);}}
  drawImage(source,...args){const src=source.data?source:source.canvas;let sx=0,sy=0,sw=src.width,sh=src.height,dx=0,dy=0,dw=sw,dh=sh;if(args.length===2)[dx,dy]=args;if(args.length===4)[dx,dy,dw,dh]=args;if(args.length===8)[sx,sy,sw,sh,dx,dy,dw,dh]=args;const copy=new Uint8ClampedArray(src.data);for(let y=0;y<Math.ceil(dh);y++)for(let x=0;x<Math.ceil(dw);x++){const px=Math.max(0,Math.min(src.width-1,Math.floor(sx+x/dw*sw))),py=Math.max(0,Math.min(src.height-1,Math.floor(sy+y/dh*sh))),i=(py*src.width+px)*4,c=[copy[i],copy[i+1],copy[i+2],copy[i+3]];if(this.filter.startsWith('invert')){const n=+(this.filter.match(/invert\(([\d.]+)/)?.[1]??1);c[0]=c[0]*(1-n)+(255-c[0])*n;c[1]=c[1]*(1-n)+(255-c[1])*n;c[2]=c[2]*(1-n)+(255-c[2])*n;}if(this.filter.startsWith('grayscale')){const n=+(this.filter.match(/grayscale\(([\d.]+)/)?.[1]??1),g=(c[0]+c[1]+c[2])/3;c[0]=c[0]*(1-n)+g*n;c[1]=c[1]*(1-n)+g*n;c[2]=c[2]*(1-n)+g*n;}const tx=Math.round(this.transform[0]*(dx+x)+this.transform[4]),ty=Math.round(this.transform[3]*(dy+y)+this.transform[5]);this.write(tx,ty,c);}}
  write(x,y,color,clear=false){if(x<0||y<0||x>=this.canvas.width||y>=this.canvas.height)return;if(this.clipBox&&(x<this.clipBox.x0||x>=this.clipBox.x1||y<this.clipBox.y0||y>=this.clipBox.y1))return;const i=(y*this.canvas.width+x)*4;if(clear){this.canvas.data.fill(0,i,i+4);return;}const alpha=(color[3]/255)*this.globalAlpha,back=1-alpha;this.canvas.data[i]=color[0]*alpha+this.canvas.data[i]*back;this.canvas.data[i+1]=color[1]*alpha+this.canvas.data[i+1]*back;this.canvas.data[i+2]=color[2]*alpha+this.canvas.data[i+2]*back;this.canvas.data[i+3]=255;}
}

globalThis.document={createElement:(tag)=>{assert.equal(tag,'canvas');return new TestCanvas();}};
const { MoswFx, MOSW_EFFECTS, rgbSplitPixels } = await import('../src/core/moswFx.js');
const { drawClippedFrame } = await import('../src/core/renderer.js');
const source=new TestCanvas(8,8);for(let y=0;y<8;y++)for(let x=0;x<8;x++){const i=(y*8+x)*4;source.data.set([x*25,y*25,40,255],i);}
const params=Object.fromEntries(MOSW_EFFECTS.map(name=>[name,{amount:name==='mosaic'?3:['rgb','glitch','wave'].includes(name)?2:40}]));
for(const effect of MOSW_EFFECTS){const fx=new MoswFx(8,8),state={fxOrder:[effect],fxEnabled:{[effect]:true},fxParams:params};const output=fx.apply(source,state,123,0);assert(output.data.some((value,i)=>i%4!==3&&value!==0),`${effect} must draw pixels`);assert.equal(output.context.globalAlpha,1,`${effect} alpha must reset`);assert.equal(output.context.globalCompositeOperation,'source-over',`${effect} composite mode must reset`);assert.equal(output.context.filter,'none',`${effect} filter must reset`);}
const fx=new MoswFx(8,8),calls=[];for(const name of MOSW_EFFECTS)fx[name]=function(x,src){calls.push(name);x.drawImage(src,0,0);};fx.apply(source,{fxOrder:['film','invert','wave','rgb'],fxEnabled:{film:true,invert:true,wave:true,rgb:true},fxParams:params},10,.5);assert.deepEqual(calls,['film','invert','wave'],'only the first three enabled effects must run in order');
const target=new TestCanvas(8,8);target.context.fillStyle='rgb(10,20,30)';target.context.fillRect(0,0,8,8);const effect=new TestCanvas(8,8);effect.context.fillStyle='rgb(220,30,40)';effect.context.fillRect(0,0,8,8);drawClippedFrame(target.context,effect,[{x:2,y:2},{x:6,y:2},{x:6,y:6},{x:2,y:6}]);assert.deepEqual([...target.data.slice(0,4)],[10,20,30,255],'pixels outside Hand Frame must remain original');assert.deepEqual([...target.data.slice((3*8+3)*4,(3*8+3)*4+4)],[220,30,40,255],'pixels inside Hand Frame must use effect output');

const row=new Uint8ClampedArray([10,20,30,255,40,50,60,255,70,80,90,255,100,110,120,255]);
assert.deepEqual(rgbSplitPixels(row,4,1,0),row,'RGB amount zero must be pixel-identical');
assert.deepEqual([...rgbSplitPixels(row,4,1,1)],[40,20,0,255,70,50,30,255,100,80,60,255,0,110,90,255],'R must move left, G remain centered, and B move right');
assert.equal(rgbSplitPixels(row,4,1,2)[0],70,'RGB amount must control the pixel separation distance');
const stacked=new MoswFx(4,1).apply(Object.assign(new TestCanvas(4,1),{data:row}),{fxOrder:['rgb','invert'],fxEnabled:{rgb:true,invert:true},fxParams:{rgb:{amount:1},invert:{amount:100}}},0,0);assert.deepEqual([...stacked.data.slice(0,4)],[215,235,255,255],'RGB split must compose with a following effect');
console.log('Canvas rendering passed');
