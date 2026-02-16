import * as THREE from "three";

// Core
import { SceneManager } from "./core/SceneManager.js";
import { CameraController } from "./core/CameraController.js";
import { Renderer } from "./core/Renderer.js";
import { InputManager } from "./core/InputManager.js";
import { AudioManager } from "./core/AudioManager.js";
import { AssetManager } from "./core/AssetManager.js";

// Entities
import { Player } from "./entities/Player.js";
import { Bot } from "./entities/Bot.js";
import { RemotePlayer } from "./entities/RemotePlayer.js";
import { Missile } from "./entities/Missile.js";
import { Arena } from "./entities/Arena.js";
import { Explosion } from "./entities/Explosion.js";
import { DeflectEffect } from "./entities/DeflectEffect.js";

// Systems
import { CollisionSystem } from "./systems/CollisionSystem.js";
import { GameStateManager } from "./systems/GameStateManager.js";
import { RoundManager } from "./systems/RoundManager.js";

// UI
import { UIManager } from "./ui/UIManager.js";

// Utils
import { GAME_STATES, EVENTS, PLAYER } from "./utils/Constants.js";
import { globalEvents } from "./utils/EventEmitter.js";
import { NetworkManager } from "./core/NetworkManager.js";

/**
 * Game
 * Main game class that orchestrates all systems
 */

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.isRunning = false;
    this.clock = new THREE.Clock();
    this.lastInputTime = 0;
    this.explosions = [];
    this.explosionPools = { player: [], bot: [] };
    this.deflectEffects = [];
    this.remotePlayers = {}; // Map of remote player entities
    this.networkUpdateTimer = 0;

    // Initialize all systems
    this.initCore();
    this.initEntities();
    this.initSystems();
    this.initUI();
    this.setupEventListeners();
    this.initNetwork();

    // Setup Lobby UI events
    this.setupLobbyEvents();

    // Start loop
    // this.animate(); // REMOVED: Loop should only start when start() is called

    console.log("Dodgeball Masters initialized!");
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
    // Get saved map or default
    const savedMap =
      localStorage.getItem("dodgeball_map_selection") || "orbital";

    // Arena
    this.arena = new Arena(savedMap);
    this.scene.add(this.arena.getMesh());

    // Give camera access to arena for collision
    this.cameraController.setArena(this.arena);

    // Give camera access to input manager for mouse look
    this.cameraController.setInputManager(this.inputManager);

    // Player (with camera reference for movement direction)
    this.player = new Player(this.inputManager, this.cameraController);
    this.scene.add(this.player.getMesh());

    // Bot
    this.bots = [];
    // this.bot = new Bot(); // REMOVED

    // Missile
    this.missile = new Missile();
    this.scene.add(this.missile.getMesh());
    this.scene.add(this.missile.getTrail());

    // Give player missile reference for drag mechanic
    this.player.setMissile(this.missile);

    // Give bot references -> moved to startGame

    // Set initial positions
    const spawnPositions = this.arena.getSpawnPositions();
    this.player.setPosition(
      spawnPositions.player.position.x,
      0,
      spawnPositions.player.position.z,
    );
    // Bot positioning -> moved to startGame

    // Hide entities initially
    this.player.getMesh().visible = false;
    this.missile.hide();

    // Set camera to overview mode initially (for menu)
    this.cameraController.setOverviewMode();

    // Warm up shaders by pre-rendering explosion materials
    this.warmupShaders();
  }

  /**
   * Pre-compile shaders by rendering dummy explosions once
   * This prevents lag spikes when explosions spawn during gameplay
   */
  warmupShaders() {
    // Create dummy explosions for both teams to compile their shaders
    const dummyExplosions = [
      new Explosion(new THREE.Vector3(0, -100, 0), "player"),
      new Explosion(new THREE.Vector3(0, -100, 0), "bot"),
    ];

    // Add to scene temporarily
    for (const exp of dummyExplosions) {
      this.scene.add(exp.getMesh());
    }

    // Render one frame to compile shaders
    this.renderer.render(this.scene, this.camera);

    // Remove and dispose dummy explosions
    for (const exp of dummyExplosions) {
      this.scene.remove(exp.getMesh());
      exp.dispose();
    }
  }

  recreateArena(mapId) {
    // Remove old arena
    this.scene.remove(this.arena.getMesh());
    this.arena.dispose();

    // Create new arena
    this.arena = new Arena(mapId);
    this.scene.add(this.arena.getMesh());

    // Update camera reference
    this.cameraController.setArena(this.arena);

    // Update references in systems
    this.roundManager.setEntities(
      this.player,
      this.bots,
      this.remotePlayers,
      this.missile,
      this.arena,
    );

    // Update spawn positions
    const spawnPositions = this.arena.getSpawnPositions();
    this.player.setPosition(
      spawnPositions.player.position.x,
      0,
      spawnPositions.player.position.z,
    );

    // Reposition bots if they exist
    this.bots.forEach((bot, index) => {
      // Simple offset for now
      bot.setPosition(
        spawnPositions.bot.position.x + index * 2, // Spread them out
        0,
        spawnPositions.bot.position.z,
      );
    });

    // Reset rotations
    this.cameraController.setRotation(
      spawnPositions.player.rotation,
      Math.PI / 12,
    );
  }

  initSystems() {
    // Game state
    this.gameStateManager = new GameStateManager();

    // Collision
    this.collisionSystem = new CollisionSystem(this.audioManager);
    this.collisionSystem.setEntities(
      this.player,
      [...this.bots, ...Object.values(this.remotePlayers)],
      this.missile,
    );

    // Round manager
    this.roundManager = new RoundManager(
      this.gameStateManager,
      this.audioManager,
    );
    this.roundManager.setEntities(
      this.player,
      this.bots,
      this.remotePlayers,
      this.missile,
      this.arena,
    );
  }

  initUI() {
    this.uiManager = new UIManager();

    // Bind UI buttons
    this.uiManager.bindStartButton(() => this.startLocalGame());
    this.uiManager.bindResumeButton(() => this.resumeGame());
    this.uiManager.bindQuitButton(() => this.quitToMenu());
    this.uiManager.bindPlayAgainButton(() => this.startLocalGame());
    this.uiManager.bindMainMenuButton(() => this.quitToMenu());

    // Bind difficulty change
    this.uiManager.bindDifficultyChange((difficulty) => {
      this.bots.forEach((b) => b.setDifficulty(difficulty));
    });

    // Apply saved difficulty -> handled when bots are created
    // const savedDifficulty = this.uiManager.getDifficulty();
    // if (savedDifficulty) {
    //   this.bot.setDifficulty(savedDifficulty);
    // }

    // Bind Settings
    this.uiManager.bindSettingsActions({
      getValues: () => {
        const cam = this.cameraController;
        let savedCam = {};
        try {
          savedCam =
            JSON.parse(localStorage.getItem("dodgeball_camera_settings")) || {};
        } catch (e) {}

        return {
          camera: {
            mode: cam.mode,
            fov: savedCam.fov || cam.camera.fov,
            distance: savedCam.distance !== undefined ? savedCam.distance : 4,
            heightOffset:
              savedCam.heightOffset !== undefined ? savedCam.heightOffset : 0,
            sideOffset:
              savedCam.sideOffset !== undefined ? savedCam.sideOffset : 0,
          },
          volume: this.audioManager.volume,
          bindings: this.inputManager.bindings,
        };
      },
      onCameraChange: (changes) => {
        if (changes.mode) {
          if (changes.mode === "fps")
            this.cameraController.setFPSMode(this.player);
          else this.cameraController.setTPSMode(this.player);
          this.cameraController.saveMode();
        }

        if (changes.fov) this.cameraController.setFOV(changes.fov);
        if (changes.distance)
          this.cameraController.setDistance(changes.distance);

        // Handle offsets
        if (
          changes.heightOffset !== undefined ||
          changes.sideOffset !== undefined
        ) {
          this.cameraController.setOffsets(
            changes.heightOffset,
            changes.sideOffset,
          );
        }

        // Save camera settings
        const settings = {
          fov: this.cameraController.camera.fov,
          distance: this.cameraController.distance,
          heightOffset: this.cameraController.heightOffset,
          sideOffset: this.cameraController.sideOffset,
        };
        localStorage.setItem(
          "dodgeball_camera_settings",
          JSON.stringify(settings),
        );
      },
      onAudioChange: (volume) => {
        this.audioManager.setVolume(volume);
        localStorage.setItem("dodgeball_audio_volume", volume);
      },
      onControlChange: (action, key) => {
        this.inputManager.setBinding(action, key);
        localStorage.setItem(
          "dodgeball_key_bindings",
          JSON.stringify(this.inputManager.bindings),
        );
      },
      onResetCamera: () => {
        this.cameraController.resetDefaults();
        // Clear storage to rely on defaults or explicitly save defaults
        localStorage.removeItem("dodgeball_camera_settings");
        localStorage.removeItem("dodgeball_camera_mode");
      },
      onResetControls: () => {
        this.inputManager.resetBindings();
        localStorage.removeItem("dodgeball_key_bindings");
      },
      onResetAudio: () => {
        this.audioManager.resetDefaults();
        localStorage.removeItem("dodgeball_audio_volume");
      },
    });

    this.loadSettings();
  }

  loadSettings() {
    // Load Camera Settings
    try {
      const camSettings = JSON.parse(
        localStorage.getItem("dodgeball_camera_settings"),
      );
      if (camSettings) {
        if (camSettings.fov) this.cameraController.setFOV(camSettings.fov);
        if (camSettings.distance)
          this.cameraController.setDistance(camSettings.distance);
        this.cameraController.setOffsets(
          camSettings.heightOffset,
          camSettings.sideOffset,
        );
      }
    } catch (e) {
      console.warn("Failed to load camera settings", e);
    }

    // Load Audio Settings
    try {
      const vol = localStorage.getItem("dodgeball_audio_volume");
      if (vol !== null) {
        this.audioManager.setVolume(parseFloat(vol));
      }
    } catch (e) {
      console.warn("Failed to load audio settings", e);
    }

    // Load Controls
    try {
      const bindings = JSON.parse(
        localStorage.getItem("dodgeball_key_bindings"),
      );
      if (bindings) {
        for (const [action, key] of Object.entries(bindings)) {
          this.inputManager.setBinding(action, key);
        }
      }
    } catch (e) {
      console.warn("Failed to load key bindings", e);
    }
  }

  setupEventListeners() {
    // Pointer lock change handler - only used for detecting external unlock (clicking outside, etc.)
    this.inputManager.on("pointerlockchange", (isLocked) => {
      const currentState = this.gameStateManager.getState();

      if (!isLocked) {
        // Pointer was unlocked externally (not by our pause action)
        // Only auto-pause if we're in an active game state and not already handling it
        if (
          currentState !== GAME_STATES.MENU &&
          currentState !== GAME_STATES.PAUSED &&
          currentState !== GAME_STATES.MATCH_END &&
          !NetworkManager.isConnected // Do not pause if multiplayer
        ) {
          this.pauseGame();
        }
      }
    });

    // Handle pointer lock errors - just retry silently
    this.inputManager.on("pointerlockerror", () => {
      // Retry after a short delay if game is not paused
      setTimeout(() => {
        const currentState = this.gameStateManager.getState();
        if (
          currentState !== GAME_STATES.MENU &&
          currentState !== GAME_STATES.PAUSED &&
          currentState !== GAME_STATES.MATCH_END
        ) {
          this.inputManager.requestPointerLock(this.canvas);
        }
      }, 100);
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

    // Handle Escape key for pause/resume toggle
    this.inputManager.on("keydown", ({ key }) => {
      if (key === "Escape") {
        // 1. If Settings are open, close them first
        if (this.uiManager.isSettingsOpen()) {
          this.uiManager.hideSettingsMenu();
          return;
        }

        const currentState = this.gameStateManager.getState();

        // 2. If paused, resume
        if (currentState === GAME_STATES.PAUSED) {
          this.resumeGame();
          return;
        }

        // 3. If in active game state, pause
        if (
          currentState === GAME_STATES.PLAYING ||
          currentState === GAME_STATES.COUNTDOWN ||
          currentState === GAME_STATES.ROUND_END
        ) {
          this.pauseGame();
        }
      }
    });

    globalEvents.on(EVENTS.ROUND_START, () => {
      this.roundManager.setupRound();
      this.player.getMesh().visible = true;
      this.bots.forEach((b) => (b.getMesh().visible = true));
      Object.values(this.remotePlayers).forEach((rp) => {
        if (rp.getMesh()) rp.getMesh().visible = true;
        if (rp.reset) rp.reset(); // Reset health/alive for new round
      });

      // Apply saved camera mode
      this.cameraController.applySavedMode(this.player);

      const spawnPositions = this.arena.getSpawnPositions();
      this.cameraController.setRotation(
        spawnPositions.player.rotation,
        Math.PI / 12,
      );
    });

    // Spawn explosion on missile hit
    globalEvents.on(EVENTS.MISSILE_HIT, (data) => {
      this.spawnExplosion(data.target);
    });

    // Spawn deflect effect when player activates deflection (not under cooldown)
    globalEvents.on(EVENTS.PLAYER_DEFLECT, (data) => {
      this.audioManager.play("pulse");
      this.spawnDeflectEffect(data.player);
    });

    // Spawn deflect effect when bot deflects (bot only deflects on actual hit)
    globalEvents.on(EVENTS.MISSILE_DEFLECT, (data) => {
      // Only spawn effect for bot (player effect is handled by PLAYER_DEFLECT)
      if (data.deflector !== this.player) {
        this.spawnDeflectEffect(data.deflector);
      }
    });
  }

  /**
   * Start a local (single-player) game by generating synthetic entity data.
   * Supports team sizes: e.g. 2v2 = player + 1 bot on BLUE vs 2 bots on RED.
   */
  startLocalGame() {
    const playerId = NetworkManager.socket
      ? NetworkManager.socket.id
      : "LOCAL_PLAYER";
    const difficulty = this.uiManager.getDifficulty();
    const teamSize = this.uiManager.getTeamSize
      ? this.uiManager.getTeamSize()
      : 1;

    const entities = {};

    // Player is always on BLUE
    entities[playerId] = {
      id: playerId,
      team: "BLUE",
      isBot: false,
      isHost: true,
    };

    // Fill remaining BLUE slots with bots (teammates)
    for (let i = 1; i < teamSize; i++) {
      const botId = `BOT_BLUE_${i}`;
      entities[botId] = {
        id: botId,
        team: "BLUE",
        isBot: true,
        difficulty: difficulty,
        name: `Bot Blue ${i + 1}`,
      };
    }

    // Fill all RED slots with bots (opponents)
    for (let i = 0; i < teamSize; i++) {
      const botId = `BOT_RED_${i}`;
      entities[botId] = {
        id: botId,
        team: "RED",
        isBot: true,
        difficulty: difficulty,
        name: `Bot Red ${i + 1}`,
      };
    }

    this.startGame({ entities });
  }

  startGame(data) {
    console.log("[Game] startGame called", data);

    // Guard: no entities = can't start
    if (!data || !data.entities) {
      console.error("[Game] startGame called without entities data!");
      return;
    }

    // --- 1. Map Change ---
    const selectedMap = this.uiManager.getMap();
    if (this.arena && this.arena.mapId !== selectedMap) {
      this.recreateArena(selectedMap);
    }

    // --- 2. Clear previous bots ---
    this.bots.forEach((b) => {
      if (b.getMesh()) this.scene.remove(b.getMesh());
    });
    this.bots = [];

    // --- 3. Parse entities from server ---
    const myId = NetworkManager.socket.id;
    const isHost = NetworkManager.isHost;

    console.log("[Game] Parsing entities. My ID:", myId, "isHost:", isHost);

    Object.values(data.entities).forEach((entity) => {
      console.log(
        "[Game] Entity:",
        entity.id,
        "team:",
        entity.team,
        "isBot:",
        entity.isBot,
      );

      if (entity.id === myId) {
        // It's me — update my team
        this.player.team = entity.team;
        this.player.id = entity.id; // Socket ID for resolveEntityById
        console.log("[Game] My team set to:", this.player.team);
        return;
      }

      if (entity.isBot) {
        // Create bot
        const bot = new Bot(entity.team);
        bot.id = entity.id;
        bot.setDifficulty(entity.difficulty || "medium");
        bot.setReferences(this.player, this.missile);
        this.scene.add(bot.getMesh());
        this.bots.push(bot);
        console.log("[Game] Bot created:", entity.id, entity.team);
      } else {
        // Remote player
        this.addRemotePlayer(entity);
      }
    });

    // --- 4. Re-register entities with game systems ---
    const allOthers = [...this.bots, ...Object.values(this.remotePlayers)];

    this.collisionSystem.setEntities(this.player, allOthers, this.missile);

    this.roundManager.setEntities(
      this.player,
      this.bots,
      this.remotePlayers,
      this.missile,
      this.arena,
    );

    // --- 4b. Configure multiplayer authority ---
    const hasRemotePlayers = Object.keys(this.remotePlayers).length > 0;
    if (hasRemotePlayers) {
      this.roundManager.setMultiplayerMode(NetworkManager.isHost);
      this.roundManager.onBroadcast = (eventType, data) => {
        if (eventType === "round_state") {
          NetworkManager.sendRoundState(data);
        } else if (eventType === "player_hit") {
          NetworkManager.sendPlayerHit(data);
        }
      };
    }

    // --- 5. UI transition ---
    this.uiManager.hideAll();
    this.uiManager.showHUD();
    this.uiManager.setLocalTeam(this.player.team);

    // Make entities visible
    this.player.getMesh().visible = true;
    this.bots.forEach((b) => {
      if (b.getMesh()) b.getMesh().visible = true;
    });
    Object.values(this.remotePlayers).forEach((rp) => {
      if (rp.getMesh()) rp.getMesh().visible = true;
    });

    // --- 6. Camera & Input ---
    this.cameraController.applySavedMode(this.player);
    this.loadSettings();
    this.inputManager.requestPointerLock(this.canvas);

    if (
      this.audioManager &&
      this.audioManager.context &&
      this.audioManager.context.state === "suspended"
    ) {
      this.audioManager.context.resume();
    }

    // --- 7. Start match ---
    this.gameStateManager.startMatch();
  }

  pauseGame() {
    const currentState = this.gameStateManager.getState();
    if (
      currentState !== GAME_STATES.MENU &&
      currentState !== GAME_STATES.PAUSED &&
      currentState !== GAME_STATES.MATCH_END
    ) {
      this.gameStateManager.pause();
      this.uiManager.showPauseMenu();
      this.inputManager.exitPointerLock();
    }
  }

  resumeGame() {
    if (this.gameStateManager.isState(GAME_STATES.PAUSED)) {
      this.gameStateManager.resume();
      this.uiManager.hidePauseMenu();
      this.inputManager.requestPointerLock(this.canvas);
    }
  }

  quitToMenu() {
    this.gameStateManager.returnToMenu();
    this.uiManager.showMainMenu();

    // Release pointer lock
    this.inputManager.exitPointerLock();

    // Reset and hide entities
    if (this.player.getMesh()) this.player.getMesh().visible = false;
    this.bots.forEach((b) => {
      if (b.getMesh()) b.getMesh().visible = false;
    });
    Object.values(this.remotePlayers).forEach((rp) => {
      if (rp.getMesh()) rp.getMesh().visible = false;
    });

    this.missile.hide();

    // Clear explosions
    for (const explosion of this.explosions) {
      this.scene.remove(explosion.getMesh());
      explosion.dispose();
    }
    this.explosions = [];

    // Clear deflect effects
    for (const effect of this.deflectEffects) {
      this.scene.remove(effect.getMesh());
      effect.dispose();
    }
    this.deflectEffects = [];

    // Switch back to overview camera
    this.cameraController.setOverviewMode();
  }

  /**
   * Start the game loop
   */
  start() {
    this.isRunning = true;
    this.clock.start();
    this.animate();
  }

  /**
   * Stop the game loop
   */
  stop() {
    this.isRunning = false;
  }

  /**
   * Main game loop
   */
  animate() {
    if (!this.isRunning) return;

    requestAnimationFrame(() => this.animate());

    let deltaTime = this.clock.getDelta();

    // Clamp delta time to prevent physics weirdness on lag spikes
    // Max 0.05s (20 FPS) - if frame takes longer, game slows down instead of breaking physics
    deltaTime = Math.min(deltaTime, 0.05);

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

    // Update active explosions
    this.updateExplosions(deltaTime);

    // Update deflect effects
    this.updateDeflectEffects(deltaTime);

    // Update remote players
    this.updateRemotePlayers(deltaTime);

    // Always update camera and render
    this.cameraController.update(deltaTime);
    this.renderer.render(this.scene, this.camera);
  }

  spawnExplosion(target) {
    const position = target.getPosition();
    position.y += PLAYER.HEIGHT / 2;
    const teamId = this.missile.teamId;

    // Try to get from pool
    let explosion;
    const pool = this.explosionPools[teamId];

    if (pool && pool.length > 0) {
      explosion = pool.pop();
      explosion.reset(position);
    } else {
      explosion = new Explosion(position, teamId);
    }

    this.explosions.push(explosion);
    this.scene.add(explosion.getMesh());
  }

  spawnDeflectEffect(deflector) {
    // Position at deflector's eye level
    const position = deflector.getPosition();
    position.y += PLAYER.HEIGHT * 0.75;

    // Direction the deflector is facing
    const direction = deflector.getForwardDirection();

    // Team ID for coloring
    const teamId = deflector.team;

    const effect = new DeflectEffect(position, direction, teamId);
    this.deflectEffects.push(effect);
    this.scene.add(effect.getMesh());
  }

  updateExplosions(deltaTime) {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const explosion = this.explosions[i];
      explosion.update(deltaTime);
      if (explosion.isDone()) {
        this.scene.remove(explosion.getMesh());

        // Return to pool
        const teamId = explosion.teamId;
        if (this.explosionPools[teamId]) {
          this.explosionPools[teamId].push(explosion);
        } else {
          explosion.dispose();
        }

        this.explosions.splice(i, 1);
      }
    }
  }

  updateDeflectEffects(deltaTime) {
    for (let i = this.deflectEffects.length - 1; i >= 0; i--) {
      const effect = this.deflectEffects[i];
      effect.update(deltaTime);
      if (effect.isDone()) {
        this.scene.remove(effect.getMesh());
        effect.dispose();
        this.deflectEffects.splice(i, 1);
      }
    }
  }

  updateRemotePlayers(deltaTime) {
    Object.values(this.remotePlayers).forEach((rp) => {
      rp.update(deltaTime);
    });
  }

  updateGameplay(deltaTime) {
    // Update player with arena for collision bounds
    this.player.update(deltaTime, this.arena);

    // Update bots (pass missile position for AI tracking)
    const missilePos = this.missile.isActive
      ? this.missile.getPosition()
      : null;

    this.bots.forEach((b) => b.update(deltaTime, missilePos, this.arena));

    // Update missile (both host and client update for smooth rendering)
    if (this.missile.isActive) {
      this.missile.update(deltaTime, this.arena);
    }

    // Collision: only run on host in multiplayer (or always in single player)
    const isMultiplayer = Object.keys(this.remotePlayers).length > 0;
    if (!isMultiplayer || NetworkManager.isHost) {
      this.collisionSystem.update();
    }

    // Client deflect: send attempt to host when deflect key is pressed
    if (isMultiplayer && !NetworkManager.isHost) {
      if (this.player.isDeflecting && this.missile.isActive) {
        NetworkManager.sendDeflectAttempt({
          position: {
            x: this.player.position.x,
            y: this.player.position.y,
            z: this.player.position.z,
          },
          facingDirection: {
            x: this.player.facingDirection.x,
            y: this.player.facingDirection.y,
            z: this.player.facingDirection.z,
          },
        });
      }
    }

    // Network update (Send local player state)
    this.networkUpdateTimer += deltaTime;
    if (this.networkUpdateTimer > 0.05) {
      // 20 times per second
      NetworkManager.sendMovement(this.player.position, this.player.rotationY);

      // If host: send authoritative missile state + current target ID
      if (NetworkManager.isHost && this.missile.isActive) {
        NetworkManager.sendMissileUpdate({
          x: this.missile.position.x,
          y: this.missile.position.y,
          z: this.missile.position.z,
          vx: this.missile.velocity.x,
          vy: this.missile.velocity.y,
          vz: this.missile.velocity.z,
          speed: this.missile.speed,
          targetId: this.missile.target ? this.missile.target.id : null,
          teamId: this.missile.teamId,
        });
      }

      this.networkUpdateTimer = 0;
    }
  }

  start() {
    this.isRunning = true;
    this.clock.start();
    this.animate();
  }

  stop() {
    this.isRunning = false;
  }

  animate() {
    if (!this.isRunning) return;

    requestAnimationFrame(() => this.animate());

    let deltaTime = this.clock.getDelta();
    deltaTime = Math.min(deltaTime, 0.05);

    const state = this.gameStateManager.getState();

    this.arena.update(deltaTime);

    switch (state) {
      case GAME_STATES.MENU:
        break;
      case GAME_STATES.COUNTDOWN:
        this.gameStateManager.updateCountdown(deltaTime, this.audioManager);
        this.player.update(deltaTime, this.arena);
        break;
      case GAME_STATES.PLAYING:
        this.updateGameplay(deltaTime);
        break;
      case GAME_STATES.PAUSED:
        break;
      case GAME_STATES.ROUND_END:
        break;
      case GAME_STATES.MATCH_END:
        break;
    }

    // Update explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const explosion = this.explosions[i];
      explosion.update(deltaTime);
      if (explosion.isFinished) {
        explosion.mesh.visible = false;
        this.explosions.splice(i, 1);

        // Return to pool
        const type = explosion.color === 0xffff00 ? "bot" : "player"; // Crude check, improved if we store type
        if (this.explosionPools[type])
          this.explosionPools[type].push(explosion);
      }
    }

    // Update deflect effects
    for (let i = this.deflectEffects.length - 1; i >= 0; i--) {
      const effect = this.deflectEffects[i];
      effect.update(deltaTime);
      if (effect.isFinished) {
        this.deflectEffects.splice(i, 1);
        effect.dispose();
      }
    }

    // Check collisions
    this.collisionSystem.update();

    // Update remote players
    this.updateRemotePlayers(deltaTime);

    // Network updates (e.g., 60 times per second for smooth movement)
    this.networkUpdateTimer += deltaTime;
    // 60Hz = ~0.016s
    const NETWORK_TICK_RATE = 0.016;

    if (this.networkUpdateTimer >= NETWORK_TICK_RATE) {
      // Subtract tick rate to maintain time accuracy (fix drift)
      this.networkUpdateTimer -= NETWORK_TICK_RATE;

      // Send movement if changed (optimization can be added here)
      NetworkManager.sendMovement(
        this.player.mesh.position,
        this.player.mesh.rotation.y,
      );

      // If we are host, we are authority on missile
      if (NetworkManager.isHost && this.missile.isActive) {
        NetworkManager.sendMissileUpdate({
          x: this.missile.position.x,
          y: this.missile.position.y,
          z: this.missile.position.z,
          vx: this.missile.velocity.x,
          vy: this.missile.velocity.y,
          vz: this.missile.velocity.z,
          speed: this.missile.speed,
        });
      }
    }

    // Camera update
    this.cameraController.update(deltaTime);

    // Render
    this.renderer.render(this.scene, this.camera);
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
    this.bots.forEach((b) => b.dispose());
    this.missile.dispose();

    // Dispose explosions
    for (const explosion of this.explosions) {
      explosion.dispose();
    }
    this.explosions = [];

    // Dispose explosion pools
    for (const pool of Object.values(this.explosionPools)) {
      for (const explosion of pool) {
        explosion.dispose();
      }
    }
    this.explosionPools = { player: [], bot: [] };

    // Dispose deflect effects
    for (const effect of this.deflectEffects) {
      effect.dispose();
    }
    this.deflectEffects = [];

    // Dispose systems
    this.collisionSystem.dispose();
    this.roundManager.dispose();

    // Dispose UI
    this.uiManager.dispose();

    // Dispose cached assets
    AssetManager.dispose();

    // Clear global events
    globalEvents.clear();
  }

  initNetwork() {
    NetworkManager.connect();

    NetworkManager.on("onConnect", (id) => {
      console.log("Connected to multiplayer server!", id);
      // Wait for user to create/join room via UI
    });

    // Room Events
    NetworkManager.on("onCurrentPlayers", (players) => {
      // If we are in lobby, update UI
      if (this.currentRoomId) {
        this.uiManager.updateLobby(players);

        // Also sync in-game if playing
        Object.values(players).forEach((p) => {
          if (p.id !== NetworkManager.socket.id) {
            this.addRemotePlayer(p);
          }
        });
      }
    });

    // Listen for game start
    NetworkManager.on("onGameStarted", (data) => {
      console.log(
        "[Game] RECEIVED game_started event!",
        data ? "has data" : "no data",
      );
      this.startGame(data);
    });

    NetworkManager.on("onPlayerJoined", (player) => {
      console.log("Remote player joined:", player);

      // Update Lobby
      if (this.currentRoomId) {
        // Re-fetch full list or just append (server sends full list on join usually, but for single event we might need to manually add)
        // For simplicity, we trust onCurrentPlayers which usually follows or we can just trigger a refresh
      }

      if (player.id !== NetworkManager.socket.id) {
        this.addRemotePlayer(player);
      }
    });

    NetworkManager.on("onPlayerMoved", (data) => {
      const remotePlayer = this.remotePlayers[data.id];
      if (remotePlayer) {
        remotePlayer.updateState(data);
      }
    });

    NetworkManager.on("onPlayerDisconnected", (id) => {
      console.log("Player disconnected:", id);
      this.removeRemotePlayer(id);
    });

    // Missile synchronization
    NetworkManager.on("onMissileUpdate", (data) => {
      // Client accepts authoritative state from host
      if (!NetworkManager.isHost && this.missile.isActive) {
        this.missile.position.set(data.x, data.y, data.z);
        this.missile.velocity.set(data.vx, data.vy, data.vz);
        this.missile.speed = data.speed;

        // Sync target by ID
        if (
          data.targetId &&
          (!this.missile.target || this.missile.target.id !== data.targetId)
        ) {
          const target = this.resolveEntityById(data.targetId);
          if (target) {
            this.missile.setTarget(target);
            if (data.teamId) this.missile.setTeam(data.teamId);
          }
        }

        if (this.missile.mesh) {
          this.missile.mesh.position.copy(this.missile.position);
        }
      }
    });

    // Handle remote deflections (visuals + logic)
    NetworkManager.on("onMissileDeflected", (data) => {
      let deflector = null;
      if (data.deflectorId === NetworkManager.socket.id) {
        deflector = this.player;
      } else if (this.remotePlayers[data.deflectorId]) {
        deflector = this.remotePlayers[data.deflectorId];
      }

      if (deflector) {
        this.spawnDeflectEffect(deflector);
        this.audioManager.play("pulse");
      }
    });

    // --- Host-Authoritative Events ---

    // Round state from host (missile_spawn, round_end)
    NetworkManager.on("onRoundState", (data) => {
      console.log("[Game] Received round_state:", data);

      if (data.type === "missile_spawn") {
        // Host tells us who the missile targets
        const target = this.resolveEntityById(data.targetId);
        if (target) {
          this.missile.spawn(target, data.missileTeam);
          target.setTargeted(true);
          if (target === this.player && this.audioManager) {
            this.audioManager.play("targeted");
          }
          globalEvents.emit(EVENTS.MISSILE_SPAWN, {
            target: target === this.player ? "player" : "opponent",
          });
        }
      } else if (data.type === "round_end") {
        // Host tells us who won — apply locally
        const winner = data.winner;
        this.missile.reset();
        this.missile.hide();
        if (this.player) this.player.setMovementLocked(true);

        // Sync scores from host
        if (data.scores) {
          this.gameStateManager.playerScore = data.scores.blue;
          this.gameStateManager.botScore = data.scores.red;
        }

        // Determine winner relative to local player's team
        const localTeam = this.player.team;
        const localWon = winner === localTeam;
        // We still pass the team to endRound, but we override the score
        // because the host already told us the correct scores.
        // GameStateManager.endRound increments scores, so we set them
        // BEFORE calling endRound and let it increment — actually that
        // would double count. Instead, set scores AFTER endRound.
        // Let's just call endRound and then fix scores.
        this.gameStateManager.endRound(winner, this.audioManager);
        // Override with host-authoritative scores
        if (data.scores) {
          this.gameStateManager.playerScore = data.scores.blue;
          this.gameStateManager.botScore = data.scores.red;
        }
      }
    });

    // Player hit from host — apply damage on client
    NetworkManager.on("onPlayerHit", (data) => {
      console.log("[Game] Received player_hit:", data);
      const target = this.resolveEntityById(data.targetId);
      if (target) {
        target.takeDamage(data.damage);
        if (this.audioManager) this.audioManager.play("explosion");
        this.spawnExplosion(target);
        this.missile.reset();
      }
    });

    // Deflect attempt from client — only received by host
    NetworkManager.on("onDeflectAttempt", (data) => {
      console.log("[Game] Received deflect_attempt from:", data.playerId);
      if (!NetworkManager.isHost) return;

      const remotePlayer = this.remotePlayers[data.playerId];
      if (!remotePlayer || !remotePlayer.isAlive) return;
      if (!this.missile.isActive) return;

      // Check if the missile is targeting THIS remote player
      if (this.missile.target !== remotePlayer) return;

      // Check if missile is close enough and in front of the remote player
      // Use the position/facing data from the client
      const rPos = remotePlayer.position;
      const missilePos = this.missile.getPosition();
      const dist = rPos.distanceTo(missilePos);

      // Simple proximity + facing check
      if (dist < 5) {
        // Deflect succeeded — handle it through the collision system
        this.collisionSystem.handleDeflection(remotePlayer);

        // Broadcast deflection to all clients
        NetworkManager.sendMissileDeflect({
          deflectorId: data.playerId,
          newTargetId: this.missile.target ? this.missile.target.id : null,
        });
      }
    });

    // Listen for team changes in lobby
    NetworkManager.on("onPlayerTeamChanged", (player) => {
      console.log("Player team changed:", player);
      if (this.currentRoomId) {
        this.uiManager.updateLobby(
          NetworkManager.connectedPlayers,
          this.currentRoomSettings,
        );
      }
      if (player.id === NetworkManager.socket.id) {
        this.player.team = player.team;
      } else if (this.remotePlayers[player.id]) {
        this.remotePlayers[player.id].team = player.team;
      }
    });

    NetworkManager.on("onRoomSettingsUpdated", (settings) => {
      console.log("Room settings updated:", settings);
      if (this.currentRoomId) {
        this.currentRoomSettings = settings;
        this.uiManager.updateLobby(NetworkManager.connectedPlayers, settings);
      }
    });
  }

  addRemotePlayer(data) {
    if (this.remotePlayers[data.id]) return;

    console.log("Adding remote player entity:", data.id, data);
    const rp = new RemotePlayer(data.id, data);
    this.remotePlayers[data.id] = rp;
    this.scene.add(rp.getMesh());

    if (rp.getMesh()) {
      rp.getMesh().visible = true;
      console.log("Remote player mesh added to scene at", rp.position);
    } else {
      console.error("Remote player mesh creation failed!");
    }
  }

  /**
   * Resolve an entity by ID — local player, bot, or remote player.
   */
  resolveEntityById(id) {
    if (this.player && this.player.id === id) return this.player;
    if (NetworkManager.socket && id === NetworkManager.socket.id)
      return this.player;
    if (this.remotePlayers[id]) return this.remotePlayers[id];
    const bot = this.bots.find((b) => b.id === id);
    if (bot) return bot;
    return null;
  }

  removeRemotePlayer(id) {
    if (this.remotePlayers && this.remotePlayers[id]) {
      const rp = this.remotePlayers[id];
      this.scene.remove(rp.getMesh());
      rp.dispose();
      delete this.remotePlayers[id];
    }
  }

  setupLobbyEvents() {
    // Create Room
    document
      .getElementById("btn-create-room")
      .addEventListener("click", async () => {
        const settings = {
          maxPlayers: 4,
        };

        console.log("Creating room with settings:", settings);
        const result = await NetworkManager.createRoom(settings);
        console.log("createRoom result:", result);

        if (result.success) {
          this.currentRoomId = result.roomId;
          this.uiManager.showLobby(result.roomId, true);

          // Force update ui with cached players (in case event beat us here)
          console.log(
            "Updating lobby with players:",
            NetworkManager.connectedPlayers,
          );
          this.uiManager.updateLobby(NetworkManager.connectedPlayers);

          // Send player info
          const nickname =
            localStorage.getItem("dodgeball_nickname") ||
            "Player " + NetworkManager.socket.id.substr(0, 4);
          NetworkManager.sendPlayerData({
            name: nickname,
            x: 0,
            y: 0,
            z: 0,
            rotation: 0,
          });
        }
      });

    // Join Room
    document
      .getElementById("btn-join-room")
      .addEventListener("click", async () => {
        const code = document
          .getElementById("input-room-code")
          .value.toUpperCase();
        if (!code) return;

        const result = await NetworkManager.joinRoom(code);
        if (result.success) {
          this.currentRoomId = result.room.id;
          this.uiManager.showLobby(result.room.id, false);

          // Force update ui with cached players
          this.uiManager.updateLobby(NetworkManager.connectedPlayers);

          // Send player info
          const nickname =
            localStorage.getItem("dodgeball_nickname") ||
            "Player " + NetworkManager.socket.id.substr(0, 4);
          NetworkManager.sendPlayerData({
            name: nickname,
            x: 0,
            y: 0,
            z: 0,
            rotation: 0,
          });

          // Add existing players to scene
          Object.values(NetworkManager.connectedPlayers).forEach((p) => {
            if (p.id !== NetworkManager.socket.id) {
              this.addRemotePlayer(p);
            }
          });
        } else {
          alert("Error joining room: " + result.error);
        }
      });

    // Leave Room
    document.getElementById("btn-lobby-leave").addEventListener("click", () => {
      window.location.reload(); // Simple way to reset state for now
    });

    // Start Game (Host only)
    document.getElementById("btn-lobby-start").addEventListener("click", () => {
      // Tell server to start game
      NetworkManager.startGame();
    });
  }
}
