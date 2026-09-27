export class CameraEngine {
  constructor(video){ this.video=video; this.stream=null; }
  async start(constraints){ this.stop(); this.stream=await navigator.mediaDevices.getUserMedia({video:constraints,audio:false}); this.video.srcObject=this.stream; await this.video.play(); }
  stop(){ this.stream?.getTracks().forEach(t=>t.stop()); this.stream=null; }
  restart(c){ return this.start(c); }
}
