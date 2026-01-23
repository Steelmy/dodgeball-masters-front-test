import * as THREE from 'three';

// Core
import { SceneManager } from './core/SceneManager.js';
import { CameraController } from './core/CameraController.js';
import { Renderer } from './core/Renderer.js';
import { InputManager } from './core/InputManager.js';
import { AudioManager } from './core/AudioManager.js';

// Entities
import { Player } from './entities/Player.js';
import { Bot } from './entities/Bot.js';
import { Missile } from './entities/Missile.js';
import { Arena } from './entities/Arena.js';

// Systems
import { CollisionSystem } from './systems/CollisionSystem.js';
import { GameStateManager } from './systems/GameStateManager.js';
import { RoundManager } from './systems/RoundManager.js';

// UI
import { UIManager } from './ui/UIManager.js';

// Utils
import { GAME_STATES, EVENTS } from './utils/Constants.js';
import { globalEvents } from './utils/EventEmitter.js';

/**
 * Game
 * Main game class that orchestrates all systems
 */

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.isRunning = false;
    this.clock = new THREE.Clock();

    // Initialize all systems
    this.initCore();
    this.initEntities();
    this.initSystems();
    this.initUI();
    this.setupEventListeners();

    console.log('Dodgeball Masters initialized!');
  }

  initCore() {
    // Scene
    this.sceneManager = new SceneManager();
    this.scene = this.sceneManager.getScene();

    // Camera
    this.cameraController = new CameraController();
    this.camera = this.cameraController.getCamera();

    // Renderer
    this.renderer = new Renderer(this.canvas);

    // Input
    this.inputManager = new InputManager();

    // Audio
    this.audioManager = new AudioManager();
  }

  initEntities() {
    // Arena
    this.arena = new Arena();
    this.scene.add(this.arena.getMesh());

    // Give camera access to input manager for mouse look
    this.cameraController.setInputManager(this.inputManager);

    // Player (with camera reference for movement direction)
    this.player = new Player(this.inputManager, this.cameraController);
    this.scene.add(this.player.getMesh());

    // Bot
    this.bot = new Bot();
    this.scene.add(this.bot.getMesh());

    // Missile
    this.missile = new Missile();
    this.scene.add(this.missile.getMesh());
    this.scene.add(this.missile.getTrail());

    // Give player missile reference for drag mechanic
    this.player.setMissile(this.missile);

    // Set initial positions
    const spawnPositions = this.arena.getSpawnPositions();
    this.player.setPosition(spawnPositions.player.position.x, 0, spawnPositions.player.position.z);
    this.bot.setPosition(spawnPositions.bot.position.x, 0, spawnPositions.bot.position.z);

    // Hide entities initially
    this.player.getMesh().visible = false;
    this.bot.getMesh().visible = false;
    this.missile.hide();

    // Set camera to overview mode initially (for menu)
    this.cameraController.setOverviewMode();
  }

  initSystems() {
    // Game state
    this.gameStateManager = new GameStateManager();

    // Collision
    this.collisionSystem = new CollisionSystem(this.audioManager);
    this.collisionSystem.setEntities(this.player, this.bot, this.missile);

    // Round manager
    this.roundManager = new RoundManager(this.gameStateManager, this.audioManager);
    this.roundManager.setEntities(this.player, this.bot, this.missile, this.arena);
  }

  initUI() {
    this.uiManager = new UIManager();

    // Bind UI buttons
    this.uiManager.bindStartButton(() => this.startGame());
    this.uiManager.bindControlsButton();
    this.uiManager.bindResumeButton(() => this.resumeGame());
    this.uiManager.bindQuitButton(() => this.quitToMenu());
    this.uiManager.bindPlayAgainButton(() => this.startGame());
    this.uiManager.bindMainMenuButton(() => this.quitToMenu());

    // Bind Settings
    this.uiManager.bindSettingsActions({
      getValues: () => {
        const cam = this.cameraController;
        return {
          camera: {
            mode: cam.mode,
            fov: cam.camera.fov,
            distance: cam.distance,
            heightOffset: cam.heightOffset,
            sideOffset: cam.sideOffset
          },
          volume: this.audioManager.volume,
          bindings: this.inputManager.bindings
        };
      },
      onCameraChange: (changes) => {
        if (changes.mode) {
          if (changes.mode === 'fps') this.cameraController.setFPSMode(this.player);
          else this.cameraController.setTPSMode(this.player);
          this.cameraController.saveMode();
        }
        
        if (changes.fov) this.cameraController.setFOV(changes.fov);
        if (changes.distance) this.cameraController.setDistance(changes.distance);
        
        // Handle offsets
        if (changes.heightOffset !== undefined || changes.sideOffset !== undefined) {
          this.cameraController.setOffsets(changes.heightOffset, changes.sideOffset);
        }

        // Save camera settings
        const settings = {
          fov: this.cameraController.camera.fov,
          distance: this.cameraController.distance,
          heightOffset: this.cameraController.heightOffset,
          sideOffset: this.cameraController.sideOffset
        };
        localStorage.setItem('dodgeball_camera_settings', JSON.stringify(settings));
      },
      onAudioChange: (volume) => {
        this.audioManager.setVolume(volume);
        localStorage.setItem('dodgeball_audio_volume', volume);
      },
      onControlChange: (action, key) => {
        this.inputManager.setBinding(action, key);
        localStorage.setItem('dodgeball_key_bindings', JSON.stringify(this.inputManager.bindings));
      },
      onResetCamera: () => {
        this.cameraController.resetDefaults();
        // Clear storage to rely on defaults or explicitly save defaults
        localStorage.removeItem('dodgeball_camera_settings');
        localStorage.removeItem('dodgeball_camera_mode');
      },
      onResetControls: () => {
        this.inputManager.resetBindings();
        localStorage.removeItem('dodgeball_key_bindings');
      },
      onResetAudio: () => {
        this.audioManager.resetDefaults();
        localStorage.removeItem('dodgeball_audio_volume');
      }
    });

    this.loadSettings();
  }

  loadSettings() {
    // Load Camera Settings
    try {
      const camSettings = JSON.parse(localStorage.getItem('dodgeball_camera_settings'));
      if (camSettings) {
        if (camSettings.fov) this.cameraController.setFOV(camSettings.fov);
        if (camSettings.distance) this.cameraController.setDistance(camSettings.distance);
        this.cameraController.setOffsets(camSettings.heightOffset, camSettings.sideOffset);
      }
    } catch (e) { console.warn('Failed to load camera settings', e); }

    // Load Audio Settings
    try {
      const vol = localStorage.getItem('dodgeball_audio_volume');
      if (vol !== null) {
        this.audioManager.setVolume(parseFloat(vol));
      }
    } catch (e) { console.warn('Failed to load audio settings', e); }

    // Load Controls
    try {
      const bindings = JSON.parse(localStorage.getItem('dodgeball_key_bindings'));
      if (bindings) {
        for (const [action, key] of Object.entries(bindings)) {
          this.inputManager.setBinding(action, key);
        }
      }
    } catch (e) { console.warn('Failed to load key bindings', e); }
  }

  setupEventListeners() {
    // Pointer lock handles the Pause/Resume state transitions to avoid race conditions
    this.inputManager.on('pointerlockchange', (isLocked) => {
      const currentState = this.gameStateManager.getState();

      if (isLocked) {
        // If we just acquired the lock and were paused, resume
        if (currentState === GAME_STATES.PAUSED) {
          this.gameStateManager.resume();
          this.uiManager.hidePauseMenu();
        }
      } else {
        // If we just lost the lock and were in an active game state, pause
        if (currentState !== GAME_STATES.MENU &&
          currentState !== GAME_STATES.PAUSED &&
          currentState !== GAME_STATES.MATCH_END) {

          this.gameStateManager.pause();
          this.uiManager.showPauseMenu();
        }
      }
    });

    // Handle pointer lock errors
    this.inputManager.on('pointerlockerror', () => {
      // If we failed to get the lock while trying to resume, make sure we stay/return to pause menu
      if (!this.gameStateManager.isState(GAME_STATES.PAUSED) &&
        !this.gameStateManager.isState(GAME_STATES.MENU)) {
        this.gameStateManager.pause();
        this.uiManager.showPauseMenu();
      }
    });

    // Listen for state changes
    globalEvents.on(`state:${GAME_STATES.PLAYING}`, (data) => {
      // Only start gameplay logic (missile spawn) if coming from countdown
      if (data && data.previousState === GAME_STATES.COUNTDOWN) {
        this.roundManager.startRoundGameplay();
      }
      // Always unlock movement when entering playing state (start or resume)
      this.player.setMovementLocked(false);
    });

    globalEvents.on(`state:${GAME_STATES.COUNTDOWN}`, () => {
      // Lock movement during countdown
      this.player.setMovementLocked(true);
    });

    // Handle Escape key
    this.inputManager.on('keydown', ({ key }) => {
      if (key === 'Escape') {
        const currentState = this.gameStateManager.getState();

        // If Paused, try to Resume
        if (currentState === GAME_STATES.PAUSED) {
          this.resumeGame();
        }
        // If Playing/Countdown/RoundEnd, browser's native Escape will unlock pointer
        // which triggers our pointerlockchange -> pause flow.
      }
    });

    globalEvents.on(EVENTS.ROUND_START, () => {
      this.roundManager.setupRound();
      this.player.getMesh().visible = true;
      this.bot.getMesh().visible = true;

      // Apply saved camera mode (respects user preference)
      this.cameraController.applySavedMode(this.player);

      // Set initial rotation from spawn data
      const spawnPositions = this.arena.getSpawnPositions();
      this.cameraController.setRotation(spawnPositions.player.rotation, Math.PI / 12);
    });

    // Play pulse sound when player activates deflection
    globalEvents.on(EVENTS.PLAYER_DEFLECT, () => {
      this.audioManager.play('pulse');
    });

  }

  startGame() {
    this.uiManager.hideAll();
    this.player.getMesh().visible = true;
    this.bot.getMesh().visible = true;

    // Apply saved camera mode (respects user preference)
    this.cameraController.applySavedMode(this.player);
    this.loadSettings();

    // Lock pointer for mouse look
    this.inputManager.requestPointerLock(this.canvas);

    this.gameStateManager.startMatch();
  }

  resumeGame() {
    // Only request lock. The pointerlockchange listener will handle the state resume.
    this.inputManager.requestPointerLock(this.canvas);
  }

  quitToMenu() {
    this.gameStateManager.returnToMenu();
    this.uiManager.showMainMenu();

    // Release pointer lock
    this.inputManager.exitPointerLock();

    // Reset and hide entities
    this.player.getMesh().visible = false;
    this.bot.getMesh().visible = false;
    this.missile.hide();

    // Switch back to overview camera
    this.cameraController.setOverviewMode();
  }

  /**
   * Main game loop
   */
  update() {
    if (!this.isRunning) return;

    requestAnimationFrame(() => this.update());

    const deltaTime = this.clock.getDelta();
    const state = this.gameStateManager.getState();

    // Always update arena (water animation)
    this.arena.update(deltaTime);

    // Update based on state
    switch (state) {
      case GAME_STATES.MENU:
        // Just render the scene with overview camera
        break;

      case GAME_STATES.COUNTDOWN:
        this.gameStateManager.updateCountdown(deltaTime, this.audioManager);
        // Allow player rotation/camera control during countdown (movement locked)
        this.player.update(deltaTime, this.arena);
        break;

      case GAME_STATES.PLAYING:
        this.updateGameplay(deltaTime);
        break;

      case GAME_STATES.PAUSED:
        // Don't update gameplay
        break;

      case GAME_STATES.ROUND_END:
        // Wait for next round
        break;

      case GAME_STATES.MATCH_END:
        // Wait for user input
        break;
    }

    // Always update camera and render
    this.cameraController.update(deltaTime);
    this.renderer.render(this.scene, this.camera);
  }

  updateGameplay(deltaTime) {
    // Update player with arena for collision bounds
    this.player.update(deltaTime, this.arena);

    // Update bot (track missile or player)
    const targetPos = this.missile.isActive ? this.missile.getPosition() : this.player.getPosition();
    this.bot.update(deltaTime, targetPos);

    // Update missile
    if (this.missile.isActive) {
      this.missile.update(deltaTime);
    }

    // Update collision system
    this.collisionSystem.update();
  }

  /**
   * Start the game loop
   */
  start() {
    this.isRunning = true;
    this.clock.start();
    this.update();
  }

  /**
   * Stop the game loop
   */
  stop() {
    this.isRunning = false;
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.stop();

    // Dispose all systems
    this.sceneManager.dispose();
    this.cameraController.dispose();
    this.renderer.dispose();
    this.inputManager.dispose();
    this.audioManager.dispose();

    // Dispose entities
    this.arena.dispose();
    this.player.dispose();
    this.bot.dispose();
    this.missile.dispose();

    // Dispose systems
    this.collisionSystem.dispose();
    this.roundManager.dispose();

    // Dispose UI
    this.uiManager.dispose();

    // Clear global events
    globalEvents.clear();
  }
}
