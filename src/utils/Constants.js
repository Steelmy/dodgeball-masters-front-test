/**
 * Game Constants
 * Central configuration for all game parameters
 */

export const GAME = {
  ROUNDS_TO_WIN: 10,
  ROUND_START_DELAY: 3000, // ms before round starts
  ROUND_END_DELAY: 2000,   // ms after round ends
};

export const PLAYER = {
  MAX_HEALTH: 100,
  MOVE_SPEED: 10,
  RADIUS: 0.3,
  HEIGHT: 1.35,
  JUMP_FORCE: 12,
  GRAVITY: 30,
};

export const BOT = {
  DEFLECT_RANGE: 6,
  PERFECT_DEFLECTION: true, // Bot never misses in training mode
};

export const MISSILE = {
  BASE_SPEED: 5,
  SPEED_INCREMENT: 5,
  MAX_SPEED: 0,

  TURN_RATE: 0.12,
  TURN_RATE_INCREMENT: 0,
  MAX_TURN_RATE: 0.12,

  BASE_DAMAGE: 50,
  DAMAGE_INCREMENT: 50,

  RADIUS: 0.3,
  SPAWN_HEIGHT: 5,
};

export const DEFLECTION = {
  RANGE: 8,
  CONE_ANGLE: Math.PI / 5, // 36 degrees cone
  COOLDOWN: 750, // ms

  // Drag mechanic - control missile direction after deflect
  DRAG_DURATION: 100,      // ms - window to influence direction
  DRAG_STRENGTH: 5,        // How much mouse movement affects direction
  DRAG_MAX_FORCE: 5,       // Max force per frame (limits fast mouse movements)
};

export const ARENA = {
  RADIUS: 35,          // Circular arena radius (larger)
  WALL_HEIGHT: 4,
  WATER_SIZE: 150,     // Size of water plane
};

export const CAMERA = {
  FOV: 60,
  NEAR: 0.1,
  FAR: 1000,
  INITIAL_POSITION: { x: 0, y: 10, z: 20 },
  LOOK_AT: { x: 0, y: 0, z: 0 },
};

export const COLORS = {
  PLAYER: 0x3498db, // Blue
  BOT: 0xff8c00,    // Dark Orange
  MISSILE: 0xffffff, // White (neutral/unused)
  MISSILE_TRAIL: 0xffffff,
  TEAM_PLAYER: 0x3498db,
  TEAM_BOT: 0xff8c00,
  ARENA_FLOOR: 0xf5f5f5,
  ARENA_WALL: 0xe0e0e0,
  ARENA_LINE: 0x3498db,
  WATER: 0x006994,
  SKY: 0x87ceeb,
  TARGET_INDICATOR: 0xff0000,
  DEFLECT_ZONE: 0x00ff00,
};

export const TEAMS = {
  PLAYER: 'player',
  BOT: 'bot',
};

export const GAME_STATES = {
  MENU: 'menu',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  ROUND_END: 'round_end',
  MATCH_END: 'match_end',
  PAUSED: 'paused',
};

export const EVENTS = {
  // Game flow
  GAME_START: 'game:start',
  GAME_PAUSE: 'game:pause',
  GAME_RESUME: 'game:resume',

  // Round events
  ROUND_START: 'round:start',
  ROUND_END: 'round:end',
  ROUND_COUNTDOWN: 'round:countdown',

  // Match events
  MATCH_END: 'match:end',

  // Player events
  PLAYER_DAMAGE: 'player:damage',
  PLAYER_DEATH: 'player:death',
  PLAYER_DEFLECT: 'player:deflect',

  // Missile events
  MISSILE_SPAWN: 'missile:spawn',
  MISSILE_DEFLECT: 'missile:deflect',
  MISSILE_HIT: 'missile:hit',
  MISSILE_TARGET_CHANGE: 'missile:targetChange',

  // UI events
  UI_UPDATE: 'ui:update',
};
