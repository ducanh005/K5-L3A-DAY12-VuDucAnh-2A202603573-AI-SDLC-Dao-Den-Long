import * as THREE from 'three';
import type { WorldState } from '../core/types.js';
import { IslandEffects } from './effects.js';

interface LanternVisual {
  group: THREE.Group;
  orbMat: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
  safeRing: THREE.Mesh;
}

/**
 * Three.js third-person renderer for Đảo Đèn Lồng (Night 1 – Đảo Bến).
 */
export class GameScene {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly ambientLight: THREE.AmbientLight;
  private readonly moonLight: THREE.DirectionalLight;
  private readonly playerGroup: THREE.Group;
  private readonly playerLight: THREE.PointLight;
  private readonly pulseWave: THREE.Mesh;
  private readonly moteMeshes = new Map<string, THREE.Mesh>();
  private readonly lanternVisuals = new Map<string, LanternVisual>();
  private readonly shadeMeshes = new Map<string, THREE.Mesh>();
  private readonly effects: IslandEffects;
  private readonly container: HTMLElement;

  constructor(container: HTMLElement, initialWorld: WorldState) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0714);
    this.scene.fog = new THREE.FogExp2(0x120a1e, 0.026);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(56, width / height, 0.1, 220);
    this.camera.position.set(0, 8.5, 11.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.ambientLight = new THREE.AmbientLight(0x52487a, 0.7);
    this.scene.add(this.ambientLight);

    this.moonLight = new THREE.DirectionalLight(0x9fb8ff, 0.65);
    this.moonLight.position.set(16, 28, 14);
    this.moonLight.castShadow = true;
    this.scene.add(this.moonLight);

    // Island ground (Đảo Bến, radius 40m)
    const groundGeo = new THREE.CylinderGeometry(40, 42, 1.6, 64);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1e2538, roughness: 0.92 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -0.8;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Sea of clouds ring around the island
    const seaGeo = new THREE.RingGeometry(41, 140, 64);
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

    // Character Mây: robe + conical hat (nón lá) + hanging warm lantern
    this.playerGroup = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.32, 0.65, 4, 12),
      new THREE.MeshStandardMaterial({ color: 0xefe9dc, roughness: 0.55 }),
    );
    body.position.y = 0.65;
    body.castShadow = true;
    this.playerGroup.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xfbe2c4, roughness: 0.6 }),
    );
    head.position.y = 1.32;
    head.castShadow = true;
    this.playerGroup.add(head);

    // Nón lá (conical leaf hat)
    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(0.58, 0.34, 18),
      new THREE.MeshStandardMaterial({ color: 0xd9b36c, roughness: 0.75 }),
    );
    hat.position.y = 1.56;
    hat.castShadow = true;
    this.playerGroup.add(hat);

    // Small lantern hanging from the brim of the nón lá
    const hatLantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xffb84d }),
    );
    hatLantern.position.set(0, 1.32, 0.52);
    this.playerGroup.add(hatLantern);

    this.playerLight = new THREE.PointLight(0xffb84d, 3.6, 13);
    this.playerLight.position.set(0, 1.32, 0.55);
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

    this.effects = new IslandEffects(this.scene, 220, 40);
    this.syncEntities(initialWorld);
    window.addEventListener('resize', this.handleResize);
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
    const moteMat = new THREE.MeshBasicMaterial({ color: 0xffcf5c });
    for (const m of world.motes) {
      if (!this.moteMeshes.has(m.id)) {
        const mesh = new THREE.Mesh(moteGeo, moteMat);
        this.scene.add(mesh);
        this.moteMeshes.set(m.id, mesh);
      }
    }

    for (const l of world.lanterns) {
      if (!this.lanternVisuals.has(l.id)) {
        const group = new THREE.Group();
        group.position.set(l.pos[0], l.pos[1], l.pos[2]);

        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.38, 0.6, 2.4, 8),
          new THREE.MeshStandardMaterial({ color: 0x3b4459, roughness: 0.85 }),
        );
        pillar.position.y = 1.2;
        pillar.castShadow = true;
        group.add(pillar);

        const orbMat = new THREE.MeshStandardMaterial({
          color: 0x2c243d,
          emissive: 0x160f24,
          emissiveIntensity: 0.25,
        });
        const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 1), orbMat);
        orb.position.y = 2.7;
        group.add(orb);

        const light = new THREE.PointLight(0xffa938, 0, 22);
        light.position.y = 2.8;
        group.add(light);

        const safeRing = new THREE.Mesh(
          new THREE.RingGeometry(world.tuning.safe_radius - 0.12, world.tuning.safe_radius, 48),
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
        this.lanternVisuals.set(l.id, { group, orbMat, light, safeRing });
      }
    }

    const shadowGeo = new THREE.ConeGeometry(0.65, 1.9, 12);
    for (const s of world.shades) {
      if (!this.shadeMeshes.has(s.id)) {
        const shadeMat = new THREE.MeshStandardMaterial({
          color: 0x09040f,
          emissive: 0x3b0b4f,
          emissiveIntensity: 0.9,
          roughness: 0.35,
        });
        const mesh = new THREE.Mesh(shadowGeo, shadeMat);
        mesh.position.y = 1.0;
        mesh.castShadow = true;
        this.scene.add(mesh);
        this.shadeMeshes.set(s.id, mesh);
      }
    }
  }

  render(world: WorldState, camYawDeg: number): void {
    this.syncEntities(world);

    const timeSec = world.tick / 60;
    this.playerGroup.position.set(world.player.pos[0], world.player.pos[1], world.player.pos[2]);
    this.playerGroup.rotation.y = world.player.yaw_rad;

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
      const mesh = this.moteMeshes.get(m.id);
      if (mesh) {
        mesh.visible = m.active;
        mesh.position.set(m.pos[0], 0.75 + Math.sin(timeSec * 3.2 + m.pos[0]) * 0.16, m.pos[2]);
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
          vis.orbMat.emissiveIntensity = 1.8;
          vis.light.intensity = 9.0;
          ringMat.opacity = 0.45;
        } else {
          vis.orbMat.color.setHex(0x2c243d);
          vis.orbMat.emissive.setHex(0xff9f2e);
          vis.orbMat.emissiveIntensity = 0.15 + (l.deposited / Math.max(1, world.tuning.lantern_cost)) * 0.6;
          vis.light.intensity = l.deposited * 1.1;
          ringMat.opacity = 0;
        }
      }
    }

    for (const s of world.shades) {
      const mesh = this.shadeMeshes.get(s.id);
      if (mesh) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (s.state === 'stunned') {
          mesh.scale.set(0.75, 0.75, 0.75);
          mat.emissive.setHex(0x6e5980);
          mat.emissiveIntensity = 0.4;
          mesh.position.set(s.pos[0], 0.8, s.pos[2]);
        } else {
          mesh.scale.set(1, 1, 1);
          mat.emissive.setHex(0x3b0b4f);
          mat.emissiveIntensity = 0.95;
          mesh.position.set(s.pos[0], 1.0 + Math.sin(timeSec * 4.5 + s.pos[2]) * 0.12, s.pos[2]);
          mesh.rotation.y = timeSec * 2.6;
        }
      }
    }

    const ratio = world.lanterns.length > 0 ? litCount / world.lanterns.length : 0;
    this.effects.update(timeSec, ratio);

    // Island brightens warmly as Great Lanterns are lit
    const bg = new THREE.Color(0x0b0714).lerp(new THREE.Color(0x241a2e), ratio);
    this.scene.background = bg;
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.copy(bg);
    fog.density = 0.028 - ratio * 0.015;
    this.ambientLight.intensity = 0.65 + ratio * 0.65;
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
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
