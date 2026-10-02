import './style.css';
import { CameraEngine } from './core/camera.js';
import { HandTracker } from './core/handTracker.js';
import { GestureDetector } from './core/gestureDetector.js';
import { FXRenderer } from './core/renderer.js';
import { ThreeOverlay } from './core/threeOverlay.js';
import { PersonSegmenter, backgroundDifference } from './core/segmenter.js';
import { buildUI } from './ui/controls.js';
import { FaceTracker } from './core/faceTracker.js';
import { FaceExpressionSmoother } from './core/faceExpressions.js';

const defaults={cubeDistance:5,floatDirection:'camera',cubeFloatDebug:false,cubeFingers:{thumb:false,index:true,middle:true,ring:true,pinky:true},particleMode:'hand',flowStrength:1.5,flowRadius:240,flowSmoothness:70,particleTrail:55,handFlowDebug:false,faceEmoji:true,emojiStyle:'classic',emojiSize:1.25,expressionSensitivity:1,faceSmoothness:.72,expressionDebug:false,mode:'cube',frameRenderer:'classic',frameEffect:'pop',size:1,speed:1,particles:600,particleSize:3,dispersion:70,particleColor:'#35f4ff',mirror:true,debug:true,maskDebug:false,camera:'user',cubeColor:'#c45bff',edgeColor:'#65fff1',opacity:1,wireframe:false,follow:6,pixelSize:10,colorDepth:5,posterize:5,borderColor:'#4cfbff',borderWidth:3,edgeGlow:12,transitionDuration:1000,gestureHold:500,bpm:120,syncSource:'manual',beatPhase:0,fxOrder:['rgb','glitch','mirror','wave','mono','invert','mosaic','strobe','zoom','film'],fxEnabled:{rgb:false,glitch:false,mirror:false,wave:false,mono:false,invert:false,mosaic:false,strobe:false,zoom:false,film:false},fxParams:Object.fromEntries(['rgb','glitch','mirror','wave','mono','invert','mosaic','strobe','zoom','film'].map(name=>[name,{amount:name==='mosaic'?12:35}]))};
function loadSettings(){try{const saved=JSON.parse(localStorage.getItem('hand-motion-settings')||'{}');return saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{}}catch{return {}}}
const state={...structuredClone(defaults),...loadSettings(),differenceSensitivity:.18,running:false,gesture:''};
state.cubeDistance=Math.max(0,Math.min(10,Number(state.cubeDistance)||0));state.floatDirection=['camera','up','outward'].includes(state.floatDirection)?state.floatDirection:defaults.floatDirection;state.cubeFingers=state.cubeFingers&&typeof state.cubeFingers==='object'?{...defaults.cubeFingers,...state.cubeFingers}:{...defaults.cubeFingers};state.fxOrder=Array.isArray(state.fxOrder)?state.fxOrder.filter(name=>defaults.fxOrder.includes(name)):structuredClone(defaults.fxOrder);state.fxOrder.push(...defaults.fxOrder.filter(name=>!state.fxOrder.includes(name)));state.fxEnabled=state.fxEnabled&&typeof state.fxEnabled==='object'?{...defaults.fxEnabled,...state.fxEnabled}:{...defaults.fxEnabled};state.fxParams=Object.fromEntries(defaults.fxOrder.map(name=>[name,{...defaults.fxParams[name],...(state.fxParams?.[name]&&typeof state.fxParams[name]==='object'?state.fxParams[name]:{})}]));
document.querySelector('#app').innerHTML=buildUI();
const $=s=>document.querySelector(s), video=$('#camera'), canvas=$('#output'), overlay=$('#overlay'), threeCanvas=$('#three');
const invisiblePanel=document.querySelector('[data-mode-panel="invisible"]');
invisiblePanel?.insertAdjacentHTML('afterbegin','<p id="captureCountdown" aria-live="polite"></p><canvas id="backgroundPreview" width="160" height="90"></canvas><p id="maskMethod">MASK METHOD: —</p><input data-setting="differenceSensitivity" type="range" min=".05" max=".5" step=".01"><output data-output="differenceSensitivity"></output>');
const camera=new CameraEngine(video),tracker=new HandTracker(),gestures=new GestureDetector(),renderer=new FXRenderer(canvas,overlay),segmenter=new PersonSegmenter(),faceTracker=new FaceTracker(),faceSmoother=new FaceExpressionSmoother();
let three=null,raf=0,lastRender=0,lastCamera=0,lastInference=0,lastSegment=0,lastFaceInference=0,background=null,segmentation=null,faces=[],recorder=null,chunks=[],lastData={hands:[],bones:[],gesture:''};
let captureTimer=null,audioContext=null,analyser=null,micData=null,micStream=null,micRequest=0,lastMicBeat=0,draggedFx=null;
const diagnostic={camera:0,render:0,mediaPipe:0,mediaPipeStatus:'idle',webglStatus:'not initialized',lastError:'—'};

function setStatus(text,kind=''){ $('#status').textContent=text;$('#status').className=kind; }
function fail(where,error){const msg=error?.message||String(error);diagnostic.lastError=`${where}: ${msg}`;console.error(where,error);}
function syncControls(){document.querySelectorAll('[data-cube-finger]').forEach(el=>{el.checked=!!state.cubeFingers[el.dataset.cubeFinger];});document.querySelectorAll('[data-setting]').forEach(el=>{const k=el.dataset.setting;el.type==='checkbox'?el.checked=state[k]:el.value=state[k];const out=document.querySelector(`[data-output="${k}"]`);if(out)out.textContent=el.dataset.unit==='ms'?`${state[k]} ms (${(state[k]/1000).toFixed(1)}秒)`:state[k];});}
function syncFrameRenderer(){const mosw=state.frameRenderer==='mosw';document.querySelector('[data-frame-classic]').hidden=mosw;document.querySelector('[data-frame-mosw]').hidden=!mosw;}
function syncFxControls(){document.querySelectorAll('[data-fx-toggle]').forEach(el=>el.checked=!!state.fxEnabled[el.dataset.fxToggle]);document.querySelectorAll('[data-fx-param]').forEach(el=>{el.value=state.fxParams[el.dataset.fxParam].amount;document.querySelector(`[data-fx-output=\"${el.dataset.fxParam}\"]`).textContent=el.value;});const list=$('#fxList');state.fxOrder.forEach(name=>list?.append(list.querySelector(`[data-fx=\"${name}\"]`)));}
async function stopAudioSync() {
  const stream = micStream;
  const context = audioContext;
  micStream = null;
  analyser = null;
  micData = null;
  audioContext = null;
  stream?.getTracks().forEach((track) => track.stop());
  if (context && context.state !== 'closed') await context.close();
}
async function setSyncSource(source) {
  const request = ++micRequest;
  await stopAudioSync();
  state.syncSource = source;
  if (source !== 'mic') { $('#bpmStatus').textContent = 'SYNC: MANUAL'; return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio:true});
    if (request !== micRequest || state.syncSource !== 'mic') { stream.getTracks().forEach((track) => track.stop()); return; }
    const context = new AudioContext();
    const node = context.createMediaStreamSource(stream);
    const nextAnalyser = context.createAnalyser();
    nextAnalyser.fftSize = 256;
    node.connect(nextAnalyser);
    micStream = stream;
    audioContext = context;
    analyser = nextAnalyser;
    micData = new Uint8Array(analyser.frequencyBinCount);
    $('#bpmStatus').textContent = 'SYNC: MIC';
  } catch (error) {
    await stopAudioSync();
    state.syncSource = 'manual';
    $('#syncSource').value = 'manual';
    $('#bpmStatus').textContent = 'SYNC: MANUAL (MIC UNAVAILABLE)';
    fail('Microphone', error);
  }
}
function updateBeat(now){if(analyser){analyser.getByteFrequencyData(micData);const energy=micData.reduce((a,b)=>a+b,0)/micData.length;if(energy>95&&now-lastMicBeat>220){lastMicBeat=now;state.beatPhase=0;}else state.beatPhase=Math.min(1,(now-lastMicBeat)/(60000/state.bpm));}else state.beatPhase=(now%(60000/state.bpm))/(60000/state.bpm);}
function activePanel(){document.querySelectorAll('[data-mode-panel]').forEach(x=>x.hidden=x.dataset.modePanel!==state.mode);document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x.dataset.mode===state.mode));}
function showMaskFallback(){const ready=!!background;$('#maskStatus').textContent=ready?'PERSON MASK: FALLBACK READY':'PERSON MASK: AI ERROR · CAPTURE BACKGROUND';$('#maskMethod').textContent=ready?'MASK METHOD: BACKGROUND DIFFERENCE':'MASK METHOD: BACKGROUND REQUIRED';}
function enableSegmentation(){if(segmenter.segmenter||segmenter.loading||segmenter.failed){if(segmenter.failed)showMaskFallback();return;}diagnostic.mediaPipeStatus='segmenter loading';$('#maskStatus').textContent='PERSON MASK: LOADING';segmenter.init().then(()=>{$('#maskStatus').textContent=`PERSON MASK: READY (${segmenter.delegate})`;$('#maskMethod').textContent='MASK METHOD: AI';}).catch(e=>{fail('Person segmentation',e);showMaskFallback();});}
function enableFaces(){if(faceTracker.ready||faceTracker.loading||faceTracker.failed)return;$('#faceStatus').textContent='FACE LANDMARKER: LOADING';faceTracker.init().then(()=>{$('#faceStatus').textContent=`FACE LANDMARKER: READY (${faceTracker.delegate})`;}).catch(e=>{$('#faceStatus').textContent='FACE LANDMARKER: UNAVAILABLE · ANIME STILL ACTIVE';fail('Face initialisation',e);});}
function scheduleBackgroundCapture(){if(!video.srcObject||video.readyState<2){setStatus('カメラ映像がないため撮影できません','error');return;}clearInterval(captureTimer);let seconds=3;$('#captureCountdown').textContent=`背景撮影まで ${seconds} 秒`;captureTimer=setInterval(()=>{seconds-=1;if(seconds>0){$('#captureCountdown').textContent=`背景撮影まで ${seconds} 秒`;return;}clearInterval(captureTimer);captureTimer=null;background=renderer.capture(video);const preview=$('#backgroundPreview');preview?.getContext('2d').drawImage(background,0,0,160,90);$('#backgroundStatus').textContent='BACKGROUND: READY';$('#captureCountdown').textContent='背景を保存しました';if(segmenter.failed)showMaskFallback();setStatus('背景をキャプチャしました','ok');},1000);}
function emptyResult(){return {landmarks:[],handednesses:[]};}
function resetTracking(){lastData={hands:[],bones:[],gesture:''};faces=[];segmentation=null;lastInference=lastFaceInference=lastSegment=0;renderer.reset();}
function updateMetrics(now){const rate=t=>t?Math.round(1000/Math.max(1,now-t)):0;$('#metrics').textContent=`Camera FPS: ${rate(lastCamera)} · Render FPS: ${diagnostic.render} · MediaPipe FPS: ${diagnostic.mediaPipe} · Detected Hands: ${lastData.hands.length} · MediaPipe: ${diagnostic.mediaPipeStatus} · WebGL: ${diagnostic.webglStatus} · Last Error: ${diagnostic.lastError}`;}

async function start(){
  try {
    setStatus('カメラを起動中…');await camera.start({facingMode:state.camera,width:{ideal:1280},height:{ideal:720}});
    renderer.resize(video.videoWidth,video.videoHeight);resetTracking();state.running=true;lastRender=performance.now();
    try {three?.dispose?.();three=new ThreeOverlay(threeCanvas);three.resize(video.videoWidth,video.videoHeight);diagnostic.webglStatus='ready';}catch(e){three=null;diagnostic.webglStatus='unavailable';fail('WebGL initialisation',e);}
    setStatus('LIVE','ok');raf=requestAnimationFrame(loop);
    diagnostic.mediaPipeStatus='loading';tracker.init().then(()=>{diagnostic.mediaPipeStatus=`ready (${tracker.delegate})`;}).catch(e=>{diagnostic.mediaPipeStatus='unavailable';fail('MediaPipe initialisation',e);});
  }catch(e){fail('Camera start',e);setStatus(`起動できません: ${e.message}`,'error');const errorEl=$('#error');if(errorEl)errorEl.textContent='カメラ権限またはカメラ接続を確認してください。';}
}

function loop(now){
  if(!state.running)return;
  // The next frame is reserved first: no inference, segmentation, or WebGL exception can freeze video.
  raf=requestAnimationFrame(loop);
  const dt=Math.max(1,now-lastRender);lastRender=now;diagnostic.render=Math.round(1000/dt);
  if(video.videoWidth&&video.videoHeight&&(canvas.width!==video.videoWidth||canvas.height!==video.videoHeight)){renderer.resize(video.videoWidth,video.videoHeight);three?.resize(video.videoWidth,video.videoHeight);}
  updateBeat(now);try {renderer.render(video,lastData,{...state,adaptiveParticleLimit:diagnostic.render<22?Math.min(state.particles,500):state.particles},background,now,segmentation,faces);lastCamera=now;}catch(e){fail('Canvas render',e);}
  if(three){try{three.render(state.mode,lastData.hands,state,dt);}catch(e){fail('WebGL render',e);diagnostic.webglStatus='failed';three.dispose?.();three=null;}}
  if(tracker.ready){
    try {const started=performance.now(),result=tracker.detect(video,now)||emptyResult();lastData=gestures.update(result,now,video.videoWidth,video.videoHeight,state.mode==='invisible'?state.gestureHold:120);state.gesture=lastData.gesture;$('#gestureStatus').textContent=`GESTURE: ${lastData.rawGesture} · HOLD ${Math.round(lastData.holdElapsed)} ms · INVISIBLE ${state.gesture==='OPEN'?'ON':'OFF'}`;diagnostic.mediaPipe=Math.round(1000/Math.max(1,performance.now()-started));diagnostic.mediaPipeStatus=`ready (${tracker.delegate})`;lastInference=now;}
    catch(e){diagnostic.mediaPipeStatus='inference error';fail('MediaPipe inference',e);lastData={hands:[],bones:[],gesture:''};}
  }
  if(['invisible','dissolve'].includes(state.mode)){enableSegmentation();if(segmenter.segmenter&&!segmenter.detecting&&now-lastSegment>100){lastSegment=now;segmenter.detect(video,now).then(x=>{segmentation=x;}).catch(e=>{fail('Person segmentation',e);showMaskFallback();});}if(!segmenter.segmenter&&segmenter.failed&&background&&now-lastSegment>100){segmentation=backgroundDifference(background,video,state.differenceSensitivity);lastSegment=now;showMaskFallback();}}
  if(state.mode==='anime'&&state.faceEmoji){enableFaces();const interval=diagnostic.render<24?140:70;if(faceTracker.ready&&now-lastFaceInference>interval){lastFaceInference=now;try{faces=faceSmoother.update(faceTracker.detect(video,now),now,state.expressionSensitivity,state.faceSmoothness);$('#faceStatus').textContent=`FACE: ${faces.map(f=>f.expression).join(' / ')||'NOT FOUND'} (${faceTracker.delegate})`;}catch(e){faces=[];fail('Face inference',e);}}}else faces=[];
  updateMetrics(now);
}
async function reset(){await setSyncSource('manual');Object.assign(state,structuredClone(defaults));localStorage.removeItem('hand-motion-settings');renderer.reset();syncControls();syncFrameRenderer();syncFxControls();activePanel();}
function saveShot(){const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='hand-motion-fx.png';a.click();}
function toggleRecord(){if(recorder?.state==='recording'){recorder.stop();return;}chunks=[];recorder=new MediaRecorder(canvas.captureStream(30),{mimeType:'video/webm'});recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(chunks,{type:'video/webm'}));a.download='hand-motion-fx.webm';a.click();$('#record').textContent='REC';};recorder.start();$('#record').textContent='STOP';}
document.addEventListener('click',async e=>{const mode=e.target.closest('[data-mode]');if(mode){state.mode=mode.dataset.mode;activePanel();if(['invisible','dissolve'].includes(state.mode))enableSegmentation();if(state.mode==='anime'&&state.faceEmoji)enableFaces();}if(e.target.closest('#startCamera'))await start();if(e.target.closest('#reset'))reset();if(e.target.closest('#shot'))saveShot();if(e.target.closest('#record'))toggleRecord();if(e.target.closest('#maskDebug')){state.maskDebug=!state.maskDebug;e.target.textContent=`MASK DEBUG: ${state.maskDebug?'ON':'OFF'}`;}if(e.target.closest('#capture')){if(segmentation){background=renderer.capture(video);setStatus('背景をキャプチャしました','ok');$('#backgroundStatus').textContent='BACKGROUND: READY';}else setStatus('人物マスク未取得のため背景保存を確認してください','error');}if(e.target.closest('#clearBackground')){background=null;$('#backgroundStatus').textContent='BACKGROUND: NOT CAPTURED';}if(e.target.closest('#fullscreen'))$('#stage').requestFullscreen?.();if(e.target.closest('#flip')){state.camera=state.camera==='user'?'environment':'user';background=null;resetTracking();$('#backgroundStatus').textContent='BACKGROUND: INVALIDATED';await camera.restart({facingMode:state.camera});renderer.resize(video.videoWidth,video.videoHeight);}if(e.target.closest('#export')){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download='hand-motion-settings.json';a.click();}if(e.target.closest('#import'))$('#importFile').click();});
document.addEventListener('click',e=>{if(e.target.closest('#capture')){e.preventDefault();e.stopImmediatePropagation();scheduleBackgroundCapture();}},true);
document.addEventListener('change',e=>{if(e.target.dataset.cubeFinger){state.cubeFingers[e.target.dataset.cubeFinger]=e.target.checked;persist();}if(e.target.id==='syncSource')setSyncSource(e.target.value);if(e.target.dataset.fxToggle){const name=e.target.dataset.fxToggle,active=Object.values(state.fxEnabled).filter(Boolean).length;if(e.target.checked&&active>=3){e.target.checked=false;setStatus('MOSW FX: maximum 3 effects','error');return;}state.fxEnabled[name]=e.target.checked;}});
function persist(){try{const saved={...state};delete saved.running;delete saved.gesture;localStorage.setItem('hand-motion-settings',JSON.stringify(saved));}catch(error){fail('Settings save',error);}}
document.addEventListener('input',e=>{if(e.target.dataset.fxParam){const name=e.target.dataset.fxParam;state.fxParams[name].amount=+e.target.value;document.querySelector(`[data-fx-output=\"${name}\"]`).textContent=e.target.value;persist();return;}const k=e.target.dataset.setting;if(k){state[k]=e.target.type==='checkbox'?e.target.checked:(Number.isNaN(+e.target.value)?e.target.value:+e.target.value);syncControls();if(k==='frameRenderer')syncFrameRenderer();persist();}});
$('#importFile').addEventListener('change',async e=>{try{const parsed=JSON.parse(await e.target.files[0].text());if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('Invalid settings object');Object.assign(state,structuredClone(defaults),parsed,{running:state.running});persist();syncControls();syncFrameRenderer();syncFxControls();activePanel();}catch(err){fail('Settings import',err);setStatus('設定ファイルを読み込めません','error');}});syncControls();syncFrameRenderer();activePanel();

$('#fxList')?.addEventListener('dragstart',e=>{draggedFx=e.target.closest('[data-fx]')?.dataset.fx;});$('#fxList')?.addEventListener('dragover',e=>e.preventDefault());$('#fxList')?.addEventListener('drop',e=>{e.preventDefault();const target=e.target.closest('[data-fx]')?.dataset.fx;if(!draggedFx||!target||draggedFx===target)return;const order=state.fxOrder.filter(n=>n!==draggedFx),i=order.indexOf(target);order.splice(i,0,draggedFx);state.fxOrder=order;syncFxControls();});syncFxControls();

window.addEventListener('pagehide',()=>{micRequest++;void stopAudioSync();});
