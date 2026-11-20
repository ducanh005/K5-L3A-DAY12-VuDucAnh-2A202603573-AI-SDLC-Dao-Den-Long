import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { getMapSpec } from '../core/maps.js';
import type { NightNumber, Vec3Tuple, WorldState } from '../core/types.js';
import { IslandEffects } from './effects.js';

interface LanternVisual {
  group: THREE.Group;
  orbMat: THREE.MeshStandardMaterial;
  coreMesh: THREE.Mesh;
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
  currentClip?: 'run' | 'idle';
  inkMaterial: THREE.MeshStandardMaterial;
}

interface MoteVisual {
  group: THREE.Group;
  orb: THREE.Mesh;
  sprite: THREE.Sprite;
  beam: THREE.Mesh;
}

interface DrifterVisual {
  group: THREE.Group;
  ribbonMat: THREE.MeshStandardMaterial;
}

interface CharmVisual {
  group: THREE.Group;
}

interface CachedGltf {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

export interface ScreenProjection {
  x: number;
  y: number;
  onScreen: boolean;
}

/**
 * Three.js third-person renderer for Đảo Đèn Lồng (Nights 1–3)
 * following the exact Ticket-02 standard color palette and environmental lighting curve.
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

  private terrainGroup: THREE.Group;
  private currentNight: NightNumber = 1;

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
  private readonly drifterVisuals = new Map<string, DrifterVisual>();
  private readonly charmVisuals = new Map<string, CharmVisual>();
  private readonly moteGeo = new THREE.SphereGeometry(0.24, 12, 12);
  private readonly moteMat = new THREE.MeshBasicMaterial({ color: 0xfff6c2 });
  private readonly ringGeo = new THREE.RingGeometry(0.55, 0.72, 24);
  private readonly ringMat = new THREE.MeshBasicMaterial({
    color: 0xffe58a,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.7,
  });
  private readonly beamGeo = new THREE.CylinderGeometry(0.05, 0.16, 0.85, 8);
  private readonly beamMat = new THREE.MeshBasicMaterial({
    color: 0xffe58a,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  });
  private readonly shadowGeo = new THREE.ConeGeometry(0.65, 1.9, 12);
  private readonly effects: IslandEffects;
  private readonly container: HTMLElement;

  constructor(container: HTMLElement, initialWorld: WorldState) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e1430);
    this.scene.fog = new THREE.FogExp2(0x1b2350, 0.018);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(56, width / height, 0.1, 280);
    this.camera.position.set(0, 8.5, 11.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    // Exact ambient curve: 0.15 + 0.55 * (lit / total)
    this.ambientLight = new THREE.AmbientLight(0xd8e0ff, 0.15);
    this.scene.add(this.ambientLight);

    this.moonLight = new THREE.DirectionalLight(0xaec2ff, 0.65);
    this.moonLight.position.set(20, 34, 18);
    this.moonLight.castShadow = true;
    this.scene.add(this.moonLight);

    const texLoader = new THREE.TextureLoader();
    this.grassTexture = texLoader.load('./assets/textures/grasslight-big.jpg');
    this.grassTexture.wrapS = THREE.RepeatWrapping;
    this.grassTexture.wrapT = THREE.RepeatWrapping;
    this.grassTexture.repeat.set(14, 14);
    this.grassTexture.colorSpace = THREE.SRGBColorSpace;
    this.sparkTexture = texLoader.load('./assets/textures/spark1.png');

    // Sea of clouds (#12384A)
    const seaGeo = new THREE.CircleGeometry(220, 64);
    const seaMat = new THREE.MeshBasicMaterial({
      color: 0x12384a,
      transparent: true,
      opacity: 0.92,
    });
    const sea = new THREE.Mesh(seaGeo, seaMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -3.2;
    this.scene.add(sea);

    this.terrainGroup = new THREE.Group();
    this.scene.add(this.terrainGroup);
    this.buildTerrainForNight(initialWorld.night);

    // Mây character group (#E8E2D0 tunic, #C8102E scarf, nón lá + hanging lantern)
    this.playerGroup = new THREE.Group();
    this.playerFallback = this.buildFallbackPlayer();
    this.playerGroup.add(this.playerFallback);

    const scarf = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.07, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.6 }),
    );
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.15;
    this.playerGroup.add(scarf);

    this.hatGroup = this.buildNonLaAndLantern();
    this.hatGroup.position.y = 1.48;
    this.playerGroup.add(this.hatGroup);

    this.playerLight = new THREE.PointLight(0xffb347, 4.2, 15);
    this.playerLight.position.set(0, 1.4, 0.55);
    this.playerGroup.add(this.playerLight);

    this.pulseWave = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.68, 36),
      new THREE.MeshBasicMaterial({
        color: 0xffe58a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
      }),
    );
    this.pulseWave.rotation.x = -Math.PI / 2;
    this.pulseWave.position.y = 0.08;
    this.playerGroup.add(this.pulseWave);

    this.scene.add(this.playerGroup);

    this.effects = new IslandEffects(this.scene, 200, 44);
    this.loadAssets();
    this.syncEntities(initialWorld);
    window.addEventListener('resize', this.handleResize);
  }

  private buildTerrainForNight(night: NightNumber): void {
    this.currentNight = night;
    this.scene.remove(this.terrainGroup);
    this.terrainGroup = new THREE.Group();
    this.scene.add(this.terrainGroup);

    const grassMat = new THREE.MeshStandardMaterial({
      map: this.grassTexture,
      color: 0x2f5d50,
      roughness: 0.9,
    });
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xc9b48a, roughness: 0.92 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.85 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5b5f6e, roughness: 0.9 });

    const addIslandDisc = (cx: number, cz: number, radius: number, topY: number, height: number) => {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius + 0.6, height, 64), grassMat);
      top.position.set(cx, topY - height / 2, cz);
      top.receiveShadow = true;
      this.terrainGroup.add(top);

      const rim = new THREE.Mesh(new THREE.RingGeometry(radius - 0.8, radius + 0.2, 64), sandMat);
      rim.rotation.x = -Math.PI / 2;
      rim.position.set(cx, topY + 0.015, cz);
      this.terrainGroup.add(rim);
    };

    if (night === 1) {
      addIslandDisc(0, 0, 40, 0, 2.2);
    } else if (night === 2) {
      addIslandDisc(0, 0, 28, 0, 2.2);
      addIslandDisc(70, 0, 28, 0, 2.2);
      // Bamboo bridge x in [26, 44], z in [-2, 2]
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.35, 4), woodMat);
      bridge.position.set(35, -0.17, 0);
      bridge.receiveShadow = true;
      this.terrainGroup.add(bridge);
    } else {
      // Night 3: Tier 0 (R=45, Y=0)
      addIslandDisc(0, 0, 45, 0, 2.2);

      // Tier 1: annulus r in [12, 24], z > 0, Y = 3 (angles 0..PI in XZ)
      const tier1Shape = new THREE.Shape();
      tier1Shape.absarc(0, 0, 24, 0, Math.PI, false);
      tier1Shape.absarc(0, 0, 12, Math.PI, 0, true);
      const tier1Geo = new THREE.ExtrudeGeometry(tier1Shape, {
        depth: 3,
        bevelEnabled: false,
        curveSegments: 36,
      });
      tier1Geo.rotateX(Math.PI / 2);
      const tier1 = new THREE.Mesh(tier1Geo, grassMat);
      tier1.position.y = 3;
      tier1.receiveShadow = true;
      tier1.castShadow = true;
      this.terrainGroup.add(tier1);

      // Two straight 3m-wide ramps at 30° and 150° connecting r=30 (Y=0) to r=24 (Y=3)
      for (const deg of [30, 150]) {
        const rad = (deg * Math.PI) / 180;
        const ux = Math.cos(rad);
        const uz = Math.sin(rad);
        const nx = -uz * 1.5;
        const nz = ux * 1.5;
        const pInL: Vec3Tuple = [24 * ux + nx, 3, 24 * uz + nz];
        const pInR: Vec3Tuple = [24 * ux - nx, 3, 24 * uz - nz];
        const pOutL: Vec3Tuple = [30 * ux + nx, 0, 30 * uz + nz];
        const pOutR: Vec3Tuple = [30 * ux - nx, 0, 30 * uz - nz];
        const verts = new Float32Array([
          ...pInL, ...pOutL, ...pOutR,
          ...pInL, ...pOutR, ...pInR,
        ]);
        const rGeo = new THREE.BufferGeometry();
        rGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
        rGeo.computeVertexNormals();
        const rampMesh = new THREE.Mesh(
          rGeo,
          new THREE.MeshStandardMaterial({ color: 0x6b4a2f, side: THREE.DoubleSide, roughness: 0.85 }),
        );
        rampMesh.receiveShadow = true;
        this.terrainGroup.add(rampMesh);
      }

      // Tier 2: disc R=8 at Y=6
      addIslandDisc(0, 0, 8, 6, 6);

      // Central Bell Tower (r=2, height=8 on Tier 2)
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8, 16), stoneMat);
      tower.position.set(0, 10, 0);
      tower.castShadow = true;
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(2.6, 2.2, 16),
        new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.8 }),
      );
      roof.position.set(0, 15.1, 0);
      const bell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.65, 0.9, 12),
        new THREE.MeshStandardMaterial({ color: 0xf2c14e, metalness: 0.5, roughness: 0.4 }),
      );
      bell.position.set(0, 13.4, 0);
      this.terrainGroup.add(tower, roof, bell);
    }

    // Jump pads glowing discs
    const mapSpec = getMapSpec(night);
    for (const pad of mapSpec.jumpPads) {
      const padGroup = new THREE.Group();
      padGroup.position.set(pad.pos[0], pad.pos[1] + 0.05, pad.pos[2]);
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(pad.radius, pad.radius * 1.1, 0.14, 24),
        new THREE.MeshStandardMaterial({
          color: 0xf2c14e,
          emissive: 0xffb347,
          emissiveIntensity: 0.9,
        }),
      );
      padGroup.add(base);
      this.terrainGroup.add(padGroup);
    }
  }

  private clearAllEntityVisuals(): void {
    for (const v of this.moteVisuals.values()) this.scene.remove(v.group);
    for (const v of this.lanternVisuals.values()) this.scene.remove(v.group);
    for (const v of this.shadeVisuals.values()) this.scene.remove(v.group);
    for (const v of this.drifterVisuals.values()) this.scene.remove(v.group);
    for (const v of this.charmVisuals.values()) this.scene.remove(v.group);
    this.moteVisuals.clear();
    this.lanternVisuals.clear();
    this.shadeVisuals.clear();
    this.drifterVisuals.clear();
    this.charmVisuals.clear();
  }

  private buildFallbackPlayer(): THREE.Group {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.32, 0.65, 4, 12),
      new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.55 }),
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
      new THREE.MeshStandardMaterial({ color: 0xc9b48a, roughness: 0.72 }),
    );
    hat.position.y = 0.14;
    hat.castShadow = true;
    g.add(hat);

    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.2, 6),
      new THREE.MeshBasicMaterial({ color: 0x6b4a2f }),
    );
    cord.position.set(0, -0.06, 0.48);
    g.add(cord);

    const lantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xffb347 }),
    );
    lantern.position.set(0, -0.18, 0.48);
    g.add(lantern);
    return g;
  }

  private loadAssets(): void {
    this.loader.load('./assets/models/RobotExpressive.glb', (gltf) => {
      const model = gltf.scene;
      model.scale.setScalar(0.42);
      model.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.castShadow = true;
          m.receiveShadow = true;
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

    this.loader.load('./assets/models/Lantern.glb', (gltf) => {
      const base = gltf.scene;
      const box = new THREE.Box3().setFromObject(base);
      const scale = 3.2 / Math.max(0.01, box.max.y - box.min.y);
      base.scale.setScalar(scale);
      const scaledBox = new THREE.Box3().setFromObject(base);
      base.position.y -= scaledBox.min.y;
      base.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) obj.castShadow = true;
      });
      this.lanternAsset = { scene: base, animations: gltf.animations };
      this.attachLanternAssets();
    });

    this.loader.load('./assets/models/Fox.glb', (gltf) => {
      const base = gltf.scene;
      const box = new THREE.Box3().setFromObject(base);
      const scale = 1.45 / Math.max(0.01, box.max.y - box.min.y);
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
      vis.modelSlot.add(this.lanternAsset.scene.clone(true));
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
    // Sync motes (create missing, remove despawned/picked)
    const activeMoteIds = new Set(world.motes.map((m) => m.id));
    for (const [id, vis] of this.moteVisuals.entries()) {
      if (!activeMoteIds.has(id)) {
        this.scene.remove(vis.group);
        this.moteVisuals.delete(id);
      }
    }

    for (const m of world.motes) {
      if (!this.moteVisuals.has(m.id)) {
        const group = new THREE.Group();
        group.position.set(m.pos[0], m.pos[1], m.pos[2]);

        const orb = new THREE.Mesh(this.moteGeo, this.moteMat);
        orb.position.y = 0.85;

        const spriteMat = new THREE.SpriteMaterial({
          map: this.sparkTexture,
          color: 0xffe58a,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(1.35, 1.35, 1);
        sprite.position.y = 0.85;

        const groundRing = new THREE.Mesh(this.ringGeo, this.ringMat);
        groundRing.rotation.x = -Math.PI / 2;
        groundRing.position.y = 0.04;

        const beam = new THREE.Mesh(this.beamGeo, this.beamMat);
        beam.position.y = 0.45;

        group.add(orb, sprite, groundRing, beam);
        this.scene.add(group);
        this.moteVisuals.set(m.id, { group, orb, sprite, beam });
      }
    }

    // Lanterns
    for (const l of world.lanterns) {
      if (!this.lanternVisuals.has(l.id)) {
        const group = new THREE.Group();
        group.position.set(l.pos[0], l.pos[1], l.pos[2]);

        const modelSlot = new THREE.Group();
        group.add(modelSlot);

        const pedestal = new THREE.Mesh(
          new THREE.CylinderGeometry(0.65, 0.85, 0.35, 8),
          new THREE.MeshStandardMaterial({ color: 0x5b5f6e, roughness: 0.85 }),
        );
        pedestal.position.y = 0.17;
        pedestal.receiveShadow = true;
        group.add(pedestal);

        const orbMat = new THREE.MeshStandardMaterial({
          color: 0x5b5f6e,
          emissive: 0x1b2350,
          emissiveIntensity: 0.2,
        });
        const coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 1), orbMat);
        coreMesh.position.y = 2.65;
        group.add(coreMesh);

        const light = new THREE.PointLight(0xffb347, 0, 26);
        light.position.y = 2.9;
        group.add(light);

        const safeRing = new THREE.Mesh(
          new THREE.RingGeometry(world.tuning.safe_radius - 0.14, world.tuning.safe_radius, 48),
          new THREE.MeshBasicMaterial({
            color: 0xffb347,
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
          coreMesh,
          light,
          safeRing,
          modelSlot,
          modelAttached: false,
        });
      }
    }
    this.attachLanternAssets();

    // Shades (#120A1A body, #7A3CFF rim/emissive)
    for (const s of world.shades) {
      if (!this.shadeVisuals.has(s.id)) {
        const group = new THREE.Group();
        const inkMaterial = new THREE.MeshStandardMaterial({
          color: 0x120a1a,
          emissive: 0x7a3cff,
          emissiveIntensity: 0.9,
          roughness: 0.35,
        });
        const fallbackMesh = new THREE.Mesh(this.shadowGeo, inkMaterial);
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

    // Drifters (Gió Lạc #8FA3B8 flowing ribbon)
    const activeDrifterIds = new Set(world.drifters.map((d) => d.id));
    for (const [id, vis] of this.drifterVisuals.entries()) {
      if (!activeDrifterIds.has(id)) {
        this.scene.remove(vis.group);
        this.drifterVisuals.delete(id);
      }
    }
    for (const d of world.drifters) {
      if (!this.drifterVisuals.has(d.id)) {
        const group = new THREE.Group();
        const ribbonMat = new THREE.MeshStandardMaterial({
          color: 0x8fa3b8,
          emissive: 0x8fa3b8,
          emissiveIntensity: 0.45,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
        });
        const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.14, 8, 24), ribbonMat);
        ribbon.rotation.x = Math.PI / 3;
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.6, 8), ribbonMat);
        tail.rotation.x = Math.PI / 2;
        tail.position.z = -0.8;
        group.add(ribbon, tail);
        this.scene.add(group);
        this.drifterVisuals.set(d.id, { group, ribbonMat });
      }
    }

    // Wind Charms (#C8102E red talisman, #F2C14E gold trim)
    for (const c of world.charms) {
      if (!this.charmVisuals.has(c.id)) {
        const group = new THREE.Group();
        group.position.set(c.pos[0], c.pos[1] + 1.0, c.pos[2]);
        const card = new THREE.Mesh(
          new THREE.BoxGeometry(0.45, 0.72, 0.06),
          new THREE.MeshStandardMaterial({
            color: 0xc8102e,
            emissive: 0xc8102e,
            emissiveIntensity: 0.5,
          }),
        );
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(0.52, 0.79, 0.04),
          new THREE.MeshStandardMaterial({ color: 0xf2c14e, emissive: 0xf2c14e, emissiveIntensity: 0.4 }),
        );
        group.add(frame, card);
        this.scene.add(group);
        this.charmVisuals.set(c.id, { group });
      }
    }
  }

  private setPlayerAnimation(target?: THREE.AnimationAction): void {
    if (!target || this.activePlayerAction === target) return;
    if (this.activePlayerAction) {
      this.activePlayerAction.fadeOut(0.15);
    }
    target.reset().fadeIn(0.15).play();
    this.activePlayerAction = target;
  }

  projectToScreen(pos: Vec3Tuple): ScreenProjection {
    const v = new THREE.Vector3(pos[0], pos[1] + 2.2, pos[2]);
    v.project(this.camera);
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const x = (v.x * 0.5 + 0.5) * width;
    const y = (-v.y * 0.5 + 0.5) * height;
    const onScreen = v.z <= 1 && v.x >= -0.95 && v.x <= 0.95 && v.y >= -0.95 && v.y <= 0.95;
    if (v.z > 1) {
      return { x: width - x, y: height - y, onScreen: false };
    }
    return { x, y, onScreen };
  }

  render(world: WorldState, camYawDeg: number): void {
    if (world.night !== this.currentNight) {
      this.clearAllEntityVisuals();
      this.buildTerrainForNight(world.night);
    }

    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.syncEntities(world);

    const timeSec = world.tick / 60;
    const curPos = new THREE.Vector3(world.player.pos[0], world.player.pos[1], world.player.pos[2]);
    const movedDist = Math.hypot(curPos.x - this.prevPlayerPos.x, curPos.z - this.prevPlayerPos.z);
    this.prevPlayerPos.copy(curPos);

    this.playerGroup.position.copy(curPos);
    this.playerGroup.rotation.y = world.player.yaw_rad;
    this.playerGroup.visible = world.player.fall_wait_ticks === 0;

    if (this.playerMixer && world.state === 'playing') {
      if (!world.player.grounded) {
        this.setPlayerAnimation(this.playerActions.jump ?? this.playerActions.run);
      } else if (movedDist > 0.015) {
        this.setPlayerAnimation(this.playerActions.run);
      } else {
        this.setPlayerAnimation(this.playerActions.idle);
      }
      this.playerMixer.update(dt);
    }

    const ticksSincePulse = world.sim_tick - world.last_pulse_tick;
    const pulseMat = this.pulseWave.material as THREE.MeshBasicMaterial;
    if (ticksSincePulse >= 0 && ticksSincePulse < 24) {
      const t = ticksSincePulse / 24;
      const scale = 1 + t * world.tuning.pulse_radius * 1.4;
      this.pulseWave.scale.set(scale, scale, 1);
      pulseMat.opacity = (1 - t) * 0.85;
    } else {
      pulseMat.opacity = 0;
    }

    for (const m of world.motes) {
      const vis = this.moteVisuals.get(m.id);
      if (vis) {
        vis.group.position.set(m.pos[0], m.pos[1], m.pos[2]);
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
          vis.orbMat.color.setHex(0xffe9b0);
          vis.orbMat.emissive.setHex(0xffb347);
          vis.orbMat.emissiveIntensity = 2.0;
          vis.light.intensity = 10.0;
          ringMat.opacity = 0.45;
        } else {
          vis.orbMat.color.setHex(0x5b5f6e);
          vis.orbMat.emissive.setHex(0xffb347);
          vis.orbMat.emissiveIntensity =
            0.15 + (l.deposited / Math.max(1, world.tuning.lantern_cost)) * 0.8;
          vis.light.intensity = 0.5 + l.deposited * 0.8;
          ringMat.opacity = 0;
        }
      }
    }

    for (const s of world.shades) {
      const vis = this.shadeVisuals.get(s.id);
      if (vis) {
        vis.group.position.set(s.pos[0], s.pos[1], s.pos[2]);
        if (s.state === 'stunned') {
          vis.group.scale.setScalar(0.75);
          vis.inkMaterial.color.setHex(0x3a3450);
          vis.inkMaterial.emissive.setHex(0x3a3450);
          vis.inkMaterial.emissiveIntensity = 0.45;
          if (vis.idleAction && vis.runAction && vis.currentClip !== 'idle') {
            vis.runAction.stop();
            vis.idleAction.play();
            vis.currentClip = 'idle';
          }
        } else {
          vis.group.scale.setScalar(s.state === 'spawning' ? 0.5 : 1.0);
          vis.inkMaterial.color.setHex(0x120a1a);
          vis.inkMaterial.emissive.setHex(0x7a3cff);
          vis.inkMaterial.emissiveIntensity = 0.95;
          const dx = world.player.pos[0] - s.pos[0];
          const dz = world.player.pos[2] - s.pos[2];
          if (Math.hypot(dx, dz) > 0.05) {
            vis.group.rotation.y = Math.atan2(dx, dz);
          }
          if (vis.runAction && vis.idleAction && world.state === 'playing' && vis.currentClip !== 'run') {
            vis.idleAction.stop();
            vis.runAction.play();
            vis.currentClip = 'run';
          }
        }
        if (vis.mixer && world.state === 'playing') {
          vis.mixer.update(dt);
        }
      }
    }

    for (const d of world.drifters) {
      const vis = this.drifterVisuals.get(d.id);
      if (vis) {
        vis.group.position.set(d.pos[0], d.pos[1] + 1.2 + Math.sin(timeSec * 5 + d.pos[0]) * 0.25, d.pos[2]);
        vis.group.rotation.y = timeSec * 3.0;
      }
    }

    for (const c of world.charms) {
      const vis = this.charmVisuals.get(c.id);
      if (vis) {
        vis.group.visible = c.available;
        vis.group.position.set(c.pos[0], c.pos[1] + 1.1 + Math.sin(timeSec * 3) * 0.18, c.pos[2]);
        vis.group.rotation.y = timeSec * 1.8;
      }
    }

    const ratio = world.lanterns.length > 0 ? litCount / world.lanterns.length : 0;
    this.effects.update(timeSec, ratio, world.wind);

    // Environmental light formula: 0.15 + 0.55 * (lit / total)
    this.ambientLight.intensity = 0.15 + 0.55 * ratio;
    const bg = new THREE.Color(0x0e1430).lerp(new THREE.Color(0x1f2855), ratio);
    this.scene.background = bg;
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.setHex(0x1b2350);
    fog.density = 0.02 - ratio * 0.008;

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
