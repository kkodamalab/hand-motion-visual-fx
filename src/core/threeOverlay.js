import * as THREE from 'three';

export class ThreeOverlay {
  constructor(canvas){
    this.canvas=canvas; this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});
    this.scene=new THREE.Scene(); this.camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10);this.camera.position.z=2;
    this.cubes=[]; this.volume=null; this.tmp=new THREE.Vector3();
  }
  resize(w,h){this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setSize(w,h,false);}
  makeCube(color){
    const geometry=new THREE.BoxGeometry(.15,.15,.15); const material=new THREE.MeshStandardMaterial({color,metalness:.65,roughness:.22,transparent:true});
    const mesh=new THREE.Mesh(geometry,material); this.scene.add(mesh);return mesh;
  }
  ensureCubes(n,color){while(this.cubes.length<n)this.cubes.push(this.makeCube(color)); while(this.cubes.length>n)this.scene.remove(this.cubes.pop());}
  updateCubes(hands,state,dt){
    const points=hands.flatMap(hand=>[8,12,16,20].map(i=>({p:hand.p[i],speed:hand.speed})));this.ensureCubes(points.length,state.cubeColor||'#c45bff');
    this.cubes.forEach((cube,i)=>{const point=points[i];const targetX=(state.mirror?1-point.p.x:point.p.x)*2-1,targetY=1-point.p.y*2; cube.position.lerp(this.tmp.set(targetX,targetY,0),Math.min(1,dt*.014*(state.follow||6)));cube.scale.setScalar(.5*(state.size||1));cube.rotation.x+=dt*.001*(state.speed||1)*(1+point.speed*4);cube.rotation.y+=dt*.0015*(state.speed||1);cube.material.color.set(state.cubeColor||'#c45bff');cube.material.wireframe=!!state.wireframe;cube.material.opacity=state.opacity??1;});
  }
  updateVolume(hands,state,dt){
    if(!hands.length){if(this.volume)this.volume.visible=false;return;} if(!this.volume){const g=new THREE.BoxGeometry(.55,.55,.35);const m=new THREE.MeshStandardMaterial({color:state.edgeColor||'#65fff1',wireframe:!!state.wireframe,transparent:true,opacity:.82,metalness:.55,roughness:.25});this.volume=new THREE.Mesh(g,m);this.scene.add(this.volume);}const a=hands[0],b=hands[1]||a;const cx=((state.mirror?1-a.p[8].x:a.p[8].x)+(state.mirror?1-b.p[8].x:b.p[8].x))-1,cy=1-(a.p[8].y+b.p[8].y);const d=Math.hypot(a.p[8].x-b.p[8].x,a.p[8].y-b.p[8].y);this.volume.visible=true;this.volume.position.lerp(this.tmp.set(cx,cy,0),.18);this.volume.scale.set(.65+d*2,.65+d*2,.65+d*2);this.volume.rotation.y+=dt*.0007*(state.speed||1);this.volume.rotation.z=a.angle;this.volume.material.color.set(state.edgeColor||'#65fff1');this.volume.material.wireframe=!!state.wireframe;}
  render(mode,hands,state,dt){this.ensureLights();if(mode==='cube')this.updateCubes(hands,state,dt);else this.ensureCubes(0);if(mode==='volume')this.updateVolume(hands,state,dt);else if(this.volume)this.volume.visible=false;this.renderer.render(this.scene,this.camera);}
  ensureLights(){if(this.lit)return;this.lit=true;this.scene.add(new THREE.AmbientLight(0xffffff,.8));const light=new THREE.PointLight(0x66faff,8,4);light.position.set(0,1,2);this.scene.add(light);}
  dispose(){this.cubes.forEach(c=>{c.geometry.dispose();c.material.dispose();});this.volume?.geometry.dispose();this.volume?.material.dispose();this.renderer.dispose();}
}
