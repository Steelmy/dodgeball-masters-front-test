import { globalEvents } from '../utils/EventEmitter.js';
import { EVENTS, GAME_STATES } from '../utils/Constants.js';

/**
 * UIManager
 * Central manager for all UI components
 */

export class UIManager {
  constructor() {
    this.container = null;
    this.hud = null;
    this.mainMenu = null;
    this.pauseMenu = null;
    this.matchEndScreen = null;
    this.countdown = null;

    this.init();
    this.setupEventListeners();
  }

  init() {
    // Create UI container
    this.container = document.createElement('div');
    this.container.id = 'ui-container';
    document.body.appendChild(this.container);

    // Create UI elements
    this.createMainMenu();
    this.createHUD();
    this.createPauseMenu();
    this.createMatchEndScreen();
    this.createCountdown();
    this.createRoundAnnouncement();

    // Show main menu by default
    this.showMainMenu();
  }

  setupEventListeners() {
    globalEvents.on(EVENTS.ROUND_START, (data) => this.onRoundStart(data));
    globalEvents.on(EVENTS.ROUND_END, (data) => this.onRoundEnd(data));
    globalEvents.on(EVENTS.ROUND_COUNTDOWN, (data) => this.onCountdown(data));
    globalEvents.on(EVENTS.MATCH_END, (data) => this.onMatchEnd(data));
    globalEvents.on(EVENTS.PLAYER_DAMAGE, (data) => this.onPlayerDamage(data));
    globalEvents.on(EVENTS.MISSILE_DEFLECT, (data) => this.onDeflection(data));

    globalEvents.on(`state:${GAME_STATES.PLAYING}`, () => this.onGamePlaying());
    globalEvents.on(`state:${GAME_STATES.PAUSED}`, () => this.showPauseMenu());
    globalEvents.on(`state:${GAME_STATES.MENU}`, () => this.showMainMenu());
  }

  createMainMenu() {
    this.mainMenu = document.createElement('div');
    this.mainMenu.className = 'ui-screen main-menu';
    this.mainMenu.innerHTML = `
      <div class="menu-content">
        <h1 class="game-title">DODGEBALL MASTERS</h1>
        <p class="subtitle">Training Mode</p>
        <div class="menu-buttons">
          <button class="menu-btn primary" id="btn-start">START TRAINING</button>
          <button class="menu-btn" id="btn-controls">CONTROLS</button>
        </div>
        <div class="controls-info" id="controls-panel" style="display: none;">
          <h3>Controls</h3>
          <ul>
            <li><span class="key">MOUSE</span> - Aim</li>
            <li><span class="key">W A S D</span> - Move</li>
            <li><span class="key">SPACE</span> - Jump</li>
            <li><span class="key">RIGHT CLICK</span> - Deflect</li>
            <li><span class="key">ESC</span> - Pause</li>
          </ul>
        </div>
      </div>
    `;
    this.container.appendChild(this.mainMenu);
  }

  createHUD() {
    this.hud = document.createElement('div');
    this.hud.className = 'ui-hud';
    this.hud.innerHTML = `
      <div class="hud-top">
        <div class="score-panel">
          <div class="team-score player-score">
            <span class="team-label">YOU</span>
            <span class="score-value" id="player-score">0</span>
          </div>
          <div class="round-info">
            <span id="round-counter">Round 1</span>
          </div>
          <div class="team-score bot-score">
            <span class="team-label">BOT</span>
            <span class="score-value" id="bot-score">0</span>
          </div>
        </div>
      </div>
      <div class="hud-bottom">
        <div class="health-bar-container">
          <div class="health-bar">
            <div class="health-fill" id="health-fill"></div>
            <span class="health-text" id="health-text">100</span>
          </div>
        </div>
        <div class="missile-info">
          <span id="missile-speed">Speed: 1.0x</span>
          <span id="deflection-count">Deflections: 0</span>
        </div>
      </div>
    `;
    this.hud.style.display = 'none';
    this.container.appendChild(this.hud);
  }

  createPauseMenu() {
    this.pauseMenu = document.createElement('div');
    this.pauseMenu.className = 'ui-screen pause-menu';
    this.pauseMenu.innerHTML = `
      <div class="menu-content">
        <h2>PAUSED</h2>
        <div class="menu-buttons">
          <button class="menu-btn primary" id="btn-resume">RESUME</button>
          <button class="menu-btn" id="btn-quit">QUIT TO MENU</button>
        </div>
      </div>
    `;
    this.pauseMenu.style.display = 'none';
    this.container.appendChild(this.pauseMenu);
  }

  createMatchEndScreen() {
    this.matchEndScreen = document.createElement('div');
    this.matchEndScreen.className = 'ui-screen match-end';
    this.matchEndScreen.innerHTML = `
      <div class="menu-content">
        <h1 class="result-title" id="result-title">VICTORY</h1>
        <div class="final-score">
          <span id="final-player-score">0</span>
          <span class="score-separator">-</span>
          <span id="final-bot-score">0</span>
        </div>
        <div class="match-stats" id="match-stats"></div>
        <div class="menu-buttons">
          <button class="menu-btn primary" id="btn-play-again">PLAY AGAIN</button>
          <button class="menu-btn" id="btn-main-menu">MAIN MENU</button>
        </div>
      </div>
    `;
    this.matchEndScreen.style.display = 'none';
    this.container.appendChild(this.matchEndScreen);
  }

  createCountdown() {
    this.countdown = document.createElement('div');
    this.countdown.className = 'countdown-overlay';
    this.countdown.innerHTML = `<span class="countdown-number" id="countdown-number">3</span>`;
    this.countdown.style.display = 'none';
    this.container.appendChild(this.countdown);
  }

  createRoundAnnouncement() {
    this.roundAnnouncement = document.createElement('div');
    this.roundAnnouncement.className = 'round-announcement';
    this.roundAnnouncement.innerHTML = `<span id="announcement-text"></span>`;
    this.roundAnnouncement.style.display = 'none';
    this.container.appendChild(this.roundAnnouncement);
  }

  // Event Handlers

  onRoundStart(data) {
    document.getElementById('round-counter').textContent = `Round ${data.round}`;
    this.updateScores(data.playerScore, data.botScore);
    this.resetHUD();
    this.countdown.style.display = 'flex';
  }

  onCountdown(data) {
    const number = document.getElementById('countdown-number');
    number.textContent = data.value;
    number.classList.remove('pulse');
    void number.offsetWidth; // Trigger reflow
    number.classList.add('pulse');
  }

  onGamePlaying() {
    this.countdown.style.display = 'none';
    this.hud.style.display = 'block';

    // Show GO!
    const number = document.getElementById('countdown-number');
    number.textContent = 'GO!';
    this.countdown.style.display = 'flex';
    setTimeout(() => {
      this.countdown.style.display = 'none';
    }, 500);
  }

  onRoundEnd(data) {
    const text = data.winner === 'player' ? 'ROUND WON!' : 'ROUND LOST!';
    this.showAnnouncement(text, data.winner === 'player' ? 'win' : 'lose');
    this.updateScores(data.playerScore, data.botScore);
  }

  onMatchEnd(data) {
    this.hud.style.display = 'none';

    const title = document.getElementById('result-title');
    title.textContent = data.winner === 'player' ? 'VICTORY!' : 'DEFEAT';
    title.className = `result-title ${data.winner === 'player' ? 'win' : 'lose'}`;

    document.getElementById('final-player-score').textContent = data.playerScore;
    document.getElementById('final-bot-score').textContent = data.botScore;

    const stats = document.getElementById('match-stats');
    const duration = Math.floor(data.stats.matchDuration / 1000);
    stats.innerHTML = `
      <p>Match Duration: ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}</p>
      <p>Total Deflections: ${data.stats.totalDeflections}</p>
    `;

    this.matchEndScreen.style.display = 'flex';
  }

  onPlayerDamage(data) {
    this.updateHealth(data.health);

    // Flash health bar red
    const healthFill = document.getElementById('health-fill');
    healthFill.classList.add('damage-flash');
    setTimeout(() => healthFill.classList.remove('damage-flash'), 200);
  }

  onDeflection(data) {
    const speedMultiplier = (data.speed / 5).toFixed(2);
    document.getElementById('missile-speed').textContent = `Speed: ${speedMultiplier}x`;
    document.getElementById('deflection-count').textContent = `Deflections: ${data.deflector ? this.getDeflectionCount() + 1 : 0}`;
  }

  // UI Update Methods

  updateHealth(health) {
    const fill = document.getElementById('health-fill');
    const text = document.getElementById('health-text');
    const percentage = Math.max(0, health);

    fill.style.width = `${percentage}%`;
    text.textContent = Math.round(percentage);

    // Change color based on health
    if (percentage > 50) {
      fill.style.background = 'linear-gradient(90deg, #27ae60, #2ecc71)';
    } else if (percentage > 25) {
      fill.style.background = 'linear-gradient(90deg, #f39c12, #f1c40f)';
    } else {
      fill.style.background = 'linear-gradient(90deg, #c0392b, #e74c3c)';
    }
  }

  updateScores(playerScore, botScore) {
    document.getElementById('player-score').textContent = playerScore;
    document.getElementById('bot-score').textContent = botScore;
  }

  resetHUD() {
    this.updateHealth(100);
    document.getElementById('missile-speed').textContent = 'Speed: 1.0x';
    document.getElementById('deflection-count').textContent = 'Deflections: 0';
  }

  showAnnouncement(text, type = 'neutral') {
    const announcement = document.getElementById('announcement-text');
    announcement.textContent = text;
    announcement.className = type;
    this.roundAnnouncement.style.display = 'flex';

    setTimeout(() => {
      this.roundAnnouncement.style.display = 'none';
    }, 1500);
  }

  getDeflectionCount() {
    const text = document.getElementById('deflection-count').textContent;
    return parseInt(text.split(': ')[1]) || 0;
  }

  // Screen Management

  showMainMenu() {
    this.hideAll();
    this.mainMenu.style.display = 'flex';
  }

  showHUD() {
    this.hideAll();
    this.hud.style.display = 'block';
  }

  showPauseMenu() {
    this.pauseMenu.style.display = 'flex';
  }

  hidePauseMenu() {
    this.pauseMenu.style.display = 'none';
  }

  hideAll() {
    this.mainMenu.style.display = 'none';
    this.hud.style.display = 'none';
    this.pauseMenu.style.display = 'none';
    this.matchEndScreen.style.display = 'none';
    this.countdown.style.display = 'none';
    this.roundAnnouncement.style.display = 'none';
  }

  // Button Bindings

  bindStartButton(callback) {
    document.getElementById('btn-start').addEventListener('click', callback);
  }

  bindControlsButton() {
    document.getElementById('btn-controls').addEventListener('click', () => {
      const panel = document.getElementById('controls-panel');
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
  }

  bindResumeButton(callback) {
    document.getElementById('btn-resume').addEventListener('click', callback);
  }

  bindQuitButton(callback) {
    document.getElementById('btn-quit').addEventListener('click', callback);
  }

  bindPlayAgainButton(callback) {
    document.getElementById('btn-play-again').addEventListener('click', callback);
  }

  bindMainMenuButton(callback) {
    document.getElementById('btn-main-menu').addEventListener('click', callback);
  }

  dispose() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
