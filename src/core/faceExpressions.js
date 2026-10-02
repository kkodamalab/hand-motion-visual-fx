const value=(map,...names)=>Math.max(0,...names.map(name=>map.get(name)||0));
export function classifyExpression(categories=[],sensitivity=1){
  const m=new Map(categories.map(x=>[x.categoryName,x.score]));
  const scores={
    SMILE:(value(m,'mouthSmileLeft')+value(m,'mouthSmileRight'))/2,
    SAD:(value(m,'mouthFrownLeft')+value(m,'mouthFrownRight'))/2+value(m,'browInnerUp')*.35,
    ANGRY:(value(m,'browDownLeft')+value(m,'browDownRight'))/2+value(m,'mouthPressLeft','mouthPressRight')*.25,
    SURPRISED:value(m,'jawOpen')*.65+(value(m,'eyeWideLeft')+value(m,'eyeWideRight'))*.3+value(m,'browInnerUp')*.2,
    NEUTRAL:.34
  };
  const threshold=.48/Math.max(.5,sensitivity),ranked=Object.entries(scores).filter(([k])=>k==='NEUTRAL'||scores[k]>=threshold).sort((a,b)=>b[1]-a[1]);
  return {expression:ranked[0][0],scores,blendshapes:Object.fromEntries(m)};
}

export class FaceExpressionSmoother {
  constructor(){this.faces=[];}
  update(result,now,sensitivity=1,smoothing=.72){const visible=(result.faceLandmarks||[]).map((landmarks,i)=>{const classified=classifyExpression(result.faceBlendshapes?.[i]?.categories,sensitivity);const xs=landmarks.map(p=>p.x),ys=landmarks.map(p=>p.y),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2,size=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)),angle=Math.atan2(landmarks[263].y-landmarks[33].y,landmarks[263].x-landmarks[33].x);let f=this.faces[i];if(!f)f={x:cx,y:cy,size,angle,expression:classified.expression,candidate:classified.expression,since:now};const a=1-Math.min(.94,Math.max(0,smoothing));f.x+= (cx-f.x)*a;f.y+=(cy-f.y)*a;f.size+=(size-f.size)*a;f.angle+=(angle-f.angle)*a;if(f.candidate!==classified.expression){f.candidate=classified.expression;f.since=now;}if(now-f.since>180)f.expression=f.candidate;Object.assign(f,{lastSeen:now,scores:classified.scores,blendshapes:classified.blendshapes});this.faces[i]=f;return f;});return visible.length?visible:this.faces.filter(face=>now-face.lastSeen<500);}
}
