import * as THREE from 'three';
import { ThrowDetector,createThrownBody,stepThrownBody } from './interactionGestures.js';

export const FINGER_TIPS={thumb:4,index:8,middle:12,ring:16,pinky:20};
export function selectedFingertips(hands,selected){return hands.flatMap(hand=>Object.entries(FINGER_TIPS).filter(([name])=>selected?.[name]).map(([name,index])=>({name,p:hand.p[index],hand,speed:hand.speed})));}
export function cubeTarget(point,state,camera){
  const cm=Math.max(0,Math.min(10,Number(state.cubeDistance)||0)),direction=state.floatDirection||'camera',z=direction==='camera'?cm*.09:cm*.025,distance=camera.position.z-z,halfHeight=Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*distance,xNdc=(state.mirror?1-point.p.x:point.p.x)*2-1,yNdc=1-point.p.y*2;
  let x=xNdc*halfHeight*camera.aspect,y=yNdc*halfHeight;
  if(direction==='up')y+=cm*.045;
  if(direction==='outward'){const center=point.hand.center||point.hand.p[9],cx=(state.mirror?1-center.x:center.x)*2-1,cy=1-center.y*2,dx=xNdc-cx,dy=yNdc-cy,length=Math.max(.001,Math.hypot(dx*camera.aspect,dy));x+=dx*camera.aspect/length*cm*.045;y+=dy/length*cm*.045;}
  return {x,y,z,apparentScale:camera.position.z/distance};
}

export class ThreeOverlay {
  constructor(canvas){
    this.canvas=canvas; this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});
    this.scene=new THREE.Scene(); this.camera=new THREE.PerspectiveCamera(50,1,.1,20);this.camera.position.z=2;
    this.cubes=[];this.floatLines=[];this.thrown=[];this.throwDetector=new ThrowDetector();this.suppressedHands=new Map();this.volume=null;this.tmp=new THREE.Vector3();
  }
  resize(w,h){this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  makeCube(color){
    const geometry=new THREE.BoxGeometry(.15,.15,.15); const material=new THREE.MeshStandardMaterial({color,metalness:.65,roughness:.22,transparent:true});
    const mesh=new THREE.Mesh(geometry,material); this.scene.add(mesh);return mesh;
  }
  removeCube(){const cube=this.cubes.pop();if(!cube)return;this.scene.remove(cube);cube.geometry.dispose();cube.material.dispose();}
  removeFloatLine(){const line=this.floatLines.pop();if(!line)return;this.scene.remove(line);line.geometry.dispose();line.material.dispose();}
  ensureCubes(n,color){while(this.cubes.length<n)this.cubes.push(this.makeCube(color));while(this.cubes.length>n)this.removeCube();}
  updateCubes(hands,state,dt){
    const selected=state.cubeFingers||{index:true,middle:true,ring:true,pinky:true};
    const now=performance.now(),points=selectedFingertips(hands,selected).filter(point=>(this.suppressedHands.get(point.hand.label)||0)<=now);this.ensureCubes(points.length,state.cubeColor||'#c45bff');
    this.cubes.forEach((cube,i)=>{const point=points[i],target=cubeTarget(point,state,this.camera);cube.position.lerp(this.tmp.set(target.x,target.y,target.z),Math.min(1,dt*.014*(state.follow||6)));cube.scale.setScalar(.5*(state.size||1));cube.rotation.x+=dt*.001*(state.speed||1)*(1+point.speed*4);cube.rotation.y+=dt*.0015*(state.speed||1);cube.material.color.set(state.cubeColor||'#c45bff');cube.material.wireframe=!!state.wireframe;cube.material.opacity=state.opacity??1;});
    while(this.floatLines.length<(state.cubeFloatDebug?points.length:0)){const material=new THREE.LineBasicMaterial({color:0xffee55});const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);const line=new THREE.Line(geometry,material);this.scene.add(line);this.floatLines.push(line);}while(this.floatLines.length>(state.cubeFloatDebug?points.length:0))this.removeFloatLine();this.floatLines.forEach((line,i)=>{const target=cubeTarget(points[i],state,this.camera),anchor=cubeTarget(points[i],{...state,cubeDistance:0},this.camera);const position=line.geometry.getAttribute('position');position.setXYZ(0,anchor.x,anchor.y,anchor.z);position.setXYZ(1,target.x,target.y,target.z);position.needsUpdate=true;line.geometry.computeBoundingSphere();});
  }
  updateVolume(hands,state,dt){
    const active=hands.filter(hand=>(this.suppressedHands.get(hand.label)||0)<=performance.now());if(!active.length){if(this.volume)this.volume.visible=false;return;}hands=active;if(!this.volume){const g=new THREE.BoxGeometry(.55,.55,.35);const m=new THREE.MeshStandardMaterial({color:state.edgeColor||'#65fff1',wireframe:!!state.wireframe,transparent:true,opacity:.82,metalness:.55,roughness:.25});this.volume=new THREE.Mesh(g,m);this.scene.add(this.volume);}const a=hands[0],b=hands[1]||a;const cx=((state.mirror?1-a.p[8].x:a.p[8].x)+(state.mirror?1-b.p[8].x:b.p[8].x))-1,cy=1-(a.p[8].y+b.p[8].y);const d=Math.hypot(a.p[8].x-b.p[8].x,a.p[8].y-b.p[8].y);this.volume.visible=true;this.volume.position.lerp(this.tmp.set(cx,cy,0),.18);this.volume.scale.set(.65+d*2,.65+d*2,.65+d*2);this.volume.rotation.y+=dt*.0007*(state.speed||1);this.volume.rotation.z=a.angle;this.volume.material.color.set(state.edgeColor||'#65fff1');this.volume.material.wireframe=!!state.wireframe;}
  spawnThrown(hand,event,state,mode){if(this.thrown.length>=10)return;const target=cubeTarget({p:hand.center,hand},state,this.camera),mesh=this.makeCube(mode==='volume'?state.edgeColor:state.cubeColor);mesh.position.set(target.x,target.y,target.z);mesh.scale.setScalar(mode==='volume'?1.8:.5*(state.size||1));this.thrown.push(createThrownBody(mesh,event));this.suppressedHands.set(hand.label,performance.now()+900);this.lastThrow={event,time:performance.now()};}
  updateThrowPhysics(hands,state,dt,mode){if(state.throwEnabled)for(const event of this.throwDetector.update(hands,performance.now(),state.throwSensitivity||1)){const hand=hands.find(item=>item.label===event.label);if(hand)this.spawnThrown(hand,event,state,mode);}const now=performance.now();for(const [label,until] of this.suppressedHands)if(until<=now)this.suppressedHands.delete(label);const seconds=Math.min(.05,dt/1000);for(let i=this.thrown.length-1;i>=0;i--){const body=this.thrown[i];stepThrownBody(body,seconds,state.gravity??1.4);if(body.age>3.5||Math.abs(body.mesh.position.x)>6||body.mesh.position.y<-4){body.mesh.material.opacity=Math.max(0,body.mesh.material.opacity-seconds*5);if(body.mesh.material.opacity<=0){this.scene.remove(body.mesh);body.mesh.geometry.dispose();body.mesh.material.dispose();this.thrown.splice(i,1);}}}}
  render(mode,hands,state,dt){this.ensureLights();if(mode==='cube')this.updateCubes(hands,state,dt);else{this.ensureCubes(0);while(this.floatLines.length)this.removeFloatLine();}if(mode==='volume')this.updateVolume(hands,state,dt);else if(this.volume)this.volume.visible=false;if(['cube','volume'].includes(mode))this.updateThrowPhysics(hands,state,dt,mode);this.renderer.render(this.scene,this.camera);}
  ensureLights(){if(this.lit)return;this.lit=true;this.scene.add(new THREE.AmbientLight(0xffffff,.8));const light=new THREE.PointLight(0x66faff,8,4);light.position.set(0,1,2);this.scene.add(light);}
  dispose(){while(this.cubes.length)this.removeCube();while(this.floatLines.length)this.removeFloatLine();for(const body of this.thrown){this.scene.remove(body.mesh);body.mesh.geometry.dispose();body.mesh.material.dispose();}this.thrown=[];this.volume?.geometry.dispose();this.volume?.material.dispose();this.renderer.dispose();}
}
