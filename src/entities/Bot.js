import * as THREE from 'three';
import { Entity } from './Entity.js';
import { PLAYER, COLORS, DEFLECTION, TEAMS, BOT } from '../utils/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * Bot
 * AI-controlled opponent for training mode
 * - Stationary position
 * - Perfect deflection (never misses)
 */

export class Bot extends Entity {
  constructor() {
    super();

    this.team = TEAMS.BOT;

    // Stats (same as player)
    this.health = PLAYER.MAX_HEALTH;
    this.maxHealth = PLAYER.MAX_HEALTH;

    // Deflection
    this.deflectRange = BOT.DEFLECT_RANGE;
    this.deflectConeAngle = DEFLECTION.CONE_ANGLE;
    this.perfectDeflection = BOT.PERFECT_DEFLECTION;

    // State
    this.isAlive = true;
    this.isTargeted = false;
    this.facingDirection = new THREE.Vector3(0, 0, 1); // Facing toward player

    // Visual elements


    this.init();
  }

  init() {
    this.createMesh();

  }

  createMesh() {
    const group = new THREE.Group();

    // Body cylinder
    const bodyGeometry = new THREE.CylinderGeometry(
      PLAYER.RADIUS,
      PLAYER.RADIUS,
      PLAYER.HEIGHT - PLAYER.RADIUS * 2,
      16
    );
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.BOT,
      roughness: 0.4,
      metalness: 0.6,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = PLAYER.HEIGHT / 2;
    body.castShadow = true;
    group.add(body);

    // Head sphere
    const headGeometry = new THREE.SphereGeometry(PLAYER.RADIUS * 0.8, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.BOT,
      roughness: 0.3,
      metalness: 0.5,
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = PLAYER.HEIGHT - PLAYER.RADIUS * 0.5;
    head.castShadow = true;
    group.add(head);

    // Eyes (to show bot is facing player)
    const eyeGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.2, PLAYER.HEIGHT - PLAYER.RADIUS * 0.5, PLAYER.RADIUS * 0.6);
    group.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.2, PLAYER.HEIGHT - PLAYER.RADIUS * 0.5, PLAYER.RADIUS * 0.6);
    group.add(rightEye);

    // Pupil
    const pupilGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const pupilMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

    const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    leftPupil.position.set(-0.2, PLAYER.HEIGHT - PLAYER.RADIUS * 0.5, PLAYER.RADIUS * 0.7);
    group.add(leftPupil);

    const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    rightPupil.position.set(0.2, PLAYER.HEIGHT - PLAYER.RADIUS * 0.5, PLAYER.RADIUS * 0.7);
    group.add(rightPupil);

    this.mesh = group;
    this.mesh.position.copy(this.position);
  }



  update(deltaTime, missilePosition = null) {
    if (!this.isActive || !this.isAlive) return;

    // Bot is stationary but rotates to face the missile if targeted
    if (missilePosition && this.isTargeted) {
      this.facePosition(missilePosition);
    }



    super.update(deltaTime);
  }

  /**
   * Rotate to face a position
   */
  facePosition(position) {
    const direction = MathUtils.directionToXZ(this.position, position);
    this.facingDirection.copy(direction);
    this.mesh.rotation.y = Math.atan2(direction.x, direction.z);
  }

  /**
   * Check if bot should deflect the missile
   * Bot has perfect deflection - always succeeds when missile is in range
   */
  tryDeflect(missilePosition) {
    if (!this.isAlive) return false;

    // Calculate distance to missile
    const distance = MathUtils.distanceXZ(this.position, missilePosition);

    // Perfect deflection: if missile is within range, bot always deflects
    if (this.perfectDeflection && distance <= this.deflectRange) {
      // Face the missile
      this.facePosition(missilePosition);
      return true;
    }

    return false;
  }

  /**
   * Take damage
   */
  takeDamage(amount) {
    if (!this.isAlive) return;

    this.health -= amount;
    this.emit('damage', { amount, health: this.health });

    if (this.health <= 0) {
      this.health = 0;
      this.die();
    }
  }

  /**
   * Handle death
   */
  die() {
    this.isAlive = false;
    this.emit('death', { bot: this });

    if (this.mesh) {
      this.mesh.visible = false;
    }
  }

  /**
   * Reset for new round
   */
  reset(spawnData) {
    this.health = this.maxHealth;
    this.isAlive = true;
    this.isTargeted = false;
    this.isTargeted = false;

    if (spawnData) {
      const pos = spawnData.position || spawnData;
      this.setPosition(pos.x, 0, pos.z);

      // Set rotation to face center
      if (spawnData.rotation !== undefined) {
        this.facingDirection.set(
          -Math.sin(spawnData.rotation),
          0,
          -Math.cos(spawnData.rotation)
        );
        if (this.mesh) {
          this.mesh.rotation.y = spawnData.rotation;
        }
      }
    }

    if (this.mesh) {
      this.mesh.visible = true;
    }
  }

  /**
   * Set targeted state
   */
  setTargeted(targeted) {
    this.isTargeted = targeted;
  }

  /**
   * Get forward direction
   */
  getForwardDirection() {
    return this.facingDirection.clone();
  }
}
