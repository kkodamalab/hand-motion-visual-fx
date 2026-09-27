import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
export class HandTracker {
  async init(){ if(this.landmarker)return; const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm'); this.landmarker=await HandLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate:'GPU'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.55,minTrackingConfidence:.5}); }
  detect(video,time){ return video.readyState>=2 ? this.landmarker.detectForVideo(video,time) : {landmarks:[],handednesses:[]}; }
}
