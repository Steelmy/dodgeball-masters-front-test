import * as THREE from "three";
import { globalEvents } from "../utils/EventEmitter.js";
import { EVENTS, GAME_STATES, TEAMS } from "../utils/Constants.js";
import { MathUtils } from "../utils/MathUtils.js";

/**
 * RoundManager
 * Manages round setup, spawning, and round flow.
 *
 * In multiplayer the HOST runs authoritative game logic and broadcasts
 * events to clients. Clients apply events from the host.
 */
export class RoundManager {
  constructor(gameStateManager, audioManager) {
    this.gameStateManager = gameStateManager;
    this.audioManager = audioManager;

    this.player = null;
    this.bots = [];
    this.remotePlayers = {};
    this.missile = null;
    this.arena = null;

    // Network authority
    this.isMultiplayer = false;
    this.isHost = false;

    // Broadcast callback — set by Game.js to wire into NetworkManager
    this.onBroadcast = null; // (eventType, data) => void

    this.setupEventListeners();
  }

  setupEventListeners() {
    globalEvents.on(EVENTS.PLAYER_DEATH, () => this.checkRoundEnd());
    globalEvents.on(EVENTS.MISSILE_HIT, (data) => this.onMissileHit(data));
    globalEvents.on(EVENTS.MISSILE_DEFLECT, () => this.onDeflection());
  }

  /**
   * Set entities
   */
  setEntities(player, bots, remotePlayers, missile, arena) {
    this.player = player;
    this.bots = bots || [];
    this.remotePlayers = remotePlayers || {};
    this.missile = missile;
    this.arena = arena;

    // Listen for entity death events
    if (this.player) this.player.on("death", () => this.onPlayerDeath());
    this.bots.forEach((b) => b.on("death", () => this.onBotDeath(b)));
    Object.values(this.remotePlayers).forEach((rp) =>
      rp.on("death", () => this.checkRoundEnd()),
    );
  }

  /**
   * Configure for multiplayer
   */
  setMultiplayerMode(isHost) {
    this.isMultiplayer = true;
    this.isHost = isHost;
  }

  /**
   * Setup a new round
   */
  setupRound() {
    const spawnPositions = this.arena.getSpawnPositions();

    const blueTeam = [];
    const redTeam = [];

    const assignTeam = (entity) => {
      if (entity.team === TEAMS.BLUE) blueTeam.push(entity);
      else redTeam.push(entity);
    };

    if (this.player) assignTeam(this.player);
    this.bots.forEach(assignTeam);
    Object.values(this.remotePlayers).forEach(assignTeam);

    const positionEntity = (entity, teamIndex, teamSide) => {
      const baseSpawn =
        teamSide === TEAMS.BLUE ? spawnPositions.player : spawnPositions.bot;

      const pos = {
        position: { ...baseSpawn.position },
        rotation: baseSpawn.rotation,
      };

      const spacing = 2.5;
      let offsetX = 0;
      if (teamIndex > 0) {
        offsetX =
          Math.ceil(teamIndex / 2) * spacing * (teamIndex % 2 === 0 ? -1 : 1);
      }
      pos.position.x += offsetX;

      if (entity.reset) {
        entity.reset(pos);
      } else {
        if (entity.setPosition)
          entity.setPosition(pos.position.x, 0, pos.position.z);
        if (entity.mesh) entity.mesh.rotation.y = pos.rotation;
      }
    };

    blueTeam.forEach((e, i) => positionEntity(e, i, TEAMS.BLUE));
    redTeam.forEach((e, i) => positionEntity(e, i, TEAMS.RED));

    this.missile.reset();
    this.missile.hide();
  }

  /**
   * Start a match
   */
  startMatch() {
    this.setupRound();
    setTimeout(() => {
      this.startRoundGameplay();
    }, 100);
  }

  /**
   * Spawn missile and start round.
   * In multiplayer: only the HOST picks the target and broadcasts it.
   */
  startRoundGameplay() {
    if (this.isMultiplayer && !this.isHost) {
      // Client waits for host to tell us who the target is
      return;
    }

    const targets = [];
    if (this.player) targets.push(this.player);
    this.bots.forEach((b) => targets.push(b));
    Object.values(this.remotePlayers).forEach((rp) => targets.push(rp));

    if (targets.length === 0) return;

    const initialTarget = MathUtils.randomElement(targets);
    const initialTeam =
      initialTarget.team === TEAMS.BLUE ? TEAMS.RED : TEAMS.BLUE;

    this.missile.spawn(initialTarget, initialTeam);
    initialTarget.setTargeted(true);

    if (initialTarget === this.player && this.audioManager) {
      this.audioManager.play("targeted");
    }

    globalEvents.emit(EVENTS.MISSILE_SPAWN, {
      target: initialTarget === this.player ? "player" : "opponent",
    });

    // Broadcast to clients: missile spawned with this target
    if (this.isMultiplayer && this.isHost && this.onBroadcast) {
      this.onBroadcast("round_state", {
        type: "missile_spawn",
        targetId: initialTarget.id,
        missileTeam: initialTeam,
      });
    }
  }

  /**
   * Handle missile hit event — ONLY runs on host in multiplayer.
   * NOTE: CollisionSystem already applied damage and hid the missile.
   * We handle: broadcasting, audio, respawn logic.
   */
  onMissileHit(data) {
    if (this.isMultiplayer && !this.isHost) return;

    const { target } = data;

    // Broadcast hit to clients (damage already applied locally by CollisionSystem)
    if (this.isMultiplayer && this.onBroadcast) {
      this.onBroadcast("player_hit", {
        targetId: target.id,
        damage: data.damage || 100,
      });
    }

    if (this.audioManager) this.audioManager.play("explosion");

    this.missile.reset();

    // Determine new target on the SAME team as the dead player
    const newTeam = target.team === TEAMS.BLUE ? TEAMS.RED : TEAMS.BLUE;
    let newTarget = target;

    if (!newTarget.isAlive) {
      const potentialTargets = [];
      if (
        this.player &&
        this.player.isAlive &&
        this.player.team === target.team
      )
        potentialTargets.push(this.player);
      this.bots.forEach((b) => {
        if (b.isAlive && b.team === target.team) potentialTargets.push(b);
      });
      Object.values(this.remotePlayers).forEach((rp) => {
        if (rp.isAlive && rp.team === target.team) potentialTargets.push(rp);
      });

      if (potentialTargets.length > 0) {
        newTarget = MathUtils.randomElement(potentialTargets);
      } else {
        // Team wiped — checkRoundEnd will handle
        return;
      }
    }

    if (newTarget.isAlive) {
      setTimeout(() => {
        if (this.gameStateManager.getState() === GAME_STATES.PLAYING) {
          this.missile.spawn(newTarget, newTeam);
          newTarget.setTargeted(true);

          globalEvents.emit(EVENTS.MISSILE_SPAWN, {
            target: newTarget === this.player ? "player" : "opponent",
          });

          if (newTarget === this.player && this.audioManager) {
            this.audioManager.play("targeted");
          }

          // Broadcast new target
          if (this.isMultiplayer && this.onBroadcast) {
            this.onBroadcast("round_state", {
              type: "missile_spawn",
              targetId: newTarget.id,
              missileTeam: newTeam,
            });
          }
        }
      }, 500);
    }
  }

  onDeflection() {
    this.gameStateManager.recordDeflection();
    if (this.missile.target === this.player && this.audioManager) {
      this.audioManager.play("targeted");
    }
  }

  onPlayerDeath() {
    if (this.audioManager) this.audioManager.play("death");
    this.checkRoundEnd();
  }

  onBotDeath(bot) {
    if (this.audioManager) this.audioManager.play("death");
    this.checkRoundEnd();
  }

  /**
   * Check if round should end — only HOST decides in multiplayer
   */
  checkRoundEnd() {
    if (this.isMultiplayer && !this.isHost) return;
    if (this.gameStateManager.getState() !== GAME_STATES.PLAYING) return;

    let blueAlive = 0;
    let redAlive = 0;

    const checkEntity = (ent) => {
      if (ent && ent.isAlive) {
        if (ent.team === TEAMS.BLUE) blueAlive++;
        else if (ent.team === TEAMS.RED) redAlive++;
      }
    };

    checkEntity(this.player);
    this.bots.forEach(checkEntity);
    Object.values(this.remotePlayers).forEach(checkEntity);

    if (blueAlive === 0) {
      this.endRound(TEAMS.RED);
    } else if (redAlive === 0) {
      this.endRound(TEAMS.BLUE);
    }
  }

  endRound(winner) {
    this.missile.reset();
    this.missile.hide();

    if (this.player) this.player.setMovementLocked(true);

    this.gameStateManager.endRound(winner);

    // Broadcast round end to clients
    if (this.isMultiplayer && this.isHost && this.onBroadcast) {
      this.onBroadcast("round_state", {
        type: "round_end",
        winner: winner,
        scores: {
          blue: this.gameStateManager.playerScore,
          red: this.gameStateManager.botScore,
        },
      });
    }
  }

  getCurrentTarget() {
    return this.missile?.target || null;
  }

  dispose() {
    globalEvents.removeAllListeners(EVENTS.PLAYER_DEATH);
    globalEvents.removeAllListeners(EVENTS.MISSILE_HIT);
    globalEvents.removeAllListeners(EVENTS.MISSILE_DEFLECT);
  }
}
