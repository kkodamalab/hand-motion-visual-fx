import { strict as assert } from 'node:assert';
import { PersonSegmenter } from '../src/core/segmenter.js';

const mask={width:2,height:1,getAsFloat32Array:()=>new Float32Array([1,0])};
let closed=false;
const success=new PersonSegmenter({resolveVision:async()=>({}),createSegmenter:async(_vision,options)=>{assert.equal(options.baseOptions.delegate,'CPU');return {segmentForVideo:()=>({categoryMask:mask,close:()=>{closed=true;}}),close(){}};}});
await success.init();
assert.equal(success.delegate,'CPU');
assert.deepEqual([...((await success.detect({readyState:2},1)).data)],[1,0]);
assert(closed,'MediaPipe segmentation result must be released');

const attempts=[];
const failed=new PersonSegmenter({resolveVision:async()=>({}),createSegmenter:async(_vision,options)=>{attempts.push(options.baseOptions.delegate);throw new Error('unavailable');}});
await assert.rejects(failed.init(),/CPU: unavailable \/ GPU: unavailable/);
await assert.rejects(failed.init(),/Person Segmenter initialization failed/);
assert.deepEqual(attempts,['CPU','GPU'],'initialization may fall back once but must not retry indefinitely');

const runtime=new PersonSegmenter({resolveVision:async()=>({}),createSegmenter:async()=>({segmentForVideo(){throw new Error('runtime failure');},close(){}})});
await runtime.init();
await assert.rejects(runtime.detect({readyState:2},1),/runtime failure/);
assert.equal(runtime.failed,true);
assert.equal(runtime.segmenter,null,'runtime failure must release the AI task for background fallback');
console.log('Segmenter passed');
