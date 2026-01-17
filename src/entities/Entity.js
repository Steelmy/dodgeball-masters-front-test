import * as THREE from 'three';
import { EventEmitter } from '../utils/EventEmitter.js';

/**
 * Entity
 * Base class for all game entities
 */

export class Entity extends EventEmitter {
  constructor() {
    super();

    this.mesh = null;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.rotation = new THREE.Euler();

    this.isActive = true;
    this.id = Entity.generateId();
  }

  static idCounter = 0;

  static generateId() {
    return `entity_${++Entity.idCounter}`;
  }

  /**
   * Initialize the entity (override in subclasses)
   */
  init() {
    // To be implemented by subclasses
  }

  /**
   * Update the entity (called every frame)
   */
  update(deltaTime) {
    if (!this.isActive) return;

    // Sync mesh position with entity position
    if (this.mesh) {
      this.mesh.position.copy(this.position);
      this.mesh.rotation.copy(this.rotation);
    }
  }

  /**
   * Set entity position
   */
  setPosition(x, y, z) {
    this.position.set(x, y, z);
    if (this.mesh) {
      this.mesh.position.copy(this.position);
    }
  }

  /**
   * Get entity position
   */
  getPosition() {
    return this.position.clone();
  }

  /**
   * Get mesh for adding to scene
   */
  getMesh() {
    return this.mesh;
  }

  /**
   * Activate entity
   */
  activate() {
    this.isActive = true;
    if (this.mesh) {
      this.mesh.visible = true;
    }
  }

  /**
   * Deactivate entity
   */
  deactivate() {
    this.isActive = false;
    if (this.mesh) {
      this.mesh.visible = false;
    }
  }

  /**
   * Clean up resources
   */
  dispose() {
    if (this.mesh) {
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh.material) {
        if (Array.isArray(this.mesh.material)) {
          this.mesh.material.forEach(m => m.dispose());
        } else {
          this.mesh.material.dispose();
        }
      }
    }
    this.removeAllListeners();
  }
}
