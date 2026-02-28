import * as THREE from "three";
import { Entity } from "./Entity.js";
import { PLAYER, COLORS, TEAMS } from "../utils/Constants.js";
import { AssetManager } from "../core/AssetManager.js";

/**
 * RemotePlayer
 * Represents a player connected via network
 * Controlled by server updates, not local input
 *
 * In the current architecture, all game logic (collision, damage, rounds)
 * runs independently on each client. RemotePlayer needs the same interface
 * as Player and Bot so that CollisionSystem and RoundManager can treat it
 * uniformly.
 */
export class RemotePlayer extends Entity {
  constructor(id, initialData) {
    super();

    this.id = id;
    this.team = (initialData && initialData.team) || TEAMS.BLUE;

    // Stats — must match Player interface for CollisionSystem/RoundManager
    this.health = PLAYER.MAX_HEALTH;
    this.maxHealth = PLAYER.MAX_HEALTH;
    this.isAlive = true;
    this.isTargeted = false;

    // Visuals
    this.mesh = null;
    this.headGroup = null;
    this.weaponMesh = null;

    // Interpolation target
    this.targetPosition = new THREE.Vector3();
    this.targetRotation = 0;

    // Initialize with data
    if (initialData) {
      this.position.set(
        initialData.x || 0,
        initialData.y || 0,
        initialData.z || 0,
      );
      this.targetPosition.copy(this.position);
      this.rotation.y = initialData.rotation || 0;
      this.targetRotation = this.rotation.y;
    }

    this.init();
  }

  init() {
    this.createMesh();
    this.loadWeapon();
  }

  createMesh() {
    const group = new THREE.Group();

    // Determine color based on team
    const isRed = this.team === TEAMS.RED;
    const bodyColor = isRed ? 0xef4444 : 0x3b82f6;
    const headColor = isRed ? 0xf87171 : 0x60a5fa;

    // Body cylinder
    const bodyHeight = PLAYER.HEIGHT - PLAYER.RADIUS * 2;
    const bodyGeometry = new THREE.CylinderGeometry(
      PLAYER.RADIUS,
      PLAYER.RADIUS,
      bodyHeight,
      16,
    );
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: bodyColor,
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

    // Head Group
    this.headGroup = new THREE.Group();
    const headCenterY = PLAYER.HEIGHT - PLAYER.RADIUS * 0.8;
    this.headGroup.position.y = headCenterY;

    // Head sphere
    const headGeometry = new THREE.SphereGeometry(PLAYER.RADIUS * 0.8, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({
      color: headColor,
      roughness: 0.3,
      metalness: 0.5,
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.castShadow = true;
    this.headGroup.add(head);

    // Eyes (visor)
    const visorGeometry = new THREE.BoxGeometry(0.5, 0.15, 0.2);
    const visorMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.2,
      metalness: 0.8,
    });
    const visor = new THREE.Mesh(visorGeometry, visorMaterial);
    visor.position.set(0, 0.1, PLAYER.RADIUS * 0.6);
    this.headGroup.add(visor);

    group.add(this.headGroup);

    this.mesh = group;
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotation.y;
  }

  loadWeapon() {
    const weapon = AssetManager.getModelClone("weapon");
    if (!weapon) return;

    const box = new THREE.Box3().setFromObject(weapon);
    const center = box.getCenter(new THREE.Vector3());
    weapon.position.sub(center);

    const weaponGroup = new THREE.Group();
    weaponGroup.add(weapon);
    weaponGroup.scale.set(0.015, 0.015, 0.015);
    weaponGroup.position.set(0.35, PLAYER.HEIGHT * 0.45, -0.25);
    weaponGroup.rotation.set(0, Math.PI, 0);

    weaponGroup.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    this.weaponMesh = weaponGroup;
    this.mesh.add(weaponGroup);
  }

  // ===== Interface methods needed by CollisionSystem & RoundManager =====

  /**
   * Remote players don't deflect locally — the remote client handles their own deflection.
   * Always returns false so CollisionSystem doesn't double-process.
   */
  tryDeflect(_missile) {
    return false;
  }

  /**
   * Take damage. In multiplayer, each client runs collision detection locally
   * for now (no authoritative server), so we apply damage here.
   */
  takeDamage(amount) {
    if (!this.isAlive) return;
    this.health -= amount;
    this.emit("damage", { amount, health: this.health });
    if (this.health <= 0) {
      this.health = 0;
      this.die();
    }
  }

  /**
   * Handle death.
   */
  die() {
    this.isAlive = false;
    this.emit("death", { player: this });
    if (this.mesh) {
      this.mesh.visible = false;
    }
  }

  /**
   * Set targeted indicator state.
   */
  setTargeted(targeted) {
    this.isTargeted = targeted;
  }

  /**
   * Reset for new round — restore health, visibility, position.
   */
  reset(spawnData) {
    this.health = PLAYER.MAX_HEALTH;
    this.isAlive = true;
    this.isTargeted = false;

    if (spawnData) {
      const pos = spawnData.position || spawnData;
      if (pos.x !== undefined) this.position.x = pos.x;
      if (pos.y !== undefined) this.position.y = pos.y;
      if (pos.z !== undefined) this.position.z = pos.z;
      this.targetPosition.copy(this.position);

      if (spawnData.rotation !== undefined) {
        this.rotation.y = spawnData.rotation;
        this.targetRotation = spawnData.rotation;
      }
    }

    if (this.mesh) {
      this.mesh.visible = true;
      this.mesh.position.copy(this.position);
      this.mesh.rotation.y = this.rotation.y;
    }
  }

  /**
   * Update remote player state from server data
   */
  updateState(data) {
    if (data.x !== undefined) this.targetPosition.x = data.x;
    if (data.y !== undefined) this.targetPosition.y = data.y;
    if (data.z !== undefined) this.targetPosition.z = data.z;
    if (data.rotation !== undefined) this.targetRotation = data.rotation;
  }

  update(deltaTime) {
    // Smoother interpolation for 60Hz updates
    const lerpFactor = 15 * deltaTime;

    this.position.lerp(this.targetPosition, lerpFactor);

    // Interpolate rotation (shortest path)
    let diff = this.targetRotation - this.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    this.rotation.y += diff * lerpFactor;

    // Update mesh
    if (this.mesh) {
      this.mesh.position.copy(this.position);
      this.mesh.rotation.y = this.rotation.y;
    }
  }

  dispose() {
    // Cleanup if needed
  }
}
