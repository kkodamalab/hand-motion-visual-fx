import { MoswFx } from './moswFx.js';
export function drawClippedFrame(context, image, quad) {
  context.save();
  context.beginPath();
  quad.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
  context.closePath();
  context.clip();
  context.drawImage(image, 0, 0);
  context.restore();
}

export class FXRenderer {
  constructor(canvas, overlay) { this.c=canvas; this.x=canvas.getContext('2d',{alpha:false}); this.o=overlay; this.ox=overlay.getContext('2d'); this.fx=document.createElement('canvas'); this.mask=document.createElement('canvas'); this.mosw=new MoswFx();this.invisible=0;this.particles=[];this.stableQuad=null;this.quadSeen=0; }
  resize(w,h){ this.c.width=this.o.width=this.fx.width=this.mask.width=w; this.c.height=this.o.height=this.fx.height=this.mask.height=h;this.mosw.resize(w,h); }
  capture(v){ const c=document.createElement('canvas'); c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);return c; }
  reset(){this.invisible=0;}
  point(p,s){return {x:(s.mirror?1-p.x:p.x)*this.c.width,y:p.y*this.c.height};}
  video(ctx,v,s,w=this.c.width,h=this.c.height){ctx.save();if(s.mirror){ctx.translate(w,0);ctx.scale(-1,1);}ctx.drawImage(v,0,0,w,h);ctx.restore();}
  quad(d,s){if(d.hands.length<2)return null;const a=d.hands[0].p,b=d.hands[1].p;return [a[4],a[8],b[8],b[4]].map(p=>this.point(p,s));}
  path(q,x=this.x){x.beginPath();q.forEach((p,i)=>i?x.lineTo(p.x,p.y):x.moveTo(p.x,p.y));x.closePath();}
  render(v,d,s,bg,t,segmentation){const w=this.c.width;if(!w)return;this.video(this.x,v,s);if(['frame','anime'].includes(s.mode))this.frame(v,d,s);if(s.mode==='invisible')this.invisibleFx(s,bg,segmentation,t);if(s.mode==='dissolve')this.dissolve(s,segmentation);this.debug(d,s);}
  frame(v, d, s) {
    const detected = this.quad(d, s);
    const now = performance.now();
    if (detected) {
      this.stableQuad = this.stableQuad
        ? detected.map((point, i) => ({x: this.stableQuad[i].x * .68 + point.x * .32, y: this.stableQuad[i].y * .68 + point.y * .32}))
        : detected;
      this.quadSeen = now;
    }
    const quad = now - this.quadSeen < 350 ? this.stableQuad : null;
    if (!quad) return;

    const context = this.fx.getContext('2d', {willReadFrequently: true});
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    context.filter = 'none';
    context.clearRect(0, 0, this.fx.width, this.fx.height);
    this.video(context, v, s);

    const useClassic = s.mode === 'anime' || s.frameRenderer !== 'mosw';
    if (useClassic) this.classicFrame(context, s);
    const rendered = s.mode === 'frame' && !useClassic
      ? this.mosw.apply(this.fx, s, now, s.beatPhase || 0)
      : this.fx;

    drawClippedFrame(this.x, rendered, quad);
    this.path(quad);
    this.x.strokeStyle = s.borderColor || '#4cfbff';
    this.x.lineWidth = s.borderWidth || 3;
    this.x.shadowColor = this.x.strokeStyle;
    this.x.shadowBlur = s.edgeGlow || 12;
    this.x.stroke();
    this.x.shadowBlur = 0;
  }

  classicFrame(context, s) {
    const image = context.getImageData(0, 0, this.fx.width, this.fx.height);
    const data = image.data;
    const level = s.posterize || 5;
    const pixel = s.pixelSize || 10;
    for (let y = 0; y < this.fx.height; y++) for (let x = 0; x < this.fx.width; x++) {
      const i = (y * this.fx.width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (s.mode === 'anime') {
        const edge = x && y ? Math.abs(r - data[i - 4]) + Math.abs(g - data[i - 3]) + Math.abs(b - data[i - 2]) : 0;
        const step = 255 / (level - 1);
        data[i] = data[i + 1] = data[i + 2] = edge > 90 ? 10 : Math.round((r + g + b) / 3 / step) * step;
      } else if (s.frameEffect === 'pixel' || s.frameEffect === 'retro') {
        const step = 255 / (s.colorDepth || 5);
        data[i] = Math.round(r / step) * step;
        data[i + 1] = Math.round(g / step) * step;
        data[i + 2] = Math.round(b / step) * step;
      } else if (s.frameEffect === 'mono') {
        data[i] = data[i + 1] = data[i + 2] = (r + g + b) / 3;
      } else if (s.frameEffect === 'cmyk') {
        data[i] = 255 - r; data[i + 1] = 255 - g; data[i + 2] = 255 - b;
      } else {
        data[i] = Math.min(255, r * 1.3 + 35);
        data[i + 1] = Math.min(255, g * .8);
        data[i + 2] = Math.min(255, b * 1.4 + 25);
      }
    }
    context.putImageData(image, 0, 0);
    if (s.frameEffect === 'pixel' || s.frameEffect === 'retro') {
      const small = document.createElement('canvas');
      small.width = Math.max(1, this.fx.width / pixel);
      small.height = Math.max(1, this.fx.height / pixel);
      small.getContext('2d').drawImage(this.fx, 0, 0, small.width, small.height);
      context.imageSmoothingEnabled = false;
      context.clearRect(0, 0, this.fx.width, this.fx.height);
      context.drawImage(small, 0, 0, this.fx.width, this.fx.height);
      context.imageSmoothingEnabled = true;
    }
  }

  invisibleFx(s,bg,seg){if(!bg||!seg?.data){this.invisible=0;return;}const target=s.gesture==='OPEN'?1:0;this.invisible+=(target-this.invisible)*Math.min(1,16/(s.transitionDuration||1000));if(this.invisible<.01)return;const x=this.x,w=this.c.width,h=this.c.height,m=this.mask.getContext('2d');m.clearRect(0,0,w,h);
    if(seg?.data){const im=m.createImageData(w,h), sw=seg.width,sh=seg.height;for(let y=0;y<h;y++)for(let xx=0;xx<w;xx++){const si=Math.floor(y/h*sh)*sw+Math.floor((s.mirror?1-xx/w:xx/w)*sw);if(seg.data[si]>.45)im.data[(y*w+xx)*4+3]=255;}m.putImageData(im,0,0);}else return;
    const rep=this.fx.getContext('2d');rep.clearRect(0,0,w,h);this.video(rep,bg,s);rep.globalCompositeOperation='destination-in';rep.drawImage(this.mask,0,0);rep.globalCompositeOperation='source-over';x.save();x.globalAlpha=this.invisible;x.drawImage(this.fx,0,0);if(s.maskDebug){x.globalAlpha=.35;x.fillStyle='#00ffff';x.globalCompositeOperation='source-atop';x.drawImage(this.mask,0,0);x.globalCompositeOperation='source-over';}x.restore();
  }
  dissolve(s,seg){if(!seg?.data)return;const w=this.c.width,h=this.c.height,count=s.particles||400,spread=s.dispersion||70;while(this.particles.length<count){const x=Math.random()*w,y=Math.random()*h,si=Math.floor(y/h*seg.height)*seg.width+Math.floor((s.mirror?1-x/w:x/w)*seg.width);if(seg.data[si]>.45)this.particles.push({x,y,ox:x,oy:y,vx:(Math.random()-.5)*spread,vy:(Math.random()-.5)*spread});}const on=s.gesture==='OPEN';const x=this.x;x.save();x.fillStyle=s.particleColor||'#ff4baf';this.particles.forEach(p=>{const targetX=on?p.ox+p.vx:p.ox,targetY=on?p.oy+p.vy:p.oy;p.x+=(targetX-p.x)*.05*(s.speed||1);p.y+=(targetY-p.y)*.05*(s.speed||1);x.fillRect(p.x,p.y,s.particleSize||3,s.particleSize||3);});x.restore();}
  debug(d,s){const x=this.ox;x.clearRect(0,0,this.o.width,this.o.height);if(!s.debug)return;x.strokeStyle='#62ffe4';x.fillStyle='#fff';x.lineWidth=2;d.hands.forEach(hand=>{d.bones.forEach(([a,b])=>{x.beginPath();const p=this.point(hand.p[a],s),q=this.point(hand.p[b],s);x.moveTo(p.x,p.y);x.lineTo(q.x,q.y);x.stroke();});hand.p.forEach((p,i)=>{const q=this.point(p,s);x.fillRect(q.x-2,q.y-2,5,5);x.fillText(i,q.x+4,q.y-4);});});}
}
