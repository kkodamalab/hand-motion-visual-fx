export const MOSW_EFFECTS = ['rgb','glitch','mirror','wave','mono','invert','mosaic','strobe','zoom','film'];
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export class MoswFx {
  constructor(width=1,height=1){this.canvases=[document.createElement('canvas'),document.createElement('canvas')];this.pixel=document.createElement('canvas');this.resize(width,height);}
  resize(width,height){this.canvases.forEach(c=>{c.width=width;c.height=height;});}
  apply(source,state,time,beat){let input=source,index=0;for(const name of state.fxOrder.filter(n=>state.fxEnabled[n]).slice(0,3)){const output=this.canvases[index++%2],x=output.getContext('2d');x.clearRect(0,0,output.width,output.height);this[name](x,input,state.fxParams[name],time,beat);input=output;}return input;}
  rgb(x,src,p){const n=p.amount;x.globalCompositeOperation='screen';x.globalAlpha=.7;x.drawImage(src,-n,0);x.globalCompositeOperation='multiply';x.drawImage(src,n,0);x.globalCompositeOperation='source-over';x.globalAlpha=1;x.drawImage(src,0,0);}
  glitch(x,src,p,time){x.drawImage(src,0,0);for(let i=0;i<Math.ceil(p.amount/3);i++){const y=(Math.sin(time*.013+i*17)*.5+.5)*x.canvas.height,sh=2+(i%4)*3,dx=Math.sin(time*.031+i)*p.amount*2;x.drawImage(src,0,y,src.width,sh,dx,y,src.width,sh);}}
  mirror(x,src){const w=x.canvas.width;x.save();x.beginPath();x.rect(0,0,w/2,x.canvas.height);x.clip();x.drawImage(src,0,0);x.restore();x.save();x.translate(w,0);x.scale(-1,1);x.drawImage(src,0,0);x.restore();}
  wave(x,src,p,time){for(let y=0;y<x.canvas.height;y+=4)x.drawImage(src,0,y,src.width,4,Math.sin(y*.035+time*.004)*p.amount,y,src.width,4);}
  mono(x,src,p){x.filter=`grayscale(${clamp(p.amount/100,0,1)}) contrast(1.12)`;x.drawImage(src,0,0);x.filter='none';}
  invert(x,src,p){x.filter=`invert(${clamp(p.amount/100,0,1)})`;x.drawImage(src,0,0);x.filter='none';}
  mosaic(x,src,p){const n=Math.max(2,p.amount),w=x.canvas.width,h=x.canvas.height,pw=Math.ceil(w/n),ph=Math.ceil(h/n);this.pixel.width=pw;this.pixel.height=ph;this.pixel.getContext('2d').drawImage(src,0,0,pw,ph);x.imageSmoothingEnabled=false;x.drawImage(this.pixel,0,0,w,h);x.imageSmoothingEnabled=true;}
  strobe(x,src,p,time,beat){x.drawImage(src,0,0);if(beat<Math.max(.04,p.amount/500)){x.fillStyle=`rgba(255,255,255,${clamp(p.amount/100,0,.9)})`;x.fillRect(0,0,x.canvas.width,x.canvas.height);}}
  zoom(x,src,p,time,beat){const scale=1+(1-beat)*p.amount/300,w=x.canvas.width,h=x.canvas.height;x.translate(w/2,h/2);x.scale(scale,scale);x.drawImage(src,-w/2,-h/2);x.setTransform(1,0,0,1,0,0);}
  film(x,src,p,time){x.drawImage(src,0,0);const w=x.canvas.width,h=x.canvas.height,a=p.amount/100;x.globalAlpha=.08+.2*a;x.fillStyle='#d9a45b';x.fillRect(0,0,w,h);x.globalAlpha=.12*a;x.fillStyle='#fff';for(let i=0;i<Math.ceil(a*180);i++)x.fillRect((Math.sin(i*991+time)*.5+.5)*w,(Math.sin(i*557+time*.7)*.5+.5)*h,1+(i%2),1+(i%3));x.globalAlpha=.25*a;x.fillStyle='#000';for(let y=0;y<h;y+=4)x.fillRect(0,y,w,1);x.globalAlpha=1;}
}
