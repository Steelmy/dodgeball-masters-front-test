import { Game } from './Game.js';
import { AssetManager } from './core/AssetManager.js';

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

  // Get loading screen elements
  const loadingScreen = document.getElementById('loading-screen');
  const loadingProgress = document.getElementById('loading-progress');
  const loadingText = document.getElementById('loading-text');

  /**
   * Update loading progress UI
   */
  const updateLoadingProgress = (progress) => {
    const percent = Math.round(progress * 100);
    loadingProgress.style.width = `${percent}%`;
    loadingText.textContent = `${percent}%`;
  };

  /**
   * Hide loading screen and start game
   */
  const onAssetsLoaded = () => {
    // Small delay for smooth transition
    setTimeout(() => {
      loadingScreen.style.opacity = '0';
      loadingScreen.style.transition = 'opacity 0.3s ease-out';

      setTimeout(() => {
        loadingScreen.style.display = 'none';

        // Create and start game after assets are loaded
        const game = new Game(canvas);
        game.start();

        // Expose game instance for debugging (development only)
        if (import.meta.env?.DEV) {
          window.game = game;
        }
      }, 300);
    }, 100);
  };

  // Preload all assets before starting the game
  console.log('Preloading game assets...');
  AssetManager.preloadAll(updateLoadingProgress, onAssetsLoaded);

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
