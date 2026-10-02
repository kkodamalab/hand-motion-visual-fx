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
  constructor(canvas, overlay) { this.c=canvas; this.x=canvas.getContext('2d',{alpha:false}); this.o=overlay; this.ox=overlay.getContext('2d'); this.fx=document.createElement('canvas'); this.mask=document.createElement('canvas'); this.mosw=new MoswFx();this.invisible=0;this.particles=[];this.stableQuad=null;this.quadSeen=0;this.lastParticleTime=0; }
  resize(w,h){ this.c.width=this.o.width=this.fx.width=this.mask.width=w; this.c.height=this.o.height=this.fx.height=this.mask.height=h;this.mosw.resize(w,h); }
  capture(v){ const c=document.createElement('canvas'); c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);return c; }
  reset(){this.invisible=0;}
  point(p,s){return {x:(s.mirror?1-p.x:p.x)*this.c.width,y:p.y*this.c.height};}
  video(ctx,v,s,w=this.c.width,h=this.c.height){ctx.save();if(s.mirror){ctx.translate(w,0);ctx.scale(-1,1);}ctx.drawImage(v,0,0,w,h);ctx.restore();}
  quad(d,s){if(d.hands.length<2)return null;const a=d.hands[0].p,b=d.hands[1].p;return [a[4],a[8],b[8],b[4]].map(p=>this.point(p,s));}
  path(q,x=this.x){x.beginPath();q.forEach((p,i)=>i?x.lineTo(p.x,p.y):x.moveTo(p.x,p.y));x.closePath();}
  render(v,d,s,bg,t,segmentation,faces=[]){const w=this.c.width;if(!w)return;this.video(this.x,v,s);if(['frame','anime'].includes(s.mode))this.frame(v,d,s);if(s.mode==='anime'&&s.faceEmoji)this.drawFaceEmojis(faces,s,t);if(s.mode==='invisible')this.invisibleFx(s,bg,segmentation,t);if(s.mode==='dissolve')this.dissolve(s,segmentation,d,t);this.debug(d,s);}
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
  spawnParticle(seg,s,source){const w=this.c.width,h=this.c.height;for(let tries=0;tries<12;tries++){const x=source?source.x+(Math.random()-.5)*12:Math.random()*w,y=source?source.y+(Math.random()-.5)*12:Math.random()*h,si=Math.floor(Math.max(0,Math.min(h-1,y))/h*seg.height)*seg.width+Math.floor((s.mirror?1-Math.max(0,Math.min(w-1,x))/w:Math.max(0,Math.min(w-1,x))/w)*seg.width);if(source||seg.data[si]>.45)return {x,y,ox:x,oy:y,vx:(Math.random()-.5)*.4,vy:(Math.random()-.5)*.4};}return {x:Math.random()*w,y:Math.random()*h,vx:0,vy:0};}
  dissolve(s,seg,d,t){if(!seg?.data)return;const w=this.c.width,h=this.c.height,count=Math.min(s.particles||400,s.adaptiveParticleLimit||Infinity),spread=s.dispersion||70,dt=Math.min(2,(t-(this.lastParticleTime||t))/16.67);this.lastParticleTime=t;while(this.particles.length<count)this.particles.push(this.spawnParticle(seg,s));this.particles.length=Math.min(this.particles.length,count);const flow=s.particleMode==='hand',hands=d.hands.map(hand=>({...hand,screen:this.point(hand.center,s)}));const x=this.x;x.save();if((s.particleTrail||0)>0){x.globalAlpha=Math.min(.75,s.particleTrail/100);x.fillStyle='rgba(0,0,0,.18)';x.fillRect(0,0,w,h);x.globalAlpha=1;}x.fillStyle=s.particleColor||'#ff4baf';this.particles.forEach((p,i)=>{if(flow&&hands.length){let nearest=null,best=Infinity;for(const hand of hands){const dx=p.x-hand.screen.x,dy=p.y-hand.screen.y,dist=Math.hypot(dx,dy);if(dist<best){best=dist;nearest={hand,dx,dy,dist};}}const radius=s.flowRadius||240;if(nearest&&nearest.dist<radius){const falloff=(1-nearest.dist/radius);const strength=(s.flowStrength||1)*falloff*.42,denom=Math.max(12,nearest.dist);if(nearest.hand.gesture==='OPEN'){p.vx+=nearest.dx/denom*strength;p.vy+=nearest.dy/denom*strength;}else if(nearest.hand.gesture==='FIST'){const brake=Math.max(.25,nearest.dist/radius);p.vx-=nearest.dx/denom*strength*brake;p.vy-=nearest.dy/denom*strength*brake;if(nearest.dist<10)Object.assign(p,this.spawnParticle(seg,s));}}p.vx*=.82+(s.flowSmoothness||70)/500;p.vy*=.82+(s.flowSmoothness||70)/500;p.x+=p.vx*dt*(s.speed||1);p.y+=p.vy*dt*(s.speed||1);if(p.x<0||p.x>w||p.y<0||p.y>h){const open=hands.find(q=>q.gesture==='OPEN');Object.assign(p,this.spawnParticle(seg,s,open?.screen));}}else{const on=s.gesture==='OPEN',targetX=on?p.ox+(p.vx||0)*spread:p.ox,targetY=on?p.oy+(p.vy||0)*spread:p.oy;p.x+=(targetX-p.x)*.05*(s.speed||1);p.y+=(targetY-p.y)*.05*(s.speed||1);}x.fillRect(p.x,p.y,s.particleSize||3,s.particleSize||3);});x.restore();}
  drawFaceEmojis(faces,s,t){faces.forEach(face=>{const p=this.point(face,s),size=face.size*this.c.width*(s.emojiSize||1.25);this.x.save();this.x.translate(p.x,p.y);this.x.rotate((s.mirror?-1:1)*face.angle);this.x.scale(size/180,size/180);this.drawEmoji(this.x,face.expression,s.emojiStyle,t);this.x.restore();});if(s.expressionDebug&&faces[0]){this.x.save();this.x.fillStyle='rgba(0,0,0,.72)';this.x.fillRect(8,8,310,92);this.x.fillStyle='#fff';this.x.font='14px monospace';this.x.fillText(`EXPRESSION: ${faces[0].expression}`,18,30);Object.entries(faces[0].scores||{}).forEach(([k,v],i)=>this.x.fillText(`${k}: ${v.toFixed(2)}`,18+(i%2)*145,52+Math.floor(i/2)*20));this.x.restore();}}
  drawEmoji(x,expression,style,t){const pixel=style==='pixel';x.fillStyle=style==='pop'?'#ffea00':'#ffd54f';x.strokeStyle=style==='pop'?'#ff3d9a':'#3c2a20';x.lineWidth=pixel?10:7;x.beginPath();x.arc(0,0,86,0,Math.PI*2);x.fill();x.stroke();x.fillStyle='#302018';const eyeY=expression==='SURPRISED'?-18:-22;if(expression==='SMILE'){x.beginPath();x.arc(-30,eyeY,10,0,Math.PI*2);x.arc(30,eyeY,10,0,Math.PI*2);x.fill();x.beginPath();x.arc(0,5,45,0,Math.PI);x.stroke();}else if(expression==='ANGRY'){x.lineWidth=9;x.beginPath();x.moveTo(-48,-38);x.lineTo(-15,-22);x.moveTo(48,-38);x.lineTo(15,-22);x.stroke();x.beginPath();x.arc(0,48,34,Math.PI,Math.PI*2);x.stroke();}else if(expression==='SURPRISED'){x.beginPath();x.arc(-30,eyeY,14,0,Math.PI*2);x.arc(30,eyeY,14,0,Math.PI*2);x.arc(0,35,22,0,Math.PI*2);x.fill();}else if(expression==='SAD'){x.beginPath();x.arc(-30,eyeY,9,0,Math.PI*2);x.arc(30,eyeY,9,0,Math.PI*2);x.fill();x.beginPath();x.arc(0,45,35,Math.PI,Math.PI*2);x.stroke();x.fillStyle='#35b9ff';const drop=30+(t/12)%38;x.beginPath();x.ellipse(-38,drop,7,14,0,0,Math.PI*2);x.fill();}else{x.beginPath();x.arc(-30,eyeY,9,0,Math.PI*2);x.arc(30,eyeY,9,0,Math.PI*2);x.fill();x.lineWidth=8;x.beginPath();x.moveTo(-30,35);x.lineTo(30,35);x.stroke();}}
  debug(d,s){const x=this.ox;x.clearRect(0,0,this.o.width,this.o.height);if(!s.debug)return;x.strokeStyle='#62ffe4';x.fillStyle='#fff';x.lineWidth=2;d.hands.forEach(hand=>{d.bones.forEach(([a,b])=>{x.beginPath();const p=this.point(hand.p[a],s),q=this.point(hand.p[b],s);x.moveTo(p.x,p.y);x.lineTo(q.x,q.y);x.stroke();});hand.p.forEach((p,i)=>{const q=this.point(p,s);x.fillRect(q.x-2,q.y-2,5,5);x.fillText(i,q.x+4,q.y-4);});});}
}
