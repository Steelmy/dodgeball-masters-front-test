import { MISSILE, PLAYER } from '../utils/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';
import { globalEvents } from '../utils/EventEmitter.js';
import { EVENTS } from '../utils/Constants.js';

/**
 * CollisionSystem
 * Handles collision detection and deflection logic
 */

export class CollisionSystem {
  constructor(audioManager) {
    this.audioManager = audioManager;
    this.player = null;
    this.bot = null;
    this.missile = null;
  }

  /**
   * Set entities to track
   */
  setEntities(player, bot, missile) {
    this.player = player;
    this.bot = bot;
    this.missile = missile;
  }

  /**
   * Update collision checks (called every frame)
   */
  update() {
    if (!this.missile || !this.missile.isActive) return;

    const missilePos = this.missile.getPosition();

    // Check deflection from player
    if (this.player.isAlive && this.missile.target !== this.player) {
      if (this.player.tryDeflect(missilePos)) {
        this.handleDeflection(this.player, this.bot);
      }
    }

    // Check deflection from bot (perfect deflection)
    if (this.bot.isAlive && this.missile.target !== this.bot) {
      // Bot also needs to be able to help defend itself when targeted
    }

    // Bot deflection when targeted
    if (this.bot.isAlive && this.missile.target === this.bot) {
      if (this.bot.tryDeflect(missilePos)) {
        this.handleDeflection(this.bot, this.player);
      }
    }

    // Check missile collision with target
    this.checkMissileCollision();
  }

  /**
   * Handle deflection
   */
  handleDeflection(deflector, newTarget) {
    // Deflect missile to furthest enemy (in 1v1, it's always the other one)
    this.missile.deflect(newTarget);

    // Update target indicators
    deflector.setTargeted(false);
    newTarget.setTargeted(true);

    // Play sound
    if (this.audioManager) {
      this.audioManager.play('deflect');
    }

    // Emit event
    globalEvents.emit(EVENTS.MISSILE_DEFLECT, {
      deflector,
      newTarget,
      speed: this.missile.speed,
      damage: this.missile.damage,
    });
  }

  /**
   * Check if missile hits its target
   */
  checkMissileCollision() {
    if (!this.missile.target || !this.missile.target.isAlive) return;

    const missilePos = this.missile.getPosition();
    const targetPos = this.missile.target.getPosition();

    const distance = MathUtils.distance(missilePos, targetPos);
    const collisionThreshold = MISSILE.RADIUS + PLAYER.RADIUS;

    if (distance < collisionThreshold) {
      this.handleMissileHit(this.missile.target);
    }
  }

  /**
   * Handle missile hitting a target
   */
  handleMissileHit(target) {
    const damage = this.missile.getDamage();

    // Apply damage
    target.takeDamage(damage);

    // Play sound
    if (this.audioManager) {
      this.audioManager.play('hit');
    }

    // Hide missile
    this.missile.hide();

    // Emit event
    globalEvents.emit(EVENTS.MISSILE_HIT, {
      target,
      damage,
      deflectionCount: this.missile.deflectionCount,
    });
  }

  /**
   * Reset system
   */
  reset() {
    // Any cleanup needed between rounds
  }

  dispose() {
    this.player = null;
    this.bot = null;
    this.missile = null;
  }
}
