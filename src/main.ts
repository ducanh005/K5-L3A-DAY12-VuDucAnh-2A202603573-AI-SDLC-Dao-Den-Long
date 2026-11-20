import type { InputState, NightNumber, WorldState } from './core/types.js';
import { createBenchWorld, createWorld, FIXED_DT, stepBenchWorld, stepWorld } from './core/world.js';
import { ProceduralAudio } from './render/audio.js';
import type { ScreenMode } from './render/hud.js';
import { HudController } from './render/hud.js';
import {
  formatIsoWithTimezone,
  type LeaderboardEntry,
  loadLeaderboard,
  saveLeaderboardEntry,
  syncLeaderboardFromDisk,
} from './render/leaderboard.js';
import { GameScene } from './render/scene.js';
import { loadSettings, saveSettings } from './render/settings.js';

const appEl = document.getElementById('app');
if (!appEl) {
  throw new Error('Missing #app container');
}

const urlParams = new URLSearchParams(window.location.search);
const isBenchMode = urlParams.get('bench') === '1';

if (isBenchMode) {
  runBenchmarkMode(appEl, urlParams);
} else {
  runInteractiveGame(appEl);
}

function runBenchmarkMode(container: HTMLElement, params: URLSearchParams): void {
  const seed = Number.parseInt(params.get('seed') ?? '42', 10) || 42;
  const durationSec = Math.max(1, Number.parseFloat(params.get('duration') ?? '30') || 30);

  let benchWorld = createBenchWorld(seed);
  const gameScene = new GameScene(container, benchWorld, true);

  let simAccumulator = 0;
  let warmupDone = false;
  let firstFrameSent = false;
  const dts: number[] = [];

  const startWall = performance.now();
  let measureStart = 0;
  let prevFrameWall = startWall;

  function benchLoop(now: number): void {
    if (!firstFrameSent) {
      firstFrameSent = true;
      fetch('/api/first-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true }),
      }).catch(() => {});
    }

    const frameDtMs = now - prevFrameWall;
    prevFrameWall = now;

    if (!warmupDone) {
      if (now - startWall >= 3000) {
        warmupDone = true;
        measureStart = now;
        prevFrameWall = now;
      }
    } else if (measureStart > 0 && now > measureStart) {
      dts.push(frameDtMs);
    }

    simAccumulator += Math.min(frameDtMs / 1000, 0.1);
    while (simAccumulator >= FIXED_DT) {
      benchWorld = stepBenchWorld(benchWorld, FIXED_DT);
      simAccumulator -= FIXED_DT;
    }

    const totalElapsedSec = (now - startWall) / 1000;
    const orbitAngleRad = (totalElapsedSec / 15) * Math.PI * 2;
    gameScene.render(benchWorld, 0, false, true, orbitAngleRad);

    if (warmupDone && (now - measureStart) / 1000 >= durationSec) {
      const n = dts.length;
      const sumDt = dts.reduce((acc, v) => acc + v, 0);
      const avgFps = sumDt > 0 ? (1000 * n) / sumDt : 0;

      const sortedDesc = [...dts].sort((a, b) => b - a);
      const k = Math.max(1, Math.ceil(0.01 * n));
      const worstAvgDt = sortedDesc.slice(0, k).reduce((acc, v) => acc + v, 0) / k;
      const p1LowFps = worstAvgDt > 0 ? 1000 / worstAvgDt : 0;

      const sortedAsc = [...dts].sort((a, b) => a - b);
      const p95Idx = Math.min(n - 1, Math.max(0, Math.ceil(0.95 * n) - 1));
      const frameMsP95 = sortedAsc[p95Idx] ?? 0;

      const payload = {
        frames: n,
        avg_fps: Math.round(avgFps * 10) / 10,
        p1_low_fps: Math.round(p1LowFps * 10) / 10,
        frame_ms_p95: Math.round(frameMsP95 * 10) / 10,
        renderer: gameScene.getRendererDescription(),
      };
      (window as unknown as { __BENCH_RESULT__?: unknown }).__BENCH_RESULT__ = payload;
      fetch('/api/bench-done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
      return;
    }

    requestAnimationFrame(benchLoop);
  }

  requestAnimationFrame(benchLoop);
}

function runInteractiveGame(container: HTMLElement): void {
  let settings = loadSettings();
  let leaderboardEntries: LeaderboardEntry[] = loadLeaderboard();
  void syncLeaderboardFromDisk().then((entries) => {
    leaderboardEntries = entries;
  });

  let currentNight: NightNumber = 1;
  let currentSeed = 2043;
  const nightScores: [number, number, number] = [0, 0, 0];
  const nightWonFlags: [boolean, boolean, boolean] = [false, false, false];
  let totalCampaignScore = 0;
  let highlightedAchievedAt: string | null = null;
  let screenMode: ScreenMode = 'menu';
  let screenBeforeSettings: ScreenMode = 'menu';

  let world: WorldState = createWorld({ seed: currentSeed, night: 1 });
  const gameScene = new GameScene(container, world, false);
  const audio = new ProceduralAudio();
  audio.applySettings(settings);

  const keys = new Set<string>();
  let camYawDeg = 0;
  let isDragging = false;
  let lastMouseX = 0;
  let pulseMouseClick = false;
  let prevGrounded = true;

  function recomputeTotals(): void {
    totalCampaignScore = nightScores[0] + nightScores[1] + nightScores[2];
  }

  function resetRunTracking(): void {
    nightScores.fill(0);
    nightWonFlags.fill(false);
    totalCampaignScore = 0;
    highlightedAchievedAt = null;
    hud.resetRunSaveState();
  }

  function startNight(night: NightNumber, showIntro: boolean): void {
    currentNight = night;
    currentSeed = 2026 + night * 17;
    world = createWorld({ seed: currentSeed, night });
    camYawDeg = 0;
    prevGrounded = true;
    keys.clear();
    hud.resetRunSaveState();
    screenMode = showIntro ? 'intro' : 'playing';
  }

  const hud = new HudController(container, settings, {
    onStartCampaign: () => {
      audio.unlock();
      resetRunTracking();
      startNight(1, true);
    },
    onSelectNight: (night) => {
      audio.unlock();
      resetRunTracking();
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
    onOpenLeaderboard: () => {
      screenMode = 'leaderboard';
      void syncLeaderboardFromDisk().then((entries) => {
        leaderboardEntries = entries;
      });
    },
    onSaveScore: async (name: string) => {
      const nightsWon = nightWonFlags.filter(Boolean).length;
      const achievedAt = formatIsoWithTimezone(new Date());
      highlightedAchievedAt = achievedAt;
      leaderboardEntries = await saveLeaderboardEntry({
        name,
        score: totalCampaignScore,
        nights_won: nightsWon,
        achieved_at: achievedAt,
        seed: currentSeed,
      });
    },
    getLeaderboard: () => leaderboardEntries,
  });

  window.addEventListener('keydown', (e) => {
    if (hud.isTextInputOrRebindFocused()) return;
    audio.unlock();
    const code = e.code;
    keys.add(code);

    if (code === 'KeyM') {
      audio.toggleMute();
    } else if (code === settings.keyBindings.pause || code === 'KeyP') {
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
    const kb = settings.keyBindings;
    let moveX = 0;
    let moveZ = 0;
    if (keys.has(kb.moveLeft)) moveX -= 1;
    if (keys.has(kb.moveRight)) moveX += 1;
    if (keys.has(kb.moveForward)) moveZ -= 1;
    if (keys.has(kb.moveBackward)) moveZ += 1;

    if (keys.has('KeyQ')) camYawDeg += 1.8 * settings.mouseSensitivity;
    if (keys.has('KeyC')) camYawDeg -= 1.8 * settings.mouseSensitivity;

    const pulsePressed = keys.has(kb.pulse) || pulseMouseClick;
    pulseMouseClick = false;

    return {
      move: [moveX, moveZ],
      cam_yaw_deg: camYawDeg,
      jump: keys.has(kb.jump),
      interact: keys.has(kb.interact),
      pulse: pulsePressed,
      dash: keys.has(kb.dash),
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
          nightScores[currentNight - 1] = world.score;
          nightWonFlags[currentNight - 1] = true;
          recomputeTotals();
          screenMode = currentNight === 3 ? 'dawn' : 'result';
          break;
        } else if (world.state === 'lost') {
          recomputeTotals();
          screenMode = 'result';
          break;
        }
      }
    } else {
      accumulator = 0;
    }

    gameScene.render(world, camYawDeg, settings.colorblindMode, settings.reducedMotion);
    hud.update(screenMode, world, gameScene, totalCampaignScore, settings, audio.isMuted(), {
      nightsWon: nightWonFlags.filter(Boolean).length,
      seed: currentSeed,
      highlightedAchievedAt,
    });
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}
