import * as THREE from 'three';
import { CAMERA } from '../utils/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * CameraController
 * Third-Person camera with full mouse look control
 */

export class CameraController {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      CAMERA.FOV,
      window.innerWidth / window.innerHeight,
      CAMERA.NEAR,
      CAMERA.FAR
    );

    // Target to follow
    this.target = null;

    // Camera rotation (controlled by mouse)
    this.yaw = 0;   // Horizontal rotation (no limit, 360°)
    this.pitch = 0; // Vertical rotation (limited)

    // Pitch limits (in radians) - about 170° total range
    this.minPitch = -Math.PI * 0.4;  // Looking up (~72°)
    this.maxPitch = Math.PI * 0.45;   // Looking down (~81°)

    // Camera distance and offset from target
    this.distance = 12;
    this.heightOffset = 2; // Height above target to look at
    this.targetOffset = new THREE.Vector3(0, 1.5, 0); // Offset on target

    // Smoothing
    this.currentPosition = new THREE.Vector3();
    this.positionSmoothness = 0.15;

    // Input manager reference (set later)
    this.inputManager = null;

    this.setInitialPosition();
    this.setupResizeHandler();
  }

  setInitialPosition() {
    const { x, y, z } = CAMERA.INITIAL_POSITION;
    this.camera.position.set(x, y, z);
    this.currentPosition.copy(this.camera.position);
  }

  setupResizeHandler() {
    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Set input manager for mouse control
   */
  setInputManager(inputManager) {
    this.inputManager = inputManager;
  }

  /**
   * Set the target entity for the camera to follow
   */
  setTarget(target) {
    this.target = target;
  }

  /**
   * Update camera (call in game loop)
   */
  update(deltaTime) {
    // Handle mouse input for rotation
    if (this.inputManager && this.inputManager.isLocked()) {
      const mouseDelta = this.inputManager.getMouseDelta();

      // Update yaw (horizontal) - no limits
      this.yaw -= mouseDelta.x;

      // Update pitch (vertical) - with limits
      this.pitch += mouseDelta.y;
      this.pitch = MathUtils.clamp(this.pitch, this.minPitch, this.maxPitch);
    }

    if (!this.target) return;

    // Get target position
    const targetPos = this.target.position ? this.target.position.clone() : new THREE.Vector3();
    targetPos.add(this.targetOffset);

    // Calculate camera position based on spherical coordinates
    const horizontalDistance = this.distance * Math.cos(this.pitch);
    const verticalDistance = this.distance * Math.sin(this.pitch);

    const desiredPosition = new THREE.Vector3(
      targetPos.x + horizontalDistance * Math.sin(this.yaw),
      targetPos.y + verticalDistance + this.heightOffset,
      targetPos.z + horizontalDistance * Math.cos(this.yaw)
    );

    // Smooth camera movement
    this.currentPosition.lerp(desiredPosition, this.positionSmoothness);
    this.camera.position.copy(this.currentPosition);

    // Look at target
    this.camera.lookAt(targetPos);
  }

  /**
   * Get the forward direction of the camera (for movement)
   */
  getForwardDirection() {
    // Forward direction on XZ plane based on yaw
    return new THREE.Vector3(
      -Math.sin(this.yaw),
      0,
      -Math.cos(this.yaw)
    ).normalize();
  }

  /**
   * Get the right direction of the camera (for strafing)
   */
  getRightDirection() {
    return new THREE.Vector3(
      Math.cos(this.yaw),
      0,
      -Math.sin(this.yaw)
    ).normalize();
  }

  /**
   * Get current yaw angle
   */
  getYaw() {
    return this.yaw;
  }

  /**
   * Get current pitch angle
   */
  getPitch() {
    return this.pitch;
  }

  /**
   * Set camera to TPS mode following a player
   */
  setTPSMode(player) {
    this.target = player;
    this.distance = 12;
    this.heightOffset = 2;
    this.positionSmoothness = 0.15;
  }

  /**
   * Set camera to overview mode (for menu/spectating)
   */
  setOverviewMode() {
    this.target = { position: new THREE.Vector3(0, 0, 0) };
    this.distance = 35;
    this.heightOffset = 10;
    this.yaw = 0;
    this.pitch = Math.PI * 0.25; // Looking down at 45°
    this.positionSmoothness = 0.05;
  }

  /**
   * Reset camera rotation
   */
  resetRotation(yaw = 0) {
    this.yaw = yaw;
    this.pitch = 0;
  }

  /**
   * Set camera rotation
   */
  setRotation(yaw, pitch) {
    if (yaw !== undefined) this.yaw = yaw;
    if (pitch !== undefined) this.pitch = pitch;
  }

  /**
   * Set camera yaw
   */
  setYaw(yaw) {
    this.yaw = yaw;
  }

  getCamera() {
    return this.camera;
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
  }
}
