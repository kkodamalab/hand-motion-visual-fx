import * as THREE from 'three';

export const FINGER_TIPS={thumb:4,index:8,middle:12,ring:16,pinky:20};
export function selectedFingertips(hands,selected){return hands.flatMap(hand=>Object.entries(FINGER_TIPS).filter(([name])=>selected?.[name]).map(([name,index])=>({name,p:hand.p[index],speed:hand.speed})));}

export class ThreeOverlay {
  constructor(canvas){
    this.canvas=canvas; this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});
    this.scene=new THREE.Scene(); this.camera=new THREE.PerspectiveCamera(50,1,.1,20);this.camera.position.z=2;
    this.cubes=[]; this.volume=null; this.tmp=new THREE.Vector3();
  }
  resize(w,h){this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  makeCube(color){
    const geometry=new THREE.BoxGeometry(.15,.15,.15); const material=new THREE.MeshStandardMaterial({color,metalness:.65,roughness:.22,transparent:true});
    const mesh=new THREE.Mesh(geometry,material); this.scene.add(mesh);return mesh;
  }
  removeCube(){const cube=this.cubes.pop();if(!cube)return;this.scene.remove(cube);cube.geometry.dispose();cube.material.dispose();}
  ensureCubes(n,color){while(this.cubes.length<n)this.cubes.push(this.makeCube(color));while(this.cubes.length>n)this.removeCube();}
  updateCubes(hands,state,dt){
    const selected=state.cubeFingers||{index:true,middle:true,ring:true,pinky:true};
    const points=selectedFingertips(hands,selected);this.ensureCubes(points.length,state.cubeColor||'#c45bff');
    this.cubes.forEach((cube,i)=>{const point=points[i],z=Math.max(-1,Math.min(1,(state.cubeDistance||0)/100)),distance=this.camera.position.z-z,halfHeight=Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2))*distance,targetX=((state.mirror?1-point.p.x:point.p.x)*2-1)*halfHeight*this.camera.aspect,targetY=(1-point.p.y*2)*halfHeight;cube.position.lerp(this.tmp.set(targetX,targetY,z),Math.min(1,dt*.014*(state.follow||6)));cube.scale.setScalar(.5*(state.size||1));cube.rotation.x+=dt*.001*(state.speed||1)*(1+point.speed*4);cube.rotation.y+=dt*.0015*(state.speed||1);cube.material.color.set(state.cubeColor||'#c45bff');cube.material.wireframe=!!state.wireframe;cube.material.opacity=state.opacity??1;});
  }
  updateVolume(hands,state,dt){
    if(!hands.length){if(this.volume)this.volume.visible=false;return;} if(!this.volume){const g=new THREE.BoxGeometry(.55,.55,.35);const m=new THREE.MeshStandardMaterial({color:state.edgeColor||'#65fff1',wireframe:!!state.wireframe,transparent:true,opacity:.82,metalness:.55,roughness:.25});this.volume=new THREE.Mesh(g,m);this.scene.add(this.volume);}const a=hands[0],b=hands[1]||a;const cx=((state.mirror?1-a.p[8].x:a.p[8].x)+(state.mirror?1-b.p[8].x:b.p[8].x))-1,cy=1-(a.p[8].y+b.p[8].y);const d=Math.hypot(a.p[8].x-b.p[8].x,a.p[8].y-b.p[8].y);this.volume.visible=true;this.volume.position.lerp(this.tmp.set(cx,cy,0),.18);this.volume.scale.set(.65+d*2,.65+d*2,.65+d*2);this.volume.rotation.y+=dt*.0007*(state.speed||1);this.volume.rotation.z=a.angle;this.volume.material.color.set(state.edgeColor||'#65fff1');this.volume.material.wireframe=!!state.wireframe;}
  render(mode,hands,state,dt){this.ensureLights();if(mode==='cube')this.updateCubes(hands,state,dt);else this.ensureCubes(0);if(mode==='volume')this.updateVolume(hands,state,dt);else if(this.volume)this.volume.visible=false;this.renderer.render(this.scene,this.camera);}
  ensureLights(){if(this.lit)return;this.lit=true;this.scene.add(new THREE.AmbientLight(0xffffff,.8));const light=new THREE.PointLight(0x66faff,8,4);light.position.set(0,1,2);this.scene.add(light);}
  dispose(){while(this.cubes.length)this.removeCube();this.volume?.geometry.dispose();this.volume?.material.dispose();this.renderer.dispose();}
}
