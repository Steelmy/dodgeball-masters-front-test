import * as THREE from 'three';
import { Entity } from './Entity.js';
import { PLAYER, COLORS, DEFLECTION, TEAMS, BOT } from '../utils/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';
import { AssetManager } from '../core/AssetManager.js';

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
    this.weaponMesh = null;

    this.init();
  }

  init() {
    this.createMesh();
    this.loadWeapon();
  }

  loadWeapon() {
    // Use preloaded model from AssetManager
    const weapon = AssetManager.getModelClone('weapon');
    if (!weapon) return;

    // Scale the weapon (model is very small)
    weapon.scale.set(2, 2, 2);

    // Position weapon at right hand position
    weapon.position.set(0.35, PLAYER.HEIGHT * 0.45, -0.25);

    // Rotate weapon to point forward
    weapon.rotation.set(0, Math.PI, 0);

    // Enable shadows
    weapon.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    this.weaponMesh = weapon;
    this.mesh.add(weapon);
  }

  createMesh() {
    const group = new THREE.Group();

    // Body cylinder
    const bodyHeight = PLAYER.HEIGHT - PLAYER.RADIUS * 2;
    const bodyGeometry = new THREE.CylinderGeometry(
      PLAYER.RADIUS,
      PLAYER.RADIUS,
      bodyHeight,
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

    // Bottom sphere
    const bottomGeometry = new THREE.SphereGeometry(PLAYER.RADIUS, 16, 16);
    const bottom = new THREE.Mesh(bottomGeometry, bodyMaterial);
    bottom.position.y = PLAYER.RADIUS;
    bottom.castShadow = true;
    group.add(bottom);

    // Head Group (for rotation)
    this.headGroup = new THREE.Group();
    const headCenterY = PLAYER.HEIGHT - PLAYER.RADIUS * 0.8;
    this.headGroup.position.y = headCenterY;

    // Head sphere
    const headGeometry = new THREE.SphereGeometry(PLAYER.RADIUS * 0.8, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.BOT,
      roughness: 0.3,
      metalness: 0.5,
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.castShadow = true;
    this.headGroup.add(head);

    // Eyes
    const eyeGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const eyeY = 0.3 * PLAYER.RADIUS;
    const eyeZ = PLAYER.RADIUS * 0.6;

    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.2, eyeY, eyeZ);
    this.headGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.2, eyeY, eyeZ);
    this.headGroup.add(rightEye);

    // Pupils
    const pupilGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const pupilMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const pupilZ = PLAYER.RADIUS * 0.7;

    const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    leftPupil.position.set(-0.2, eyeY, pupilZ);
    this.headGroup.add(leftPupil);

    const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    rightPupil.position.set(0.2, eyeY, pupilZ);
    this.headGroup.add(rightPupil);

    group.add(this.headGroup);

    this.mesh = group;
    this.mesh.position.copy(this.position);
  }



  update(deltaTime, missilePosition = null) {
    if (!this.isActive || !this.isAlive) return;

    // Bot always rotates to face the missile
    if (missilePosition) {
      this.facePosition(missilePosition);
    }

    super.update(deltaTime);
  }

  /**
   * Rotate to face a position
   */
  facePosition(position) {
    const eyePos = this.position.clone();
    eyePos.y = PLAYER.HEIGHT * 0.75;

    // 3D direction
    const direction = MathUtils.directionTo(eyePos, position);
    this.facingDirection.copy(direction);

    // Yaw (Body follows target horizontally)
    this.mesh.lookAt(position.x, this.position.y, position.z);
    this.rotation.copy(this.mesh.rotation); // Sync with Entity state ensures super.update doesn't reset it

    // Pitch (for head tracking)
    const pitch = Math.asin(direction.y);
    if (this.headGroup) {
      this.headGroup.rotation.x = -pitch;
    }
  }

  /**
   * Check if bot should deflect the missile
   * Bot has perfect deflection - always succeeds when missile is in range
   */
  tryDeflect(missile) {
    if (!this.isAlive) return false;

    // Can only deflect enemy missiles
    if (missile.teamId === this.team) return false;

    const missilePosition = missile.getPosition();

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
          this.rotation.y = spawnData.rotation;
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
