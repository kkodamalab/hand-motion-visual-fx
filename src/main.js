import './style.css';
import { CameraEngine } from './core/camera.js';
import { HandTracker } from './core/handTracker.js';
import { GestureDetector } from './core/gestureDetector.js';
import { FXRenderer } from './core/renderer.js';
import { ThreeOverlay } from './core/threeOverlay.js';
import { PersonSegmenter } from './core/segmenter.js';
import { buildUI } from './ui/controls.js';

const defaults={mode:'cube',frameEffect:'pop',size:1,speed:1,particles:400,particleSize:3,dispersion:70,particleColor:'#ff4baf',mirror:true,debug:true,maskDebug:false,camera:'user',cubeColor:'#c45bff',edgeColor:'#65fff1',opacity:1,wireframe:false,follow:6,pixelSize:10,colorDepth:5,posterize:5,borderColor:'#4cfbff',borderWidth:3,edgeGlow:12,transitionDuration:1000,gestureHold:500};
const state={...defaults,running:false,gesture:''};
document.querySelector('#app').innerHTML=buildUI();
const $=s=>document.querySelector(s), video=$('#camera'), canvas=$('#output'), overlay=$('#overlay'), threeCanvas=$('#three');
const invisiblePanel=document.querySelector('[data-mode-panel="invisible"]');
invisiblePanel?.insertAdjacentHTML('afterbegin','<p id="captureCountdown" aria-live="polite"></p><canvas id="backgroundPreview" width="160" height="90"></canvas>');
const camera=new CameraEngine(video),tracker=new HandTracker(),gestures=new GestureDetector(),renderer=new FXRenderer(canvas,overlay),segmenter=new PersonSegmenter();
let three=null,raf=0,lastRender=0,lastCamera=0,lastInference=0,lastSegment=0,background=null,segmentation=null,recorder=null,chunks=[],lastData={hands:[],bones:[],gesture:''};
let captureTimer=null;
const diagnostic={camera:0,render:0,mediaPipe:0,mediaPipeStatus:'idle',webglStatus:'not initialized',lastError:'—'};

function setStatus(text,kind=''){ $('#status').textContent=text;$('#status').className=kind; }
function fail(where,error){const msg=error?.message||String(error);diagnostic.lastError=`${where}: ${msg}`;console.error(where,error);}
function syncControls(){document.querySelectorAll('[data-setting]').forEach(el=>{const k=el.dataset.setting;el.type==='checkbox'?el.checked=state[k]:el.value=state[k];const out=document.querySelector(`[data-output="${k}"]`);if(out)out.textContent=el.dataset.unit==='ms'?`${state[k]} ms (${(state[k]/1000).toFixed(1)}秒)`:state[k];});}
function activePanel(){document.querySelectorAll('[data-mode-panel]').forEach(x=>x.hidden=x.dataset.modePanel!==state.mode);document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x.dataset.mode===state.mode));}
function enableSegmentation(){if(segmenter.segmenter||segmenter.loading)return;diagnostic.mediaPipeStatus='segmenter loading';$('#maskStatus').textContent='PERSON MASK: LOADING';segmenter.init().then(()=>{$('#maskStatus').textContent='PERSON MASK: READY';}).catch(e=>{fail('Person segmentation',e);$('#maskStatus').textContent='PERSON MASK: ERROR';});}
function scheduleBackgroundCapture(){if(!video.srcObject||video.readyState<2){setStatus('カメラ映像がないため撮影できません','error');return;}clearInterval(captureTimer);let seconds=3;$('#captureCountdown').textContent=`背景撮影まで ${seconds} 秒`;captureTimer=setInterval(()=>{seconds-=1;if(seconds>0){$('#captureCountdown').textContent=`背景撮影まで ${seconds} 秒`;return;}clearInterval(captureTimer);captureTimer=null;background=renderer.capture(video);const preview=$('#backgroundPreview');preview?.getContext('2d').drawImage(background,0,0,160,90);$('#backgroundStatus').textContent='BACKGROUND: READY';$('#captureCountdown').textContent='背景を保存しました';setStatus(segmentation?'背景をキャプチャしました':'背景をキャプチャしました（マスク未取得・要確認）',segmentation?'ok':'error');},1000);}
function emptyResult(){return {landmarks:[],handednesses:[]};}
function updateMetrics(now){const rate=t=>t?Math.round(1000/Math.max(1,now-t)):0;$('#metrics').textContent=`Camera FPS: ${rate(lastCamera)} · Render FPS: ${diagnostic.render} · MediaPipe FPS: ${diagnostic.mediaPipe} · Detected Hands: ${lastData.hands.length} · MediaPipe: ${diagnostic.mediaPipeStatus} · WebGL: ${diagnostic.webglStatus} · Last Error: ${diagnostic.lastError}`;}

async function start(){
  try {
    setStatus('カメラを起動中…');await camera.start({facingMode:state.camera,width:{ideal:1280},height:{ideal:720}});
    renderer.resize(video.videoWidth,video.videoHeight);state.running=true;lastRender=performance.now();
    try {three=new ThreeOverlay(threeCanvas);three.resize(video.videoWidth,video.videoHeight);diagnostic.webglStatus='ready';}catch(e){three=null;diagnostic.webglStatus='unavailable';fail('WebGL initialisation',e);}
    setStatus('LIVE','ok');raf=requestAnimationFrame(loop);
    diagnostic.mediaPipeStatus='loading';tracker.init().then(()=>{diagnostic.mediaPipeStatus=`ready (${tracker.delegate})`;}).catch(e=>{diagnostic.mediaPipeStatus='unavailable';fail('MediaPipe initialisation',e);});
  }catch(e){fail('Camera start',e);setStatus(`起動できません: ${e.message}`,'error');const errorEl=$('#error');if(errorEl)errorEl.textContent='カメラ権限またはカメラ接続を確認してください。';}
}

function loop(now){
  if(!state.running)return;
  // The next frame is reserved first: no inference, segmentation, or WebGL exception can freeze video.
  raf=requestAnimationFrame(loop);
  const dt=Math.max(1,now-lastRender);lastRender=now;diagnostic.render=Math.round(1000/dt);
  try {renderer.render(video,lastData,state,background,now,segmentation);lastCamera=now;}catch(e){fail('Canvas render',e);}
  if(three){try{three.render(state.mode,lastData.hands,state,dt);}catch(e){fail('WebGL render',e);diagnostic.webglStatus='failed';three.dispose?.();three=null;}}
  if(tracker.ready){
    try {const started=performance.now(),result=tracker.detect(video,now)||emptyResult();lastData=gestures.update(result,now,video.videoWidth,video.videoHeight,state.mode==='invisible'?state.gestureHold:120);state.gesture=lastData.gesture;$('#gestureStatus').textContent=`GESTURE: ${lastData.rawGesture} · HOLD ${Math.round(lastData.holdElapsed)} ms · INVISIBLE ${state.gesture==='OPEN'?'ON':'OFF'}`;diagnostic.mediaPipe=Math.round(1000/Math.max(1,performance.now()-started));diagnostic.mediaPipeStatus=`ready (${tracker.delegate})`;lastInference=now;}
    catch(e){diagnostic.mediaPipeStatus='inference error';fail('MediaPipe inference',e);lastData={hands:[],bones:[],gesture:''};}
  }
  if(['invisible','dissolve'].includes(state.mode)){enableSegmentation();if(segmenter.segmenter&&now-lastSegment>100)segmenter.detect(video,now).then(x=>{segmentation=x;lastSegment=now;}).catch(e=>fail('Person segmentation',e));}
  updateMetrics(now);
}
function reset(){Object.assign(state,defaults);renderer.reset();syncControls();activePanel();}
function saveShot(){const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='hand-motion-fx.png';a.click();}
function toggleRecord(){if(recorder?.state==='recording'){recorder.stop();return;}chunks=[];recorder=new MediaRecorder(canvas.captureStream(30),{mimeType:'video/webm'});recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(chunks,{type:'video/webm'}));a.download='hand-motion-fx.webm';a.click();$('#record').textContent='REC';};recorder.start();$('#record').textContent='STOP';}
document.addEventListener('click',async e=>{const mode=e.target.closest('[data-mode]');if(mode){state.mode=mode.dataset.mode;activePanel();if(['invisible','dissolve'].includes(state.mode))enableSegmentation();}if(e.target.closest('#startCamera'))await start();if(e.target.closest('#reset'))reset();if(e.target.closest('#shot'))saveShot();if(e.target.closest('#record'))toggleRecord();if(e.target.closest('#maskDebug')){state.maskDebug=!state.maskDebug;e.target.textContent=`MASK DEBUG: ${state.maskDebug?'ON':'OFF'}`;}if(e.target.closest('#capture')){if(segmentation){background=renderer.capture(video);setStatus('背景をキャプチャしました','ok');$('#backgroundStatus').textContent='BACKGROUND: READY';}else setStatus('人物マスク未取得のため背景保存を確認してください','error');}if(e.target.closest('#clearBackground')){background=null;$('#backgroundStatus').textContent='BACKGROUND: NOT CAPTURED';}if(e.target.closest('#fullscreen'))$('#stage').requestFullscreen?.();if(e.target.closest('#flip')){state.camera=state.camera==='user'?'environment':'user';background=null;$('#backgroundStatus').textContent='BACKGROUND: INVALIDATED';await camera.restart({facingMode:state.camera});}if(e.target.closest('#export')){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download='hand-motion-settings.json';a.click();}if(e.target.closest('#import'))$('#importFile').click();});
document.addEventListener('click',e=>{if(e.target.closest('#capture')){e.preventDefault();e.stopImmediatePropagation();scheduleBackgroundCapture();}},true);
document.addEventListener('input',e=>{const k=e.target.dataset.setting;if(k){state[k]=e.target.type==='checkbox'?e.target.checked:(Number.isNaN(+e.target.value)?e.target.value:+e.target.value);syncControls();}});
$('#importFile').addEventListener('change',async e=>{try{Object.assign(state,JSON.parse(await e.target.files[0].text()));syncControls();activePanel();}catch(err){fail('Settings import',err);setStatus('設定ファイルを読み込めません','error');}});syncControls();activePanel();
