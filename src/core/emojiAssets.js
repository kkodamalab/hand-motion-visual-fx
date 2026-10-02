// Twemoji graphics copyright Twitter, Inc. and contributors, licensed CC-BY 4.0.
// https://github.com/twitter/twemoji/blob/master/LICENSE-GRAPHICS
export const EMOJI_GLYPHS={SMILE:'😊',NEUTRAL:'😐',SAD:'😢',ANGRY:'😠',SURPRISED:'😲'};
const codes={SMILE:'1f60a',NEUTRAL:'1f610',SAD:'1f622',ANGRY:'1f620',SURPRISED:'1f632'};
export class EmojiAssets{
  constructor(ImageClass=globalThis.Image){this.images={};this.ImageClass=ImageClass;if(ImageClass)for(const name of Object.keys(codes))this.load(name);}
  load(name){const image=new this.ImageClass();this.images[name]={image,ready:false};image.decoding='async';image.crossOrigin='anonymous';image.onload=()=>{this.images[name].ready=true;};image.onerror=()=>{this.images[name].failed=true;};image.src=`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codes[name]}.svg`;}
  draw(context,name,x,y,size){const item=this.images[name];if(item?.ready){context.drawImage(item.image,x-size/2,y-size/2,size,size);return 'asset';}context.save();context.font=`${size*.82}px sans-serif`;context.textAlign='center';context.textBaseline='middle';context.fillText(EMOJI_GLYPHS[name]||EMOJI_GLYPHS.NEUTRAL,x,y);context.restore();return 'fallback';}
}
