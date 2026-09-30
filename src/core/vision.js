import { FilesetResolver } from '@mediapipe/tasks-vision';

const wasmUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm';
let visionPromise;

// Loading the Tasks Vision WASM runtime twice wastes a significant amount of memory.
// HandLandmarker and ImageSegmenter can safely create their own task instances from
// the same resolved fileset.
export function getVisionFileset() {
  if (!visionPromise) visionPromise = FilesetResolver.forVisionTasks(wasmUrl);
  return visionPromise;
}
