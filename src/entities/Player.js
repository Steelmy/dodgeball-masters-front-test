import * as THREE from 'three';
import { Entity } from './Entity.js';
import { PLAYER, COLORS, DEFLECTION, TEAMS } from '../utils/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * Player
 * Controllable player character with jump ability
 */

export class Player extends Entity {
  constructor(inputManager, cameraController = null) {
    super();

    this.inputManager = inputManager;
    this.cameraController = cameraController;
    this.team = TEAMS.PLAYER;

    // Stats
    this.health = PLAYER.MAX_HEALTH;
    this.maxHealth = PLAYER.MAX_HEALTH;
    this.moveSpeed = PLAYER.MOVE_SPEED;

    // Jump physics
    this.velocityY = 0;
    this.isGrounded = true;
    this.jumpForce = PLAYER.JUMP_FORCE;
    this.gravity = PLAYER.GRAVITY;
    this.canJump = true;

    // Deflection
    this.canDeflect = true;
    this.deflectCooldown = 0;
    this.deflectRange = DEFLECTION.RANGE;
    this.deflectConeAngle = DEFLECTION.CONE_ANGLE;

    // State
    this.isAlive = true;
    this.isTargeted = false;
    this.facingDirection = new THREE.Vector3(0, 0, -1);
    this.rotationY = 0; // Player rotation controlled by mouse

    // Visual elements
    this.deflectZoneMesh = null;
    this.targetIndicator = null;

    this.init();
  }

  init() {
    this.createMesh();
    this.createDeflectZone();
    this.createTargetIndicator();
  }

  createMesh() {
    // Player body (capsule-like shape)
    const group = new THREE.Group();

    // Body cylinder
    const bodyGeometry = new THREE.CylinderGeometry(
      PLAYER.RADIUS,
      PLAYER.RADIUS,
      PLAYER.HEIGHT - PLAYER.RADIUS * 2,
      16
    );
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.PLAYER,
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
      color: COLORS.PLAYER,
      roughness: 0.3,
      metalness: 0.5,
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = PLAYER.HEIGHT - PLAYER.RADIUS * 0.5;
    head.castShadow = true;
    group.add(head);

    // Direction indicator (small cone in front)
    const dirGeometry = new THREE.ConeGeometry(0.15, 0.3, 8);
    const dirMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.3,
    });
    const dirIndicator = new THREE.Mesh(dirGeometry, dirMaterial);
    dirIndicator.rotation.x = Math.PI / 2;
    dirIndicator.position.set(0, PLAYER.HEIGHT / 2, -PLAYER.RADIUS - 0.2);
    group.add(dirIndicator);

    this.mesh = group;
    this.mesh.position.copy(this.position);
  }

  createDeflectZone() {
    // Visual cone showing deflect range
    const geometry = new THREE.ConeGeometry(
      Math.tan(this.deflectConeAngle) * this.deflectRange,
      this.deflectRange,
      16,
      1,
      true
    );
    const material = new THREE.MeshBasicMaterial({
      color: COLORS.DEFLECT_ZONE,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.deflectZoneMesh = new THREE.Mesh(geometry, material);
    this.deflectZoneMesh.rotation.x = Math.PI / 2;
    this.deflectZoneMesh.position.set(0, PLAYER.HEIGHT / 2, -this.deflectRange / 2);
    this.deflectZoneMesh.visible = false;

    this.mesh.add(this.deflectZoneMesh);
  }

  createTargetIndicator() {
    // Ring above player when targeted
    const geometry = new THREE.RingGeometry(0.8, 1, 32);
    const material = new THREE.MeshBasicMaterial({
      color: COLORS.TARGET_INDICATOR,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });

    this.targetIndicator = new THREE.Mesh(geometry, material);
    this.targetIndicator.rotation.x = -Math.PI / 2;
    this.targetIndicator.position.y = PLAYER.HEIGHT + 0.5;
    this.targetIndicator.visible = false;

    this.mesh.add(this.targetIndicator);
  }

  update(deltaTime, arena) {
    if (!this.isActive || !this.isAlive) return;

    // Handle movement input
    this.handleMovement(deltaTime, arena);

    // Handle jump
    this.handleJump(deltaTime);

    // Update deflect cooldown
    if (!this.canDeflect) {
      this.deflectCooldown -= deltaTime * 1000;
      if (this.deflectCooldown <= 0) {
        this.canDeflect = true;
        this.deflectCooldown = 0;
      }
    }

    // Show deflect zone when action key is held (right click)
    this.deflectZoneMesh.visible = this.inputManager.isDeflectPressed();

    // Animate target indicator
    if (this.targetIndicator.visible) {
      this.targetIndicator.rotation.z += deltaTime * 2;
    }

    // Update mesh position
    if (this.mesh) {
      this.mesh.position.copy(this.position);
    }
  }

  handleMovement(deltaTime, arena) {
    const input = this.inputManager.getMovementInput();

    if (input.x !== 0 || input.z !== 0) {
      // Get camera directions for movement
      let forward, right;

      if (this.cameraController) {
        forward = this.cameraController.getForwardDirection();
        right = this.cameraController.getRightDirection();
      } else {
        // Fallback if no camera
        forward = new THREE.Vector3(0, 0, -1);
        right = new THREE.Vector3(1, 0, 0);
      }

      // Calculate movement direction relative to camera
      const moveDirection = new THREE.Vector3();
      moveDirection.addScaledVector(forward, -input.z); // W/S
      moveDirection.addScaledVector(right, input.x);    // A/D

      if (moveDirection.length() > 0) {
        moveDirection.normalize();

        // Apply movement
        this.position.x += moveDirection.x * this.moveSpeed * deltaTime;
        this.position.z += moveDirection.z * this.moveSpeed * deltaTime;

        // Rotate player to face movement direction
        this.rotationY = Math.atan2(moveDirection.x, moveDirection.z);
        this.mesh.rotation.y = this.rotationY;

        // Update facing direction
        this.facingDirection.copy(moveDirection);
      }

      // Constrain to circular arena bounds
      if (arena && arena.constrainToBounds) {
        arena.constrainToBounds(this.position, PLAYER.RADIUS);
      }
    }
  }

  /**
   * Set camera controller reference
   */
  setCameraController(cameraController) {
    this.cameraController = cameraController;
  }

  handleJump(deltaTime) {
    // Check for jump input
    if (this.inputManager.isJumpPressed() && this.isGrounded && this.canJump) {
      this.velocityY = this.jumpForce;
      this.isGrounded = false;
      this.canJump = false;
    }

    // Release jump lock when space is released
    if (!this.inputManager.isJumpPressed()) {
      this.canJump = true;
    }

    // Apply gravity
    if (!this.isGrounded) {
      this.velocityY -= this.gravity * deltaTime;
      this.position.y += this.velocityY * deltaTime;

      // Check ground collision
      if (this.position.y <= 0) {
        this.position.y = 0;
        this.velocityY = 0;
        this.isGrounded = true;
      }
    }
  }

  /**
   * Attempt to deflect the missile
   * Returns true if deflection conditions are met
   */
  tryDeflect(missilePosition) {
    if (!this.canDeflect || !this.isAlive) return false;

    // Check if missile is in deflect cone
    const inCone = MathUtils.isInCone(
      this.position,
      this.facingDirection,
      missilePosition,
      this.deflectConeAngle,
      this.deflectRange
    );

    if (inCone && this.inputManager.isDeflectPressed()) {
      this.canDeflect = false;
      this.deflectCooldown = DEFLECTION.COOLDOWN;
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
    this.emit('death', { player: this });

    // Visual feedback
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
    this.canDeflect = true;
    this.deflectCooldown = 0;
    this.isTargeted = false;
    this.targetIndicator.visible = false;
    this.velocityY = 0;
    this.isGrounded = true;
    this.position.y = 0;

    if (spawnData) {
      const pos = spawnData.position || spawnData;
      this.setPosition(pos.x, 0, pos.z);

      // Set rotation to face center
      if (spawnData.rotation !== undefined) {
        this.rotationY = spawnData.rotation;
        this.facingDirection.set(
          -Math.sin(this.rotationY),
          0,
          -Math.cos(this.rotationY)
        );
      } else {
        this.rotationY = 0;
        this.facingDirection.set(0, 0, -1);
      }
    } else {
      this.rotationY = 0;
      this.facingDirection.set(0, 0, -1);
    }

    if (this.mesh) {
      this.mesh.visible = true;
      this.mesh.rotation.y = this.rotationY;
    }
  }

  /**
   * Set targeted state
   */
  setTargeted(targeted) {
    this.isTargeted = targeted;
    this.targetIndicator.visible = targeted;
  }

  /**
   * Get forward direction
   */
  getForwardDirection() {
    return this.facingDirection.clone();
  }
}
