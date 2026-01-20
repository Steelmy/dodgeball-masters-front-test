import * as THREE from 'three';
import { Entity } from './Entity.js';
import { MISSILE, COLORS } from '../utils/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * Missile
 * Tracking projectile that targets players
 */

export class Missile extends Entity {
  constructor() {
    super();

    // Movement
    this.speed = MISSILE.BASE_SPEED;
    this.turnRate = MISSILE.TURN_RATE;
    this.velocity = new THREE.Vector3(0, 0, 1);

    // Damage
    this.damage = MISSILE.BASE_DAMAGE;

    // Target
    this.target = null;
    this.targetPosition = new THREE.Vector3();

    // State
    this.deflectionCount = 0;
    this.direction = new THREE.Vector3(0, 0, 1); // For visual orientation
    this.teamId = null;
    this.previousPosition = new THREE.Vector3();

    // Visual
    this.trailParticles = [];

    this.init();
  }

  init() {
    this.createMesh();
    this.createTrail();
    this.previousPosition.copy(this.position);
  }

  createMesh() {
    const group = new THREE.Group();

    // Main missile body (elongated sphere)
    const bodyGeometry = new THREE.SphereGeometry(MISSILE.RADIUS, 16, 16);
    bodyGeometry.scale(1, 1, 1.5);

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.MISSILE,
      emissive: COLORS.MISSILE,
      emissiveIntensity: 0.5,
      roughness: 0.2,
      metalness: 0.8,
    });

    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    group.add(body);

    // Glow effect
    const glowGeometry = new THREE.SphereGeometry(MISSILE.RADIUS * 1.5, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.MISSILE,
      transparent: true,
      opacity: 0.3,
    });

    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    group.add(glow);

    // Point light for dynamic lighting
    const light = new THREE.PointLight(COLORS.MISSILE, 2, 10);
    group.add(light);

    this.mesh = group;
    this.mesh.position.copy(this.position);
  }

  createTrail() {
    // Simple trail using line
    const trailGeometry = new THREE.BufferGeometry();
    const trailMaterial = new THREE.LineBasicMaterial({
      color: COLORS.MISSILE_TRAIL,
      transparent: true,
      opacity: 0.6,
    });

    // Initialize with empty positions
    const positions = new Float32Array(30 * 3); // 30 points
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.trail = new THREE.Line(trailGeometry, trailMaterial);
    this.trailPositions = [];
    this.maxTrailLength = 30;
  }

  update(deltaTime) {
    if (!this.isActive || !this.target) return;

    // Store previous position for collision detection
    this.previousPosition.copy(this.position);

    // Update target position
    if (this.target.getPosition) {
      this.targetPosition.copy(this.target.getPosition());
      // Aim at center mass
      this.targetPosition.y = this.target.position.y + 0.9;
    }

    const toTarget = new THREE.Vector3().subVectors(this.targetPosition, this.position);
    const distanceToTarget = toTarget.length();
    toTarget.normalize();

    const targetVelocity = toTarget.clone().multiplyScalar(this.speed);

    const tickRate = 66;
    const frameTurnRate = 1 - Math.pow(1 - this.turnRate, deltaTime * tickRate);

    this.velocity.lerp(targetVelocity, frameTurnRate);

    // Update direction for visual orientation
    this.direction.copy(this.velocity).normalize();

    // Move missile using velocity
    this.position.add(this.velocity.clone().multiplyScalar(deltaTime));

    // Rotate mesh to face direction of travel
    if (this.mesh) {
      this.mesh.lookAt(this.position.clone().add(this.direction));
    }

    // Update trail
    this.updateTrail();

    super.update(deltaTime);

    return distanceToTarget;
  }

  updateTrail() {
    // Add current position to trail
    this.trailPositions.unshift(this.position.clone());

    // Limit trail length
    if (this.trailPositions.length > this.maxTrailLength) {
      this.trailPositions.pop();
    }

    // Update trail geometry
    const positions = this.trail.geometry.attributes.position.array;
    for (let i = 0; i < this.maxTrailLength; i++) {
      if (i < this.trailPositions.length) {
        positions[i * 3] = this.trailPositions[i].x;
        positions[i * 3 + 1] = this.trailPositions[i].y;
        positions[i * 3 + 2] = this.trailPositions[i].z;
      }
    }
    this.trail.geometry.attributes.position.needsUpdate = true;
  }

  /**
   * Set missile target
   */
  setTarget(target) {
    this.target = target;
    if (target && target.getPosition) {
      this.targetPosition.copy(target.getPosition());
    }
  }

  /**
   * Handle deflection
   */
  deflect(newTarget) {
    this.deflectionCount++;

    // Additive increments based on deflection count
    this.speed = MISSILE.BASE_SPEED + (MISSILE.SPEED_INCREMENT * this.deflectionCount);
    if (MISSILE.MAX_SPEED > 0) {
      this.speed = Math.min(this.speed, MISSILE.MAX_SPEED);
    }

    // Turn rate: base + (increment * deflections)
    this.turnRate = Math.min(
      MISSILE.TURN_RATE + (MISSILE.TURN_RATE_INCREMENT * this.deflectionCount),
      MISSILE.MAX_TURN_RATE
    );

    // Damage: base + (increment * deflections)
    this.damage = MISSILE.BASE_DAMAGE + (MISSILE.DAMAGE_INCREMENT * this.deflectionCount);

    // Set new target
    this.setTarget(newTarget);

    // Reverse velocity direction (the inertia will carry it back then redirect)
    this.velocity.negate();

    // Emit event
    this.emit('deflect', {
      deflectionCount: this.deflectionCount,
      speed: this.speed,
      damage: this.damage,
      newTarget,
    });
  }

  /**
   * Check collision with entity
   */
  checkCollision(entity) {
    if (!entity.isAlive) return false;

    const distance = MathUtils.distance(this.position, entity.position);
    const collisionDistance = MISSILE.RADIUS + (entity.radius || 0.5);

    return distance < collisionDistance;
  }

  /**
   * Reset missile for new round
   */
  reset() {
    this.speed = MISSILE.BASE_SPEED;
    this.turnRate = MISSILE.TURN_RATE;
    this.damage = MISSILE.BASE_DAMAGE;
    this.deflectionCount = 0;
    this.target = null;
    this.velocity.set(0, 0, 1);
    this.direction.set(0, 0, 1);
    this.trailPositions = [];

    // Reset to spawn position
    this.setPosition(0, MISSILE.SPAWN_HEIGHT, 0);
    this.previousPosition.copy(this.position);

    if (this.mesh) {
      this.mesh.visible = true;
    }
  }

  /**
   * Set missile team
   */
  setTeam(teamId) {
    this.teamId = teamId;

    const color = teamId === 'player' ? COLORS.TEAM_PLAYER : COLORS.TEAM_BOT;

    // Update mesh color
    if (this.mesh) {
      // Body (child 0)
      if (this.mesh.children[0] && this.mesh.children[0].material) {
        this.mesh.children[0].material.color.setHex(color);
        this.mesh.children[0].material.emissive.setHex(color);
      }

      // Glow (child 1)
      if (this.mesh.children[1] && this.mesh.children[1].material) {
        this.mesh.children[1].material.color.setHex(color);
      }

      // Light (child 2)
      if (this.mesh.children[2]) {
        this.mesh.children[2].color.setHex(color);
      }
    }

    // Update trail color
    if (this.trail && this.trail.material) {
      this.trail.material.color.setHex(color);
    }
  }

  /**
   * Spawn missile at center of arena
   */
  spawn(initialTarget, teamId) {
    this.reset();
    this.setTarget(initialTarget);
    this.setTeam(teamId);
    this.isActive = true;

    // Initial velocity toward target
    if (initialTarget) {
      const dir = MathUtils.directionTo(this.position, initialTarget.getPosition());
      this.velocity.copy(dir).multiplyScalar(this.speed);
      this.direction.copy(dir);
    }
  }

  /**
   * Hide missile (after hit)
   */
  hide() {
    this.isActive = false;
    if (this.mesh) {
      this.mesh.visible = false;
    }
  }

  /**
   * Get current damage value
   */
  getDamage() {
    return this.damage;
  }

  /**
   * Get trail mesh for adding to scene
   */
  getTrail() {
    return this.trail;
  }

  dispose() {
    if (this.trail) {
      this.trail.geometry.dispose();
      this.trail.material.dispose();
    }
    super.dispose();
  }
}
