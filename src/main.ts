import type { InputState } from './core/types.js';
import { createWorld, stepWorld } from './core/world.js';
import { ProceduralAudio } from './render/audio.js';
import { HudController } from './render/hud.js';
import { GameScene } from './render/scene.js';

const appEl = document.getElementById('app');
if (!appEl) {
  throw new Error('Missing #app container');
}

let world = createWorld();
const gameScene = new GameScene(appEl, world);
const hud = new HudController(appEl);
const audio = new ProceduralAudio();

const keys = new Set<string>();

window.addEventListener('keydown', (e) => {
  audio.unlock();
  const code = e.code;
  keys.add(code);
  if (code === 'KeyR') {
    world = createWorld();
  } else if (code === 'KeyM') {
    audio.toggleMute();
  }
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
});

function readInput(): InputState {
  let moveX = 0;
  let moveZ = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) moveX += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) moveZ -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) moveZ += 1;

  return {
    moveX,
    moveZ,
    sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    interact: keys.has('KeyE') || keys.has('Space'),
  };
}

const FIXED_DT = 1 / 60;
let lastTime = performance.now();
let accumulator = 0;

function loop(now: number): void {
  const frameDt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += frameDt;

  while (accumulator >= FIXED_DT) {
    world = stepWorld(world, readInput(), FIXED_DT);
    audio.playEvents(world.lastEvents);
    accumulator -= FIXED_DT;
  }

  gameScene.render(world);
  hud.update(world, audio.isMuted());
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
