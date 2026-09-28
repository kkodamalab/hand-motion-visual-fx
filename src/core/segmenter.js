import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';

// Loaded lazily: only Invisible needs the extra model and GPU allocation.
export class PersonSegmenter {
  constructor(){ this.segmenter=null; this.loading=null; this.last=null; this.error=''; }
  async init(){
    if(this.segmenter) return this.segmenter;
    if(this.loading) return this.loading;
    this.loading=(async()=>{
      const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm');
      this.segmenter=await ImageSegmenter.createFromOptions(vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/selfie_segmenter/landscape/float16/latest/selfie_segmenter_landscape.tflite',delegate:'GPU'},runningMode:'VIDEO',outputCategoryMask:true,outputConfidenceMasks:false});
      return this.segmenter;
    })().catch(e=>{this.error=e.message; this.loading=null; throw e;});
    return this.loading;
  }
  async detect(video,timestamp){
    if(!this.segmenter || video.readyState<2) return this.last;
    // segmentForVideo is synchronous in Tasks Vision; retain only its compact mask.
    const result=this.segmenter.segmentForVideo(video,timestamp);
    const mask=result.categoryMask;
    if(mask) this.last={data:mask.getAsFloat32Array(),width:mask.width,height:mask.height};
    result.close?.();
    return this.last;
  }
  close(){this.segmenter?.close?.();this.segmenter=null;this.last=null;}
}
