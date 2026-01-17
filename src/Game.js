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
  }

  setupEventListeners() {
    // Pause when pointer lock is lost (Escape releases pointer lock)
    this.inputManager.on('pointerlockchange', (isLocked) => {
      if (!isLocked && this.gameStateManager.isState(GAME_STATES.PLAYING)) {
        this.gameStateManager.pause();
        this.uiManager.showPauseMenu();
      }
    });

    // Listen for state changes
    globalEvents.on(`state:${GAME_STATES.PLAYING}`, () => {
      this.roundManager.startRoundGameplay();
      // Unlock movement when game starts
      this.player.setMovementLocked(false);
    });

    globalEvents.on(`state:${GAME_STATES.COUNTDOWN}`, () => {
      // Lock movement during countdown
      this.player.setMovementLocked(true);
    });

    globalEvents.on(EVENTS.ROUND_START, () => {
      this.roundManager.setupRound();
      this.player.getMesh().visible = true;
      this.bot.getMesh().visible = true;

      // Switch to TPS camera following the player
      this.cameraController.setTPSMode(this.player);
    });

  }

  startGame() {
    this.uiManager.hideAll();
    this.player.getMesh().visible = true;
    this.bot.getMesh().visible = true;

    // Set TPS camera to follow player
    this.cameraController.setTPSMode(this.player);
    this.cameraController.resetRotation();

    // Lock pointer for mouse look
    this.inputManager.requestPointerLock(this.canvas);

    this.gameStateManager.startMatch();
  }

  resumeGame() {
    this.gameStateManager.resume();
    this.uiManager.hidePauseMenu();
    // Re-lock pointer
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
