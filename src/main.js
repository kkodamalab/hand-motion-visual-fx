import './style.css';
import { CameraEngine } from './core/camera.js';
import { HandTracker } from './core/handTracker.js';
import { GestureDetector } from './core/gestureDetector.js';
import { FXRenderer } from './core/renderer.js';
import { buildUI } from './ui/controls.js';

const defaults = { mode: 'cube', frameEffect: 'pop', transform: 'glass', strength: .72, size: 1, speed: 1, particles: 700, mirror: true, debug: true, video: true, camera: 'user' };
const state = { ...defaults, running: false, settingsOpen: false };
const app = document.querySelector('#app');
app.innerHTML = buildUI();
const $ = s => document.querySelector(s);
const video = $('#camera'), canvas = $('#output'), overlay = $('#overlay');
const camera = new CameraEngine(video);
const tracker = new HandTracker();
const gestures = new GestureDetector();
const renderer = new FXRenderer(canvas, overlay);
let raf = 0, last = 0, background = null, recorder = null, chunks = [];

function setStatus(text, kind='') { $('#status').textContent = text; $('#status').className = kind; }
function syncControls() { document.querySelectorAll('[data-setting]').forEach(el => { const k=el.dataset.setting; if (el.type === 'checkbox') el.checked = state[k]; else el.value = state[k]; }); }
function activePanel(){ document.querySelectorAll('[data-mode-panel]').forEach(x => x.hidden=x.dataset.modePanel!==state.mode); document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x.dataset.mode===state.mode)); }

async function start() {
  try {
    setStatus('モデルを読み込み中…');
    await tracker.init();
    setStatus('カメラを起動中…');
    await camera.start({ facingMode: state.camera, width: { ideal: 1280 }, height: { ideal: 720 } });
    renderer.resize(video.videoWidth, video.videoHeight); state.running=true; $('#home').hidden=true; $('#studio').hidden=false;
    setStatus('LIVE', 'ok'); loop(performance.now());
  } catch (e) { console.error(e); setStatus(`起動できません: ${e.message}`, 'error'); $('#error').textContent='カメラ権限、WebGL、またはMediaPipeモデルの読み込みを確認してください。'; }
}
async function loop(now) {
  if (!state.running) return;
  const result = tracker.detect(video, now);
  const data = gestures.update(result, now, video.videoWidth, video.videoHeight);
  renderer.render(video, data, state, background, now);
  const fps = last ? Math.round(1000/(now-last)) : 0; last=now;
  $('#metrics').textContent = `${fps} FPS · ${data.hands.length}/2 HANDS · ${data.gesture || '—'}`;
  raf=requestAnimationFrame(loop);
}
function reset(){ Object.assign(state, defaults); renderer.reset(); syncControls(); activePanel(); }
function saveShot(){ const a=document.createElement('a'); a.href=canvas.toDataURL('image/png'); a.download='hand-motion-fx.png'; a.click(); }
function toggleRecord(){ if(recorder?.state==='recording'){ recorder.stop(); return; } chunks=[]; recorder=new MediaRecorder(canvas.captureStream(30),{mimeType:'video/webm'}); recorder.ondataavailable=e=>chunks.push(e.data); recorder.onstop=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(chunks,{type:'video/webm'}));a.download='hand-motion-fx.webm';a.click();$('#record').textContent='REC';}; recorder.start(); $('#record').textContent='STOP'; }

document.addEventListener('click', async e=>{
  const mode=e.target.closest('[data-mode]'); if(mode){state.mode=mode.dataset.mode;activePanel();}
  if(e.target.closest('#startA')) { state.mode='cube'; await start(); }
  if(e.target.closest('#startB')) { state.mode='frame'; await start(); }
  if(e.target.closest('#back')){state.running=false;cancelAnimationFrame(raf);camera.stop();$('#studio').hidden=true;$('#home').hidden=false;}
  if(e.target.closest('#reset')) reset(); if(e.target.closest('#shot')) saveShot(); if(e.target.closest('#record')) toggleRecord();
  if(e.target.closest('#capture')) { background=renderer.capture(video); setStatus('背景をキャプチャしました', 'ok'); }
  if(e.target.closest('#fullscreen')) $('#stage').requestFullscreen?.();
  if(e.target.closest('#flip')) { state.camera=state.camera==='user'?'environment':'user'; await camera.restart({facingMode:state.camera}); }
  if(e.target.closest('#export')) { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download='hand-motion-settings.json';a.click(); }
  if(e.target.closest('#import')) $('#importFile').click();
});
document.addEventListener('input',e=>{const k=e.target.dataset.setting;if(!k)return;state[k]=e.target.type==='checkbox'?e.target.checked:(Number.isNaN(+e.target.value)?e.target.value:+e.target.value);});
$('#importFile').addEventListener('change',async e=>{try{Object.assign(state,JSON.parse(await e.target.files[0].text()));syncControls();activePanel();}catch{setStatus('設定ファイルを読み込めません', 'error');}});
syncControls(); activePanel();
