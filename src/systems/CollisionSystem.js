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
    if (this.player.isAlive && this.missile.target === this.player) {
      if (this.player.tryDeflect(this.missile)) {
        this.handleDeflection(this.player, this.bot);
      }
    }

    // Check deflection from bot (perfect deflection)
    if (this.bot.isAlive && this.missile.target !== this.bot) {
      // Bot also needs to be able to help defend itself when targeted
    }

    // Bot deflection when targeted
    if (this.bot.isAlive && this.missile.target === this.bot) {
      if (this.bot.tryDeflect(this.missile)) {
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

    // Switch missile team to deflector's team
    this.missile.setTeam(deflector.team);

    // Start drag mode - allows controlling direction
    this.missile.startDrag(deflector);

    // Update target indicators
    deflector.setTargeted(false);
    newTarget.setTargeted(true);

    // Play sound
    if (this.audioContext || this.audioManager) {
      this.audioManager.play('deflect');

      // If deflector is not the player (e.g. Bot), also play the pulse sound
      // (Player already plays it on right-click input)
      if (deflector !== this.player) {
        this.audioManager.play('pulse');
      }
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

    // Skip collision during grace period after deflect
    if (this.missile.isInGracePeriod()) return;

    const missilePos = this.missile.getPosition();
    const missilePrevPos = this.missile.previousPosition || missilePos;

    // Get target position and adjust to center of mass (chest height)
    // Default to base position if height not available, but Player/Bot use PLAYER.HEIGHT
    const targetPos = this.missile.target.getPosition();
    targetPos.y += (PLAYER.HEIGHT / 2);

    // Use continuous collision detection (segment vs sphere) to prevent tunneling
    const distance = MathUtils.distanceToSegment(targetPos, missilePrevPos, missilePos);
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
