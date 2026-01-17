import { Game } from './Game.js';

/**
 * Dodgeball Masters - Entry Point
 * Training Mode: Practice against an AI bot
 */

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  // Get canvas element
  const canvas = document.getElementById('game-canvas');

  if (!canvas) {
    console.error('Canvas element not found!');
    return;
  }

  // Create and start game
  const game = new Game(canvas);
  game.start();

  // Expose game instance for debugging (development only)
  if (import.meta.env?.DEV) {
    window.game = game;
  }

  // Handle page visibility change (pause when tab is hidden)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Could auto-pause here if desired
    }
  });

  // Prevent default browser behaviors that might interfere
  window.addEventListener('keydown', (e) => {
    // Prevent spacebar from scrolling
    if (e.code === 'Space' && e.target === document.body) {
      e.preventDefault();
    }
  });

  console.log('Dodgeball Masters - Training Mode');
  console.log('Controls: WASD to move, SPACE to jump, RIGHT CLICK to deflect, ESC to pause');
});
