import * as THREE from 'three';
import { CAMERA, PLAYER } from '../utils/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * CameraController
 * First-Person / Third-Person camera with full mouse look control
 */

const CAMERA_MODE_STORAGE_KEY = 'dodgeball_camera_mode';

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

    // Camera mode: 'fps' or 'tps' - load from localStorage or default to 'tps'
    this.mode = this.loadSavedMode();

    // Camera rotation (controlled by mouse)
    this.yaw = 0;   // Horizontal rotation (no limit, 360°)
    this.pitch = 0; // Vertical rotation (limited)

    // Pitch limits (in radians) - about 170° total range
    this.minPitch = -Math.PI * 0.4;  // Looking up (~72°)
    this.maxPitch = Math.PI * 0.45;   // Looking down (~81°)

    // Camera distance and offset from target (TPS mode)
    this.distance = 12;
    this.heightOffset = 2; // Height above target to look at
    this.targetOffset = new THREE.Vector3(0, 1.5, 0); // Offset on target

    // FPS settings
    this.fpsHeightOffset = PLAYER.HEIGHT * 0.9; // Eye level

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

    // Listen for 'F' key to toggle camera mode
    if (this.inputManager) {
      this.inputManager.on('keydown', ({ key }) => {
        if (key === 'KeyF') {
          const newMode = this.toggleMode();
          console.log(`Camera mode switched to: ${newMode.toUpperCase()}`);
        }
      });
    }
  }

  /**
   * Set the target entity for the camera to follow
   */
  setTarget(target) {
    this.target = target;
    // Apply mesh visibility based on current mode (important when loading saved mode)
    this.updateTargetMeshVisibility();
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

    if (this.mode === 'fps') {
      this.updateFPS();
    } else {
      this.updateTPS();
    }
  }

  /**
   * Update camera in First-Person mode
   */
  updateFPS() {
    // Position camera at player's eye level
    const targetPos = this.target.position ? this.target.position.clone() : new THREE.Vector3();

    const desiredPosition = new THREE.Vector3(
      targetPos.x,
      targetPos.y + this.fpsHeightOffset,
      targetPos.z
    );

    // Instant position in FPS (no smoothing for responsiveness)
    this.camera.position.copy(desiredPosition);
    this.currentPosition.copy(desiredPosition);

    // Look direction based on yaw and pitch
    const lookDirection = new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      -Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    );

    const lookTarget = desiredPosition.clone().add(lookDirection);
    this.camera.lookAt(lookTarget);
  }

  /**
   * Update camera in Third-Person mode
   */
  updateTPS() {
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
    this.mode = 'tps';
    this.target = player;
    this.distance = 12;
    this.heightOffset = 2;
    this.positionSmoothness = 0.15;
    this.updateTargetMeshVisibility();
  }

  /**
   * Set camera to FPS mode following a player
   */
  setFPSMode(player) {
    this.mode = 'fps';
    this.target = player;
    this.updateTargetMeshVisibility();
  }

  /**
   * Toggle between FPS and TPS modes
   */
  toggleMode() {
    if (this.mode === 'fps') {
      this.mode = 'tps';
      // Reset TPS specific settings when switching to it
      this.distance = 12;
      this.heightOffset = 2;
      this.positionSmoothness = 0.15;
    } else {
      this.mode = 'fps';
    }

    // Save preference to localStorage
    this.saveMode();

    // Hide/show local player mesh based on camera mode
    this.updateTargetMeshVisibility();

    return this.mode;
  }

  /**
   * Update target mesh visibility based on camera mode
   * In FPS mode, hide the local player's mesh to avoid seeing own body
   */
  updateTargetMeshVisibility() {
    if (this.target && this.target.mesh) {
      // In FPS mode, hide the player mesh (locally only)
      // In TPS mode, show the player mesh
      this.target.mesh.visible = this.mode !== 'fps';
    }
  }

  /**
   * Get current camera mode
   */
  getMode() {
    return this.mode;
  }

  /**
   * Load saved camera mode from localStorage
   */
  loadSavedMode() {
    try {
      const savedMode = localStorage.getItem(CAMERA_MODE_STORAGE_KEY);
      if (savedMode === 'fps' || savedMode === 'tps') {
        return savedMode;
      }
    } catch (e) {
      // localStorage might not be available
      console.warn('Could not load camera mode from localStorage:', e);
    }
    return 'fps'; // Default to first-person
  }

  /**
   * Save camera mode to localStorage
   */
  saveMode() {
    try {
      localStorage.setItem(CAMERA_MODE_STORAGE_KEY, this.mode);
    } catch (e) {
      console.warn('Could not save camera mode to localStorage:', e);
    }
  }

  /**
   * Apply saved camera mode and set target player
   * Use this instead of setTPSMode/setFPSMode to respect user preference
   */
  applySavedMode(player) {
    this.target = player;

    // Always reset TPS settings to defaults when starting a game/round
    // to avoid carrying over the 'Overview' mode distance (35)
    if (this.mode === 'tps') {
      this.distance = 12;
      this.heightOffset = 2;
      this.positionSmoothness = 0.15;
    } else {
      // Even if in FPS, we set a reasonable distance in case they switch
      this.distance = 12;
      this.heightOffset = 2;
    }

    this.updateTargetMeshVisibility();
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
