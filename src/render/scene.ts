import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { WorldState } from '../core/types.js';
import { IslandEffects } from './effects.js';

interface LanternVisual {
  group: THREE.Group;
  orbMat: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
  safeRing: THREE.Mesh;
  modelSlot: THREE.Group;
  modelAttached: boolean;
}

interface ShadeVisual {
  group: THREE.Group;
  fallbackMesh: THREE.Mesh;
  modelAttached: boolean;
  mixer?: THREE.AnimationMixer;
  runAction?: THREE.AnimationAction;
  idleAction?: THREE.AnimationAction;
  inkMaterial: THREE.MeshStandardMaterial;
}

interface MoteVisual {
  group: THREE.Group;
  orb: THREE.Mesh;
  sprite: THREE.Sprite;
  beam: THREE.Mesh;
}

interface CachedGltf {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

/**
 * Three.js third-person renderer for Đảo Đèn Lồng (Night 1 – Đảo Bến)
 * using CC0/MIT GLTF assets + procedural nón lá & warm lighting.
 */
export class GameScene {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly ambientLight: THREE.AmbientLight;
  private readonly moonLight: THREE.DirectionalLight;
  private readonly clock = new THREE.Clock();
  private readonly loader = new GLTFLoader();
  private readonly sparkTexture: THREE.Texture;
  private readonly grassTexture: THREE.Texture;

  private readonly playerGroup: THREE.Group;
  private readonly playerFallback: THREE.Group;
  private readonly hatGroup: THREE.Group;
  private readonly playerLight: THREE.PointLight;
  private readonly pulseWave: THREE.Mesh;
  private playerMixer: THREE.AnimationMixer | null = null;
  private playerActions: {
    idle?: THREE.AnimationAction;
    run?: THREE.AnimationAction;
    jump?: THREE.AnimationAction;
  } = {};
  private activePlayerAction: THREE.AnimationAction | null = null;
  private prevPlayerPos = new THREE.Vector3(0, 0, 0);

  private lanternAsset: CachedGltf | null = null;
  private foxAsset: CachedGltf | null = null;

  private readonly moteVisuals = new Map<string, MoteVisual>();
  private readonly lanternVisuals = new Map<string, LanternVisual>();
  private readonly shadeVisuals = new Map<string, ShadeVisual>();
  private readonly effects: IslandEffects;
  private readonly container: HTMLElement;

  constructor(container: HTMLElement, initialWorld: WorldState) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0714);
    this.scene.fog = new THREE.FogExp2(0x120a1e, 0.024);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(56, width / height, 0.1, 240);
    this.camera.position.set(0, 8.5, 11.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.ambientLight = new THREE.AmbientLight(0x52487a, 0.78);
    this.scene.add(this.ambientLight);

    this.moonLight = new THREE.DirectionalLight(0x9fb8ff, 0.72);
    this.moonLight.position.set(16, 28, 14);
    this.moonLight.castShadow = true;
    this.scene.add(this.moonLight);

    const texLoader = new THREE.TextureLoader();
    this.grassTexture = texLoader.load('./assets/textures/grasslight-big.jpg');
    this.grassTexture.wrapS = THREE.RepeatWrapping;
    this.grassTexture.wrapT = THREE.RepeatWrapping;
    this.grassTexture.repeat.set(14, 14);
    this.grassTexture.colorSpace = THREE.SRGBColorSpace;

    this.sparkTexture = texLoader.load('./assets/textures/spark1.png');

    // Island ground (Đảo Bến, radius 40m with textured night grass)
    const groundGeo = new THREE.CylinderGeometry(40, 42, 1.6, 64);
    const groundMat = new THREE.MeshStandardMaterial({
      map: this.grassTexture,
      color: 0x45586d,
      roughness: 0.92,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -0.8;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.buildIslandBoundary();

    // Sea of clouds ring around the island
    const seaGeo = new THREE.RingGeometry(41, 150, 64);
    const seaMat = new THREE.MeshBasicMaterial({
      color: 0x140d24,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const sea = new THREE.Mesh(seaGeo, seaMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -0.6;
    this.scene.add(sea);

    // Character Mây group (GLTF model loads asynchronously + instant fallback + nón lá)
    this.playerGroup = new THREE.Group();
    this.playerFallback = this.buildFallbackPlayer();
    this.playerGroup.add(this.playerFallback);

    this.hatGroup = this.buildNonLaAndLantern();
    this.hatGroup.position.y = 1.48;
    this.playerGroup.add(this.hatGroup);

    this.playerLight = new THREE.PointLight(0xffb84d, 4.0, 14);
    this.playerLight.position.set(0, 1.4, 0.55);
    this.playerGroup.add(this.playerLight);

    // Pulse light ring effect
    this.pulseWave = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.65, 36),
      new THREE.MeshBasicMaterial({
        color: 0xffc864,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
      }),
    );
    this.pulseWave.rotation.x = -Math.PI / 2;
    this.pulseWave.position.y = 0.08;
    this.playerGroup.add(this.pulseWave);

    this.scene.add(this.playerGroup);

    this.effects = new IslandEffects(this.scene, 220, 38);
    this.loadAssets();
    this.syncEntities(initialWorld);
    window.addEventListener('resize', this.handleResize);
  }

  private buildIslandBoundary(): void {
    const postCount = 24;
    const fenceRadius = 39.3;
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x4b5369, roughness: 0.9 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x3b2c26, roughness: 0.85 });
    const postGeo = new THREE.CylinderGeometry(0.22, 0.28, 1.15, 7);

    const posts: THREE.Vector3[] = [];
    for (let i = 0; i < postCount; i++) {
      const a = (i / postCount) * Math.PI * 2;
      const x = Math.cos(a) * fenceRadius;
      const z = Math.sin(a) * fenceRadius;
      posts.push(new THREE.Vector3(x, 0, z));

      const post = new THREE.Mesh(postGeo, stoneMat);
      post.position.set(x, 0.55, z);
      post.castShadow = true;
      this.scene.add(post);
    }

    for (let i = 0; i < postCount; i++) {
      const p1 = posts[i];
      const p2 = posts[(i + 1) % postCount];
      const len = p1.distanceTo(p2);
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, len), railMat);
      rail.position.set(mid.x, 0.78, mid.z);
      rail.lookAt(p2.x, 0.78, p2.z);
      this.scene.add(rail);
    }

    // Stylized rim trees framing the 40m edge
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2e2128, roughness: 0.9 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x1d2b3a, roughness: 0.85 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.15;
      const r = 37.6;
      const tree = new THREE.Group();
      tree.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 2.2, 6), trunkMat);
      trunk.position.y = 1.1;
      trunk.castShadow = true;
      const crown = new THREE.Mesh(new THREE.ConeGeometry(1.45, 3.2, 7), canopyMat);
      crown.position.y = 3.1;
      crown.castShadow = true;
      tree.add(trunk, crown);
      this.scene.add(tree);
    }
  }

  private buildFallbackPlayer(): THREE.Group {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.32, 0.65, 4, 12),
      new THREE.MeshStandardMaterial({ color: 0xefe9dc, roughness: 0.55 }),
    );
    body.position.y = 0.65;
    body.castShadow = true;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xfbe2c4, roughness: 0.6 }),
    );
    head.position.y = 1.32;
    head.castShadow = true;
    g.add(body, head);
    return g;
  }

  private buildNonLaAndLantern(): THREE.Group {
    const g = new THREE.Group();
    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 0.32, 20),
      new THREE.MeshStandardMaterial({ color: 0xd9b36c, roughness: 0.72 }),
    );
    hat.position.y = 0.14;
    hat.castShadow = true;
    g.add(hat);

    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.2, 6),
      new THREE.MeshBasicMaterial({ color: 0x8a6d3b }),
    );
    cord.position.set(0, -0.06, 0.48);
    g.add(cord);

    const lantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xffb84d }),
    );
    lantern.position.set(0, -0.18, 0.48);
    g.add(lantern);
    return g;
  }

  private loadAssets(): void {
    // 1. Mây rigged character (RobotExpressive.glb)
    this.loader.load('./assets/models/RobotExpressive.glb', (gltf) => {
      const model = gltf.scene;
      model.scale.setScalar(0.42);
      model.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });

      const box = new THREE.Box3().setFromObject(model);
      model.position.y -= box.min.y;
      const topY = box.max.y - box.min.y;
      this.hatGroup.position.y = Math.max(1.2, topY - 0.08);

      this.playerFallback.visible = false;
      this.playerGroup.add(model);

      this.playerMixer = new THREE.AnimationMixer(model);
      const findClip = (names: string[]) =>
        gltf.animations.find((c) => names.some((n) => c.name.toLowerCase().includes(n))) ??
        gltf.animations[0];

      const idleClip = findClip(['idle']);
      const runClip = findClip(['running', 'walk']);
      const jumpClip = findClip(['jump']);
      if (idleClip) this.playerActions.idle = this.playerMixer.clipAction(idleClip);
      if (runClip) this.playerActions.run = this.playerMixer.clipAction(runClip);
      if (jumpClip) this.playerActions.jump = this.playerMixer.clipAction(jumpClip);

      if (this.playerActions.idle) {
        this.playerActions.idle.play();
        this.activePlayerAction = this.playerActions.idle;
      }
    });

    // 2. Great Lantern model (Lantern.glb)
    this.loader.load('./assets/models/Lantern.glb', (gltf) => {
      const base = gltf.scene;
      const box = new THREE.Box3().setFromObject(base);
      const height = Math.max(0.01, box.max.y - box.min.y);
      const scale = 3.2 / height;
      base.scale.setScalar(scale);
      const scaledBox = new THREE.Box3().setFromObject(base);
      base.position.y -= scaledBox.min.y;
      base.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          obj.castShadow = true;
        }
      });
      this.lanternAsset = { scene: base, animations: gltf.animations };
      this.attachLanternAssets();
    });

    // 3. Ink Shadow model (Fox.glb)
    this.loader.load('./assets/models/Fox.glb', (gltf) => {
      const base = gltf.scene;
      const box = new THREE.Box3().setFromObject(base);
      const height = Math.max(0.01, box.max.y - box.min.y);
      const scale = 1.45 / height;
      base.scale.setScalar(scale);
      const scaledBox = new THREE.Box3().setFromObject(base);
      base.position.y -= scaledBox.min.y;
      this.foxAsset = { scene: base, animations: gltf.animations };
      this.attachShadeAssets();
    });
  }

  private attachLanternAssets(): void {
    if (!this.lanternAsset) return;
    for (const vis of this.lanternVisuals.values()) {
      if (vis.modelAttached) continue;
      const clone = this.lanternAsset.scene.clone(true);
      vis.modelSlot.add(clone);
      vis.modelAttached = true;
    }
  }

  private attachShadeAssets(): void {
    if (!this.foxAsset) return;
    for (const vis of this.shadeVisuals.values()) {
      if (vis.modelAttached) continue;
      const clone = SkeletonUtils.clone(this.foxAsset.scene) as THREE.Group;
      clone.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.material = vis.inkMaterial;
          mesh.castShadow = true;
        }
      });
      vis.fallbackMesh.visible = false;
      vis.group.add(clone);
      vis.modelAttached = true;

      if (this.foxAsset.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(clone);
        const runClip =
          this.foxAsset.animations.find((c) => c.name.toLowerCase().includes('run')) ??
          this.foxAsset.animations[0];
        const idleClip =
          this.foxAsset.animations.find((c) => c.name.toLowerCase().includes('survey')) ??
          this.foxAsset.animations[0];
        vis.mixer = mixer;
        vis.runAction = mixer.clipAction(runClip);
        vis.idleAction = mixer.clipAction(idleClip);
        vis.runAction.play();
      }
    }
  }

  private handleResize = (): void => {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private syncEntities(world: WorldState): void {
    const moteGeo = new THREE.SphereGeometry(0.24, 12, 12);
    const moteMat = new THREE.MeshBasicMaterial({ color: 0xffd86b });
    const ringGeo = new THREE.RingGeometry(0.55, 0.72, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffc857,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    });
    const beamGeo = new THREE.CylinderGeometry(0.05, 0.16, 0.85, 8);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffd27d,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });

    for (const m of world.motes) {
      if (!this.moteVisuals.has(m.id)) {
        const group = new THREE.Group();
        group.position.set(m.pos[0], 0, m.pos[2]);

        const orb = new THREE.Mesh(moteGeo, moteMat);
        orb.position.y = 0.85;

        const spriteMat = new THREE.SpriteMaterial({
          map: this.sparkTexture,
          color: 0xffcc55,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(1.35, 1.35, 1);
        sprite.position.y = 0.85;

        const groundRing = new THREE.Mesh(ringGeo, ringMat);
        groundRing.rotation.x = -Math.PI / 2;
        groundRing.position.y = 0.04;

        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.y = 0.45;

        group.add(orb, sprite, groundRing, beam);
        this.scene.add(group);
        this.moteVisuals.set(m.id, { group, orb, sprite, beam });
      }
    }

    for (const l of world.lanterns) {
      if (!this.lanternVisuals.has(l.id)) {
        const group = new THREE.Group();
        group.position.set(l.pos[0], l.pos[1], l.pos[2]);

        const modelSlot = new THREE.Group();
        group.add(modelSlot);

        const pedestal = new THREE.Mesh(
          new THREE.CylinderGeometry(0.65, 0.85, 0.35, 8),
          new THREE.MeshStandardMaterial({ color: 0x3b4459, roughness: 0.85 }),
        );
        pedestal.position.y = 0.17;
        pedestal.receiveShadow = true;
        group.add(pedestal);

        const orbMat = new THREE.MeshStandardMaterial({
          color: 0x2c243d,
          emissive: 0x160f24,
          emissiveIntensity: 0.25,
        });
        const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 1), orbMat);
        orb.position.y = 2.65;
        group.add(orb);

        const light = new THREE.PointLight(0xffa938, 0, 24);
        light.position.y = 2.9;
        group.add(light);

        const safeRing = new THREE.Mesh(
          new THREE.RingGeometry(world.tuning.safe_radius - 0.14, world.tuning.safe_radius, 48),
          new THREE.MeshBasicMaterial({
            color: 0xffb84d,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0,
          }),
        );
        safeRing.rotation.x = -Math.PI / 2;
        safeRing.position.y = 0.05;
        group.add(safeRing);

        this.scene.add(group);
        this.lanternVisuals.set(l.id, {
          group,
          orbMat,
          light,
          safeRing,
          modelSlot,
          modelAttached: false,
        });
      }
    }
    this.attachLanternAssets();

    const shadowGeo = new THREE.ConeGeometry(0.65, 1.9, 12);
    for (const s of world.shades) {
      if (!this.shadeVisuals.has(s.id)) {
        const group = new THREE.Group();
        const inkMaterial = new THREE.MeshStandardMaterial({
          color: 0x09040f,
          emissive: 0x4b0d6b,
          emissiveIntensity: 1.0,
          roughness: 0.35,
        });
        const fallbackMesh = new THREE.Mesh(shadowGeo, inkMaterial);
        fallbackMesh.position.y = 0.95;
        fallbackMesh.castShadow = true;
        group.add(fallbackMesh);
        this.scene.add(group);
        this.shadeVisuals.set(s.id, {
          group,
          fallbackMesh,
          modelAttached: false,
          inkMaterial,
        });
      }
    }
    this.attachShadeAssets();
  }

  private setPlayerAnimation(target?: THREE.AnimationAction): void {
    if (!target || this.activePlayerAction === target) return;
    if (this.activePlayerAction) {
      this.activePlayerAction.fadeOut(0.15);
    }
    target.reset().fadeIn(0.15).play();
    this.activePlayerAction = target;
  }

  render(world: WorldState, camYawDeg: number): void {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.syncEntities(world);

    const timeSec = world.tick / 60;
    const curPos = new THREE.Vector3(world.player.pos[0], world.player.pos[1], world.player.pos[2]);
    const movedDist = Math.hypot(curPos.x - this.prevPlayerPos.x, curPos.z - this.prevPlayerPos.z);
    this.prevPlayerPos.copy(curPos);

    this.playerGroup.position.copy(curPos);
    this.playerGroup.rotation.y = world.player.yaw_rad;

    if (this.playerMixer) {
      if (world.player.pos[1] > 0.12) {
        this.setPlayerAnimation(this.playerActions.jump ?? this.playerActions.run);
      } else if (movedDist > 0.015) {
        this.setPlayerAnimation(this.playerActions.run);
      } else {
        this.setPlayerAnimation(this.playerActions.idle);
      }
      this.playerMixer.update(dt);
    }

    // Pulse shockwave animation
    const ticksSincePulse = world.tick - world.last_pulse_tick;
    const pulseMat = this.pulseWave.material as THREE.MeshBasicMaterial;
    if (ticksSincePulse >= 0 && ticksSincePulse < 24) {
      const t = ticksSincePulse / 24;
      const scale = 1 + t * world.tuning.pulse_radius * 1.5;
      this.pulseWave.scale.set(scale, scale, 1);
      pulseMat.opacity = (1 - t) * 0.85;
    } else {
      pulseMat.opacity = 0;
    }

    for (const m of world.motes) {
      const vis = this.moteVisuals.get(m.id);
      if (vis) {
        vis.group.visible = m.active;
        const bobY = 0.85 + Math.sin(timeSec * 3.2 + m.pos[0]) * 0.16;
        vis.orb.position.y = bobY;
        vis.sprite.position.y = bobY;
      }
    }

    let litCount = 0;
    for (const l of world.lanterns) {
      if (l.lit) litCount++;
      const vis = this.lanternVisuals.get(l.id);
      if (vis) {
        const ringMat = vis.safeRing.material as THREE.MeshBasicMaterial;
        if (l.lit) {
          vis.orbMat.color.setHex(0xffdf99);
          vis.orbMat.emissive.setHex(0xff9f2e);
          vis.orbMat.emissiveIntensity = 1.9;
          vis.light.intensity = 10.0;
          ringMat.opacity = 0.48;
        } else {
          vis.orbMat.color.setHex(0x2c243d);
          vis.orbMat.emissive.setHex(0xff9f2e);
          vis.orbMat.emissiveIntensity =
            0.2 + (l.deposited / Math.max(1, world.tuning.lantern_cost)) * 0.7;
          vis.light.intensity = 0.8 + l.deposited * 1.4;
          ringMat.opacity = 0;
        }
      }
    }

    for (const s of world.shades) {
      const vis = this.shadeVisuals.get(s.id);
      if (vis) {
        vis.group.position.set(s.pos[0], 0, s.pos[2]);
        if (s.state === 'stunned') {
          vis.group.scale.setScalar(0.75);
          vis.inkMaterial.emissive.setHex(0x6e5980);
          vis.inkMaterial.emissiveIntensity = 0.4;
          if (vis.idleAction && vis.runAction) {
            vis.runAction.stop();
            vis.idleAction.play();
          }
        } else {
          vis.group.scale.setScalar(1.0);
          vis.inkMaterial.emissive.setHex(0x4b0d6b);
          vis.inkMaterial.emissiveIntensity = 1.05;
          const dx = world.player.pos[0] - s.pos[0];
          const dz = world.player.pos[2] - s.pos[2];
          if (Math.hypot(dx, dz) > 0.05) {
            vis.group.rotation.y = Math.atan2(dx, dz);
          }
          if (vis.runAction && vis.idleAction) {
            vis.idleAction.stop();
            vis.runAction.play();
          }
        }
        if (vis.mixer) {
          vis.mixer.update(dt);
        }
      }
    }

    const ratio = world.lanterns.length > 0 ? litCount / world.lanterns.length : 0;
    this.effects.update(timeSec, ratio);

    const bg = new THREE.Color(0x0b0714).lerp(new THREE.Color(0x241a2e), ratio);
    this.scene.background = bg;
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.copy(bg);
    fog.density = 0.025 - ratio * 0.013;
    this.ambientLight.intensity = 0.75 + ratio * 0.7;
    this.ambientLight.color.setHex(0x52487a).lerp(new THREE.Color(0xffcfa0), ratio * 0.75);

    const theta = (camYawDeg * Math.PI) / 180;
    const camDist = 11.5;
    const camHeight = 8.0;
    const targetCamPos = new THREE.Vector3(
      world.player.pos[0] + Math.sin(theta) * camDist,
      world.player.pos[1] + camHeight,
      world.player.pos[2] + Math.cos(theta) * camDist,
    );
    this.camera.position.lerp(targetCamPos, 0.18);
    this.camera.lookAt(world.player.pos[0], world.player.pos[1] + 1.0, world.player.pos[2]);

    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    window.removeEventListener('resize', this.handleResize);
    this.effects.dispose();
    this.grassTexture.dispose();
    this.sparkTexture.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
