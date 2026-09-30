import { HandLandmarker } from '@mediapipe/tasks-vision';
import { getVisionFileset } from './vision.js';
const modelUrl='https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
export class HandTracker {
  constructor(){this.landmarker=null;this.ready=false;this.delegate='';this.initError=null;this.loading=null;}
  async init(){
    if(this.ready)return this.landmarker;if(this.loading)return this.loading;
    this.loading=(async()=>{const vision=await getVisionFileset();let gpuError;
      for(const delegate of ['GPU','CPU']){try{this.landmarker=await HandLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:modelUrl,delegate},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.55,minTrackingConfidence:.5});this.delegate=delegate;this.ready=true;this.initError=null;return this.landmarker;}catch(error){if(delegate==='GPU')gpuError=error;else {this.initError=new Error(`Hand Landmarker を GPU と CPU の両方で初期化できませんでした。GPU: ${gpuError?.message||'unknown'} / CPU: ${error.message}`);throw this.initError;}}}
    })().finally(()=>{this.loading=null;});return this.loading;
  }
  detect(video,time){if(!this.ready||video.readyState<2)return {landmarks:[],handednesses:[]};return this.landmarker.detectForVideo(video,time);}
  close(){this.landmarker?.close?.();this.landmarker=null;this.ready=false;this.delegate='';}
}
