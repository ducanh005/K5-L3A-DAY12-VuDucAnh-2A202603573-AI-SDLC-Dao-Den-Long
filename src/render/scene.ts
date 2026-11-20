import * as THREE from 'three';
import type { WorldState } from '../core/types.js';
import { IslandEffects } from './effects.js';

interface LanternVisual {
  group: THREE.Group;
  orbMat: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
}

/**
 * Three.js third-person renderer reading immutable snapshots of WorldState.
 */
export class GameScene {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly playerGroup: THREE.Group;
  private readonly playerLight: THREE.PointLight;
  private readonly fireflyMeshes = new Map<string, THREE.Mesh>();
  private readonly lanternVisuals = new Map<string, LanternVisual>();
  private readonly shadowMeshes = new Map<string, THREE.Mesh>();
  private readonly effects: IslandEffects;
  private readonly container: HTMLElement;

  constructor(container: HTMLElement, initialWorld: WorldState) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070a12);
    this.scene.fog = new THREE.FogExp2(0x070a12, 0.036);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 150);
    this.camera.position.set(0, 7.5, 10.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    const ambient = new THREE.AmbientLight(0x4b5c8a, 0.65);
    this.scene.add(ambient);

    const moonLight = new THREE.DirectionalLight(0x9fb8ff, 0.75);
    moonLight.position.set(12, 22, 10);
    moonLight.castShadow = true;
    this.scene.add(moonLight);

    // Island ground
    const groundGeo = new THREE.CylinderGeometry(initialWorld.mapRadius, initialWorld.mapRadius + 1.5, 1.2, 48);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x182232, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -0.6;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Mây (player) with small hand lantern
    this.playerGroup = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 0.7, 4, 12),
      new THREE.MeshStandardMaterial({ color: 0xe6eefc, roughness: 0.55 }),
    );
    body.position.y = 0.7;
    body.castShadow = true;
    this.playerGroup.add(body);

    const handLantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd57a }),
    );
    handLantern.position.set(0.4, 0.75, 0.25);
    this.playerGroup.add(handLantern);

    this.playerLight = new THREE.PointLight(0xffcb6b, 3.2, 11);
    this.playerLight.position.set(0.4, 0.9, 0.25);
    this.playerGroup.add(this.playerLight);
    this.scene.add(this.playerGroup);

    this.effects = new IslandEffects(this.scene, 180, initialWorld.mapRadius);
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
    const ffGeo = new THREE.SphereGeometry(0.22, 12, 12);
    const ffMat = new THREE.MeshBasicMaterial({ color: 0xffe478 });
    for (const ff of world.fireflies) {
      if (!this.fireflyMeshes.has(ff.id)) {
        const mesh = new THREE.Mesh(ffGeo, ffMat);
        this.scene.add(mesh);
        this.fireflyMeshes.set(ff.id, mesh);
      }
    }

    for (const l of world.lanterns) {
      if (!this.lanternVisuals.has(l.id)) {
        const group = new THREE.Group();
        group.position.set(l.pos.x, 0, l.pos.z);

        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.55, 2.2, 8),
          new THREE.MeshStandardMaterial({ color: 0x3b4459, roughness: 0.85 }),
        );
        pillar.position.y = 1.1;
        pillar.castShadow = true;
        group.add(pillar);

        const orbMat = new THREE.MeshStandardMaterial({
          color: 0x2a3142,
          emissive: 0x111520,
          emissiveIntensity: 0.2,
        });
        const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 1), orbMat);
        orb.position.y = 2.5;
        group.add(orb);

        const light = new THREE.PointLight(0xffb84d, 0, 16);
        light.position.y = 2.6;
        group.add(light);

        this.scene.add(group);
        this.lanternVisuals.set(l.id, { group, orbMat, light });
      }
    }

    const shadowGeo = new THREE.ConeGeometry(0.65, 1.8, 12);
    const shadowMat = new THREE.MeshStandardMaterial({
      color: 0x050508,
      emissive: 0x26082c,
      emissiveIntensity: 0.7,
      roughness: 0.4,
    });
    for (const s of world.shadows) {
      if (!this.shadowMeshes.has(s.id)) {
        const mesh = new THREE.Mesh(shadowGeo, shadowMat);
        mesh.position.y = 0.9;
        mesh.castShadow = true;
        this.scene.add(mesh);
        this.shadowMeshes.set(s.id, mesh);
      }
    }
  }

  render(world: WorldState): void {
    this.syncEntities(world);

    this.playerGroup.position.set(world.player.pos.x, world.player.pos.y, world.player.pos.z);
    this.playerGroup.rotation.y = world.player.yaw;

    for (const ff of world.fireflies) {
      const mesh = this.fireflyMeshes.get(ff.id);
      if (mesh) {
        mesh.visible = !ff.collected;
        mesh.position.set(ff.pos.x, ff.pos.y + Math.sin(world.time * 3 + ff.pos.x) * 0.15, ff.pos.z);
      }
    }

    let litCount = 0;
    for (const l of world.lanterns) {
      if (l.lit) litCount++;
      const vis = this.lanternVisuals.get(l.id);
      if (vis) {
        if (l.lit) {
          vis.orbMat.color.setHex(0xffe19c);
          vis.orbMat.emissive.setHex(0xffa733);
          vis.orbMat.emissiveIntensity = 1.6;
          vis.light.intensity = 6.5;
        } else {
          vis.orbMat.color.setHex(0x2a3142);
          vis.orbMat.emissive.setHex(0x111520);
          vis.orbMat.emissiveIntensity = 0.2;
          vis.light.intensity = 0;
        }
      }
    }

    for (const s of world.shadows) {
      const mesh = this.shadowMeshes.get(s.id);
      if (mesh) {
        mesh.position.set(s.pos.x, 0.9 + Math.sin(world.time * 4 + s.pos.z) * 0.1, s.pos.z);
        mesh.rotation.y = world.time * 2.5;
      }
    }

    const ratio = world.lanterns.length > 0 ? litCount / world.lanterns.length : 0;
    this.effects.update(world.time, ratio);
    (this.scene.fog as THREE.FogExp2).density = 0.036 - ratio * 0.014;

    const targetCamPos = new THREE.Vector3(
      world.player.pos.x,
      world.player.pos.y + 7.2,
      world.player.pos.z + 9.8,
    );
    this.camera.position.lerp(targetCamPos, 0.12);
    this.camera.lookAt(world.player.pos.x, world.player.pos.y + 0.8, world.player.pos.z);

    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    window.removeEventListener('resize', this.handleResize);
    this.effects.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
