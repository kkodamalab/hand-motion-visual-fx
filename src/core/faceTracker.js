import { FaceLandmarker } from '@mediapipe/tasks-vision';
import { getVisionFileset } from './vision.js';

const modelUrl='https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
export class FaceTracker {
  constructor(){this.landmarker=null;this.ready=false;this.delegate='';this.loading=null;this.failed=false;}
  async init(){
    if(this.ready)return this.landmarker;if(this.loading)return this.loading;
    this.loading=(async()=>{const vision=await getVisionFileset();let gpuError;
      for(const delegate of ['GPU','CPU'])try{this.landmarker=await FaceLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:modelUrl,delegate},runningMode:'VIDEO',numFaces:2,outputFaceBlendshapes:true,outputFacialTransformationMatrixes:true,minFaceDetectionConfidence:.5,minTrackingConfidence:.45});this.delegate=delegate;this.ready=true;this.failed=false;return this.landmarker;}catch(error){if(delegate==='GPU')gpuError=error;else{this.failed=true;throw new Error(`Face Landmarker GPU/CPU initialization failed: ${gpuError?.message||'unknown'} / ${error.message}`);}}
    })().finally(()=>{this.loading=null;});return this.loading;
  }
  detect(video,time){return this.ready&&video.readyState>=2?this.landmarker.detectForVideo(video,time):{faceLandmarks:[],faceBlendshapes:[]};}
  close(){this.landmarker?.close?.();this.landmarker=null;this.ready=false;}
}
