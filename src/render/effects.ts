import * as THREE from 'three';
import type { WindState } from '../core/types.js';

/**
 * Procedural atmospheric particle system (firefly embers + Night 3 wind leaves)
 * strictly isolated to the visual layer.
 */
export class IslandEffects {
  private readonly particles: THREE.Points;
  private readonly positions: Float32Array;
  private readonly leafParticles: THREE.Points;
  private readonly leafPositions: Float32Array;
  private readonly count: number;
  private readonly leafCount = 90;
  private readonly spriteTexture: THREE.Texture;

  constructor(scene: THREE.Scene, count = 200, radius = 42) {
    this.count = count;
    this.positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 * 7.3;
      const r = Math.sqrt((i + 0.5) / count) * radius;
      this.positions[i * 3] = Math.cos(angle) * r;
      this.positions[i * 3 + 1] = 0.5 + ((i * 19) % 100) * 0.05;
      this.positions[i * 3 + 2] = Math.sin(angle) * r;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    const texLoader = new THREE.TextureLoader();
    this.spriteTexture = texLoader.load('./assets/textures/spark1.png');

    const material = new THREE.PointsMaterial({
      color: 0xffe58a,
      size: 0.42,
      map: this.spriteTexture,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particles = new THREE.Points(geometry, material);
    scene.add(this.particles);

    // Night 3 wind leaves particle layer
    this.leafPositions = new Float32Array(this.leafCount * 3);
    for (let i = 0; i < this.leafCount; i++) {
      this.leafPositions[i * 3] = ((i * 37) % 80) - 40;
      this.leafPositions[i * 3 + 1] = 0.8 + ((i * 13) % 50) * 0.1;
      this.leafPositions[i * 3 + 2] = ((i * 53) % 80) - 40;
    }
    const leafGeo = new THREE.BufferGeometry();
    leafGeo.setAttribute('position', new THREE.BufferAttribute(this.leafPositions, 3));
    const leafMat = new THREE.PointsMaterial({
      color: 0x8fa3b8,
      size: 0.28,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.leafParticles = new THREE.Points(leafGeo, leafMat);
    scene.add(this.leafParticles);
  }

  update(time: number, litLanternRatio: number, wind: WindState): void {
    const posAttr = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < this.count; i++) {
      const baseY = 0.5 + ((i * 19) % 100) * 0.045;
      posAttr.setY(i, baseY + Math.sin(time * 1.4 + i) * 0.28);
    }
    posAttr.needsUpdate = true;

    const mat = this.particles.material as THREE.PointsMaterial;
    mat.opacity = 0.35 + litLanternRatio * 0.5;

    const leafMat = this.leafParticles.material as THREE.PointsMaterial;
    if (wind.warning || wind.active) {
      leafMat.opacity = wind.active ? 0.85 : 0.45;
      const rad = (wind.dir_deg * Math.PI) / 180;
      const speed = wind.active ? 0.38 : 0.18;
      const dx = Math.cos(rad) * speed;
      const dz = Math.sin(rad) * speed;
      const leafAttr = this.leafParticles.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < this.leafCount; i++) {
        let lx = leafAttr.getX(i) + dx;
        let lz = leafAttr.getZ(i) + dz;
        if (lx > 45) lx -= 90;
        if (lx < -45) lx += 90;
        if (lz > 45) lz -= 90;
        if (lz < -45) lz += 90;
        leafAttr.setX(i, lx);
        leafAttr.setZ(i, lz);
      }
      leafAttr.needsUpdate = true;
    } else {
      leafMat.opacity = 0;
    }
  }

  dispose(): void {
    this.particles.geometry.dispose();
    this.leafParticles.geometry.dispose();
    this.spriteTexture.dispose();
    (this.particles.material as THREE.Material).dispose();
    (this.leafParticles.material as THREE.Material).dispose();
  }
}
