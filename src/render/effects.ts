import * as THREE from 'three';

/**
 * Procedural atmospheric particle system (firefly embers & night mist)
 * strictly isolated to the visual layer so headless simulation stays untouched.
 */
export class IslandEffects {
  private readonly particles: THREE.Points;
  private readonly positions: Float32Array;
  private readonly count: number;

  constructor(scene: THREE.Scene, count = 220, radius = 40) {
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

    const material = new THREE.PointsMaterial({
      color: 0xffc966,
      size: 0.16,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particles = new THREE.Points(geometry, material);
    scene.add(this.particles);
  }

  update(time: number, litLanternRatio: number): void {
    const posAttr = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < this.count; i++) {
      const baseY = 0.5 + ((i * 19) % 100) * 0.045;
      posAttr.setY(i, baseY + Math.sin(time * 1.4 + i) * 0.28);
    }
    posAttr.needsUpdate = true;

    const mat = this.particles.material as THREE.PointsMaterial;
    mat.opacity = 0.3 + litLanternRatio * 0.5;
  }

  dispose(): void {
    this.particles.geometry.dispose();
    (this.particles.material as THREE.Material).dispose();
  }
}
