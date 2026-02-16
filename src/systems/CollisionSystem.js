import { MISSILE, PLAYER } from "../utils/Constants.js";
import { MathUtils } from "../utils/MathUtils.js";
import { globalEvents } from "../utils/EventEmitter.js";
import { EVENTS } from "../utils/Constants.js";

/**
 * CollisionSystem
 * Handles collision detection and deflection logic
 */

export class CollisionSystem {
  constructor(audioManager) {
    this.audioManager = audioManager;
    this.player = null;
    this.others = []; // Array of {bots, remotePlayers}
    this.missile = null;
  }

  /**
   * Set entities to track
   * @param {Player} player - Local player
   * @param {Array} others - Array of other entities (Bots, RemotePlayers)
   * @param {Missile} missile - The ball
   */
  setEntities(player, others, missile) {
    this.player = player;
    this.others = others || [];
    this.missile = missile;
  }

  /**
   * Update collision checks (called every frame)
   */
  update() {
    if (!this.missile || !this.missile.isActive) return;

    // 1. Check Deflections
    const target = this.missile.target;

    if (target && target.isAlive) {
      // Is target the local player?
      if (target === this.player) {
        if (this.player.tryDeflect(this.missile)) {
          this.handleDeflection(this.player);
        }
      }
      // Is target in our "others" list? (Bot or RemotePlayer)
      else if (this.others.includes(target)) {
        // If it's a BOT, we might run its deflection logic here IF we are the host?
        // Or if Bot logic runs in Bot.update(), we just need to detect if it deflected?
        // Bot.tryDeflect() is stateful (checks cooldowns), so calling it here is fine.
        // RemotePlayers don't deflect locally usually (server handles it), but for visual prediction we might?
        // For now, assume Bots are local-controlled by this client (if Host) or we just check mechanism.

        if (target.tryDeflect && target.tryDeflect(this.missile)) {
          this.handleDeflection(target);
        }
      }
    }

    // 2. Check Collisions (Hits)
    this.checkMissileCollision();
  }

  /**
   * Handle deflection
   */
  handleDeflection(deflector) {
    // Find a new target (someone else who is alive and different team usually)
    // For simplicity: any alive entity that is NOT the deflector.
    // Ideally: prioritize enemies.

    const candidates = [this.player, ...this.others].filter(
      (e) => e !== deflector && e.isAlive && e.team !== deflector.team, // Try to target opposite team
    );

    // If no enemies, target anyone else (friendly fire? maybe not)
    // If empty, random alive
    let possibleTargets = candidates;
    if (possibleTargets.length === 0) {
      possibleTargets = [this.player, ...this.others].filter(
        (e) => e !== deflector && e.isAlive,
      );
    }

    if (possibleTargets.length === 0) return; // No one left to target

    const newTarget =
      possibleTargets[Math.floor(Math.random() * possibleTargets.length)];

    // Apply deflection
    this.missile.deflect(newTarget);
    this.missile.setTeam(deflector.team);
    this.missile.startDrag(deflector);

    // Update indicators
    if (deflector.setTargeted) deflector.setTargeted(false);
    if (newTarget.setTargeted) newTarget.setTargeted(true);

    // Sound
    if (this.audioManager) {
      this.audioManager.play("deflect");
      if (deflector !== this.player) {
        this.audioManager.play("pulse");
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
    const targetPos = this.missile.target.getPosition();
    targetPos.y += PLAYER.HEIGHT / 2;

    // Use continuous collision detection (segment vs sphere) to prevent tunneling
    const distance = MathUtils.distanceToSegment(
      targetPos,
      missilePrevPos,
      missilePos,
    );
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
    if (target.takeDamage) target.takeDamage(damage);

    // Play sound
    if (this.audioManager) {
      this.audioManager.play("hit");
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
    this.others = [];
    this.missile = null;
  }
}
