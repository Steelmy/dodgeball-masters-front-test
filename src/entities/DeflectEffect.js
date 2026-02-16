import * as THREE from 'three';
import { DEFLECTION, PLAYER, COLORS } from '../utils/Constants.js';

/**
 * DeflectEffect
 * Animated sonic rings that appear when a successful deflect occurs
 */

const RING_COUNT = 4;           // Number of rings in the wave
const RING_SPAWN_INTERVAL = 0.035; // Seconds between each ring spawn
const RING_SPEED = 30;          // Units per second
const RING_INITIAL_RADIUS = 0.4;
const RING_FINAL_RADIUS = 2.0;
const RING_THICKNESS = 0.03;
const RING_OPACITY = 0.5;

export class DeflectEffect {
  constructor(position, direction, teamId) {
    this.group = new THREE.Group();
    this.group.position.copy(position);

    // Store direction for ring movement
    this.direction = direction.clone().normalize();

    // Rotate group to face the direction
    const targetPoint = position.clone().add(this.direction);
    this.group.lookAt(targetPoint);

    // Team color
    this.color = teamId === 'player' ? COLORS.TEAM_PLAYER : COLORS.TEAM_BOT;

    // Ring state
    this.rings = [];
    this.ringSpawnTimer = 0;
    this.ringsSpawned = 0;
    this.elapsed = 0;
    this.done = false;

    // Spawn first ring immediately
    this.spawnRing();
  }

  spawnRing() {
    // Create ring geometry (torus) with unit radius - will be scaled based on cone angle
    const geometry = new THREE.TorusGeometry(
      1, // Unit radius, scaled dynamically
      RING_THICKNESS,
      8,
      32
    );

    // Glowy material
    const material = new THREE.MeshBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: RING_OPACITY,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const ring = new THREE.Mesh(geometry, material);

    // No rotation needed - torus hole is already along Z axis (propagation direction)
    ring.position.set(0, 0, 0);

    this.group.add(ring);

    this.rings.push({
      mesh: ring,
      material: material,
      distance: 0,
      age: 0,
      scale: 1,
    });

    this.ringsSpawned++;
  }

  update(deltaTime) {
    if (this.done) return;

    this.elapsed += deltaTime;

    // Spawn new rings at intervals
    if (this.ringsSpawned < RING_COUNT) {
      this.ringSpawnTimer += deltaTime;
      if (this.ringSpawnTimer >= RING_SPAWN_INTERVAL) {
        this.ringSpawnTimer = 0;
        this.spawnRing();
      }
    }

    // Update all rings
    let allDone = true;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      ring.age += deltaTime;
      ring.distance += RING_SPEED * deltaTime;

      // Move ring forward (in local Z direction)
      ring.mesh.position.z = ring.distance;

      // Scale ring from initial to final radius over the travel distance
      const progress = ring.distance / DEFLECTION.RANGE;
      const radius = THREE.MathUtils.lerp(RING_INITIAL_RADIUS, RING_FINAL_RADIUS, progress);
      ring.mesh.scale.setScalar(radius);

      // Fade out as it approaches max range
      const fadeStart = 0.5; // Start fading at 50% of range
      if (progress > fadeStart) {
        const fadeProgress = (progress - fadeStart) / (1 - fadeStart);
        ring.material.opacity = RING_OPACITY * (1 - fadeProgress);
      }

      // Remove ring when it reaches max range
      if (ring.distance >= DEFLECTION.RANGE) {
        this.group.remove(ring.mesh);
        ring.mesh.geometry.dispose();
        ring.material.dispose();
        this.rings.splice(i, 1);
      } else {
        allDone = false;
      }
    }

    // Check if effect is complete
    if (this.rings.length === 0 && this.ringsSpawned >= RING_COUNT) {
      this.done = true;
    }
  }

  getMesh() {
    return this.group;
  }

  isDone() {
    return this.done;
  }

  dispose() {
    for (const ring of this.rings) {
      ring.mesh.geometry.dispose();
      ring.material.dispose();
    }
    this.rings = [];
  }
}
