import type { InputState, NightNumber, WorldState } from './core/types.js';
import { createWorld, FIXED_DT, stepWorld } from './core/world.js';
import { ProceduralAudio } from './render/audio.js';
import type { ScreenMode } from './render/hud.js';
import { HudController } from './render/hud.js';
import { GameScene } from './render/scene.js';
import { loadSettings, saveSettings } from './render/settings.js';

const appEl = document.getElementById('app');
if (!appEl) {
  throw new Error('Missing #app container');
}

let settings = loadSettings();
let currentNight: NightNumber = 1;
let totalCampaignScore = 0;
let campaignMode = true;
let screenMode: ScreenMode = 'menu';
let screenBeforeSettings: ScreenMode = 'menu';

let world: WorldState = createWorld({ seed: 2026, night: 1 });
const gameScene = new GameScene(appEl, world);
const audio = new ProceduralAudio();
audio.applySettings(settings);

const keys = new Set<string>();
let camYawDeg = 0;
let isDragging = false;
let lastMouseX = 0;
let pulseMouseClick = false;
let prevGrounded = true;

function startNight(night: NightNumber, showIntro: boolean): void {
  currentNight = night;
  world = createWorld({ seed: 2026 + night * 17, night });
  camYawDeg = 0;
  prevGrounded = true;
  keys.clear();
  screenMode = showIntro ? 'intro' : 'playing';
}

const hud = new HudController(appEl, settings, {
  onStartCampaign: () => {
    audio.unlock();
    campaignMode = true;
    totalCampaignScore = 0;
    startNight(1, true);
  },
  onSelectNight: (night) => {
    audio.unlock();
    campaignMode = false;
    totalCampaignScore = 0;
    startNight(night, true);
  },
  onBeginNight: () => {
    audio.unlock();
    screenMode = 'playing';
  },
  onResume: () => {
    screenMode = 'playing';
  },
  onRestartNight: () => {
    startNight(currentNight, false);
  },
  onNextNight: () => {
    if (currentNight < 3) {
      startNight((currentNight + 1) as NightNumber, true);
    } else {
      screenMode = 'dawn';
    }
  },
  onOpenSettings: () => {
    screenBeforeSettings = screenMode;
    screenMode = 'settings';
  },
  onCloseSettings: () => {
    screenMode = screenBeforeSettings;
  },
  onSaveSettings: (next) => {
    settings = next;
    saveSettings(settings);
    audio.applySettings(settings);
    screenMode = screenBeforeSettings;
  },
  onReturnMenu: () => {
    screenMode = 'menu';
  },
});

window.addEventListener('keydown', (e) => {
  audio.unlock();
  const code = e.code;
  keys.add(code);

  if (code === 'KeyM') {
    audio.toggleMute();
  } else if (code === 'Escape' || code === 'KeyP') {
    if (screenMode === 'playing') {
      screenMode = 'paused';
    } else if (screenMode === 'paused') {
      screenMode = 'playing';
    }
  } else if (screenMode === 'intro' && (code === 'Space' || code === 'Enter')) {
    screenMode = 'playing';
  } else if (code === 'KeyR' && (screenMode === 'playing' || screenMode === 'paused')) {
    startNight(currentNight, false);
  }
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
});

window.addEventListener('mousedown', (e) => {
  if (screenMode !== 'playing') return;
  audio.unlock();
  if (e.button === 0) {
    isDragging = true;
    lastMouseX = e.clientX;
  } else if (e.button === 2) {
    pulseMouseClick = true;
  }
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging || screenMode !== 'playing') return;
  const dx = e.clientX - lastMouseX;
  lastMouseX = e.clientX;
  camYawDeg -= dx * 0.35 * settings.mouseSensitivity;
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

  if (keys.has('KeyQ')) camYawDeg += 1.8 * settings.mouseSensitivity;
  if (keys.has('KeyC')) camYawDeg -= 1.8 * settings.mouseSensitivity;

  const pulsePressed = keys.has('KeyX') || pulseMouseClick;
  pulseMouseClick = false;

  return {
    move: [moveX, moveZ],
    cam_yaw_deg: camYawDeg,
    jump: keys.has('Space'),
    interact: keys.has('KeyE') || keys.has('KeyF'),
    pulse: pulsePressed,
    dash: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    pause: false,
  };
}

let lastTime = performance.now();
let accumulator = 0;

function loop(now: number): void {
  const frameDt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (screenMode === 'playing') {
    accumulator += frameDt;
    while (accumulator >= FIXED_DT) {
      world = stepWorld(world, readInput(), FIXED_DT);
      if (prevGrounded && !world.player.grounded && world.player.vel[1] > 0) {
        audio.playJump();
      }
      prevGrounded = world.player.grounded;
      audio.updateTickFeedback(world, world.last_events);
      accumulator -= FIXED_DT;

      if (world.state === 'won') {
        totalCampaignScore += world.score;
        screenMode = currentNight === 3 ? 'dawn' : 'result';
        break;
      } else if (world.state === 'lost') {
        screenMode = 'result';
        break;
      }
    }
  } else {
    accumulator = 0;
  }

  gameScene.render(world, camYawDeg);
  hud.update(screenMode, world, gameScene, totalCampaignScore, settings, audio.isMuted());
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
