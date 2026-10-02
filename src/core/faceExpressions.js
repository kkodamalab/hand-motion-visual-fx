const value=(map,...names)=>Math.max(0,...names.map(name=>map.get(name)||0));
export function classifyExpression(categories=[],sensitivity=1){
  const m=new Map(categories.map(item=>[item.categoryName,item.score]));
  const scores={
    SMILE:(value(m,'mouthSmileLeft')+value(m,'mouthSmileRight'))/2,
    SAD:(value(m,'mouthFrownLeft')+value(m,'mouthFrownRight'))/2+value(m,'browInnerUp')*.3,
    ANGRY:(value(m,'browDownLeft')+value(m,'browDownRight'))/2+value(m,'mouthPressLeft','mouthPressRight')*.2,
    SURPRISED:value(m,'jawOpen')*.62+(value(m,'eyeWideLeft')+value(m,'eyeWideRight'))*.28+value(m,'browInnerUp')*.18,
    NEUTRAL:.32
  };
  const threshold=.46/Math.max(.5,sensitivity);
  const ranked=Object.entries(scores).filter(([name,score])=>name==='NEUTRAL'||score>=threshold).sort((a,b)=>b[1]-a[1]);
  return {expression:ranked[0][0],scores,blendshapes:Object.fromEntries(m)};
}
export class FaceExpressionSmoother{
  constructor(){this.faces=[];}
  update(result,now,sensitivity=1,smoothing=.72){
    const visible=(result.faceLandmarks||[]).map((landmarks,i)=>{const sample=classifyExpression(result.faceBlendshapes?.[i]?.categories,sensitivity),xs=landmarks.map(p=>p.x),ys=landmarks.map(p=>p.y),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2,size=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)),angle=Math.atan2(landmarks[263].y-landmarks[33].y,landmarks[263].x-landmarks[33].x);let face=this.faces[i];if(!face)face={x:cx,y:cy,size,angle,expression:sample.expression,candidate:sample.expression,since:now,scores:sample.scores};const follow=1-Math.min(.94,Math.max(0,smoothing));face.x+=(cx-face.x)*follow;face.y+=(cy-face.y)*follow;face.size+=(size-face.size)*follow;face.angle+=(angle-face.angle)*follow;for(const name of Object.keys(sample.scores))face.scores[name]=(face.scores[name]??sample.scores[name])*.7+sample.scores[name]*.3;const ranked=Object.entries(face.scores).sort((a,b)=>b[1]-a[1]),next=ranked[0][0],current=face.scores[face.expression]||0,candidateScore=face.scores[next]||0;if(next!==face.expression&&candidateScore>current+.06){if(face.candidate!==next){face.candidate=next;face.since=now;}if(now-face.since>240)face.expression=next;}else{face.candidate=face.expression;face.since=now;}Object.assign(face,{lastSeen:now,blendshapes:sample.blendshapes});this.faces[i]=face;return face;});
    return visible.length?visible:this.faces.filter(face=>now-face.lastSeen<500);
  }
}
