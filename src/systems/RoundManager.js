import * as THREE from 'three';
import { globalEvents } from '../utils/EventEmitter.js';
import { EVENTS, GAME_STATES, TEAMS } from '../utils/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * RoundManager
 * Manages round setup, spawning, and round flow
 */

export class RoundManager {
  constructor(gameStateManager, audioManager) {
    this.gameStateManager = gameStateManager;
    this.audioManager = audioManager;

    this.player = null;
    this.bot = null;
    this.missile = null;
    this.arena = null;

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Listen for death events to check round end
    globalEvents.on(EVENTS.PLAYER_DEATH, () => this.checkRoundEnd());
    globalEvents.on(EVENTS.MISSILE_HIT, (data) => this.onMissileHit(data));
    globalEvents.on(EVENTS.MISSILE_DEFLECT, () => this.onDeflection());
  }

  /**
   * Set entities
   */
  setEntities(player, bot, missile, arena) {
    this.player = player;
    this.bot = bot;
    this.missile = missile;
    this.arena = arena;

    // Listen for entity death events
    player.on('death', () => this.onPlayerDeath());
    bot.on('death', () => this.onBotDeath());
  }

  /**
   * Setup a new round
   */
  setupRound() {
    // Get spawn positions from arena
    const spawnPositions = this.arena.getSpawnPositions();

    // Reset player
    this.player.reset(spawnPositions.player);

    // Reset bot
    this.bot.reset(spawnPositions.bot);

    // Reset missile (will be spawned after countdown)
    this.missile.reset();
    this.missile.hide();
  }

  /**
   * Spawn missile and start round
   */
  startRoundGameplay() {
    // Randomly select initial target
    const targets = [this.player, this.bot];
    const initialTarget = MathUtils.randomElement(targets);

    // Spawn missile
    const initialTeam = initialTarget === this.player ? TEAMS.BOT : TEAMS.PLAYER;
    this.missile.spawn(initialTarget, initialTeam);

    // Set target indicator
    initialTarget.setTargeted(true);

    // Play targeted sound for player
    if (initialTarget === this.player && this.audioManager) {
      this.audioManager.play('targeted');
    }

    globalEvents.emit(EVENTS.MISSILE_SPAWN, {
      target: initialTarget === this.player ? 'player' : 'bot',
    });
  }

  /**
   * Handle missile hit event
   */
  onMissileHit(data) {
    // Check if the hit resulted in a death (round end)
    // We check if both are alive because if one died, the round end logic will handle it
    if (!this.areBothAlive()) return;

    const hitEntity = data.target;

    // Requirement: "Le missile choisira forcément l'équipe adverse au joueur qui a été touché en dernier."
    // (The missile will choose the team opposite to the player who was last hit)
    // If Player was hit -> Opposite is Bot Team -> Missile belongs to Bot -> Targets Player
    // If Bot was hit -> Opposite is Player Team -> Missile belongs to Player -> Targets Bot
    
    const newTeam = hitEntity === this.player ? TEAMS.BOT : TEAMS.PLAYER;
    const newTarget = hitEntity; 

    // Spawn new missile immediately
    this.missile.spawn(newTarget, newTeam);

    // Update target indicator
    newTarget.setTargeted(true);

    // Play sound if player is targeted
    if (newTarget === this.player && this.audioManager) {
      this.audioManager.play('targeted');
    }

    globalEvents.emit(EVENTS.MISSILE_SPAWN, {
      target: newTarget === this.player ? 'player' : 'bot',
    });
  }

  /**
   * Handle deflection event
   */
  onDeflection() {
    this.gameStateManager.recordDeflection();

    // If new target is player, play warning sound
    if (this.missile.target === this.player && this.audioManager) {
      this.audioManager.play('targeted');
    }
  }

  /**
   * Handle player death
   */
  onPlayerDeath() {
    if (this.gameStateManager.isState(GAME_STATES.PLAYING)) {
      this.gameStateManager.endRound('bot', this.audioManager);
    }
  }

  /**
   * Handle bot death
   */
  onBotDeath() {
    if (this.gameStateManager.isState(GAME_STATES.PLAYING)) {
      this.gameStateManager.endRound('player', this.audioManager);
    }
  }

  /**
   * Check if round should end
   */
  checkRoundEnd() {
    if (!this.gameStateManager.isState(GAME_STATES.PLAYING)) return;

    if (!this.player.isAlive) {
      this.gameStateManager.endRound('bot', this.audioManager);
    } else if (!this.bot.isAlive) {
      this.gameStateManager.endRound('player', this.audioManager);
    }
  }

  /**
   * Get current target entity
   */
  getCurrentTarget() {
    return this.missile?.target || null;
  }

  /**
   * Check if both entities are alive
   */
  areBothAlive() {
    return this.player?.isAlive && this.bot?.isAlive;
  }

  dispose() {
    globalEvents.removeAllListeners(EVENTS.PLAYER_DEATH);
    globalEvents.removeAllListeners(EVENTS.MISSILE_HIT);
    globalEvents.removeAllListeners(EVENTS.MISSILE_DEFLECT);
  }
}
