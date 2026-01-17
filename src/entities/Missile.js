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
    this.baseSpeed = MISSILE.BASE_SPEED;
    this.trackingStrength = MISSILE.TRACKING_STRENGTH;

    // Damage
    this.damage = MISSILE.BASE_DAMAGE;
    this.baseDamage = MISSILE.BASE_DAMAGE;

    // Target
    this.target = null;
    this.targetPosition = new THREE.Vector3();

    // State
    this.deflectionCount = 0;
    this.direction = new THREE.Vector3(0, 0, 1);
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

    // Calculate direction to target
    const toTarget = new THREE.Vector3().subVectors(this.targetPosition, this.position);
    const distanceToTarget = toTarget.length();
    toTarget.normalize();

    // Smooth tracking - missile curves toward target
    // Higher tracking strength = more aggressive tracking
    const trackingFactor = Math.min(1, this.trackingStrength * deltaTime);
    this.direction.lerp(toTarget, trackingFactor).normalize();

    // Move missile
    const movement = this.direction.clone().multiplyScalar(this.speed * deltaTime);
    this.position.add(movement);

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

    // Increase speed by 30%
    this.speed *= MISSILE.SPEED_MULTIPLIER;

    // Increase tracking strength (more aggressive after deflections)
    this.trackingStrength = MathUtils.clamp(
      this.trackingStrength * 1.2,
      MISSILE.MIN_TRACKING_STRENGTH,
      MISSILE.MAX_TRACKING_STRENGTH
    );

    // Calculate new damage
    this.damage = this.baseDamage * (this.speed / this.baseSpeed);

    // Set new target
    this.setTarget(newTarget);

    // Reverse direction briefly (visual feedback)
    this.direction.negate();

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
    this.damage = MISSILE.BASE_DAMAGE;
    this.trackingStrength = MISSILE.TRACKING_STRENGTH;
    this.deflectionCount = 0;
    this.target = null;
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

    // Initial direction toward target
    if (initialTarget) {
      this.direction = MathUtils.directionTo(this.position, initialTarget.getPosition());
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
