import type { InputState } from './core/types.js';
import { createWorld, FIXED_DT, stepWorld } from './core/world.js';
import { ProceduralAudio } from './render/audio.js';
import { HudController } from './render/hud.js';
import { GameScene } from './render/scene.js';

const appEl = document.getElementById('app');
if (!appEl) {
  throw new Error('Missing #app container');
}

let world = createWorld({ seed: 2026, night: 1 });
const gameScene = new GameScene(appEl, world);
const hud = new HudController(appEl);
const audio = new ProceduralAudio();

const keys = new Set<string>();
let camYawDeg = 0;
let isDragging = false;
let lastMouseX = 0;
let pulseMouseClick = false;

window.addEventListener('keydown', (e) => {
  audio.unlock();
  const code = e.code;
  keys.add(code);
  if (code === 'KeyR') {
    world = createWorld({ seed: 2026, night: 1 });
    camYawDeg = 0;
  } else if (code === 'KeyM') {
    audio.toggleMute();
  }
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
});

window.addEventListener('mousedown', (e) => {
  audio.unlock();
  if (e.button === 0) {
    isDragging = true;
    lastMouseX = e.clientX;
  } else if (e.button === 2) {
    pulseMouseClick = true;
  }
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const dx = e.clientX - lastMouseX;
  lastMouseX = e.clientX;
  camYawDeg -= dx * 0.35;
});

window.addEventListener('mouseup', () => {
  isDragging = false;
});

window.addEventListener('contextmenu', (e) => e.preventDefault());

function readInput(): InputState {
  let moveX = 0;
  let moveZ = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) moveX += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) moveZ -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) moveZ += 1;

  if (keys.has('KeyQ')) camYawDeg += 1.6;
  if (keys.has('KeyC')) camYawDeg -= 1.6;

  const pulsePressed =
    keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyX') || pulseMouseClick;
  pulseMouseClick = false;

  return {
    move: [moveX, moveZ],
    cam_yaw_deg: camYawDeg,
    jump: keys.has('Space'),
    interact: keys.has('KeyE') || keys.has('KeyF'),
    pulse: pulsePressed,
    dash: false,
  };
}

let lastTime = performance.now();
let accumulator = 0;

function loop(now: number): void {
  const frameDt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += frameDt;

  while (accumulator >= FIXED_DT) {
    world = stepWorld(world, readInput(), FIXED_DT);
    audio.playEvents(world.last_events);
    accumulator -= FIXED_DT;
  }

  gameScene.render(world, camYawDeg);
  hud.update(world, audio.isMuted());
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
