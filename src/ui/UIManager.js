import { globalEvents } from '../utils/EventEmitter.js';
import { EVENTS, GAME_STATES, PLAYER } from '../utils/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * UIManager
 * Central manager for all UI components using Tailwind CSS
 */

export class UIManager {
  constructor() {
    this.container = null;
    this.hud = null;
    this.mainMenu = null;
    this.pauseMenu = null;
    this.matchEndScreen = null;
    this.countdown = null;
    this.roundAnnouncement = null;

    this.init();
    this.setupEventListeners();
  }

  init() {
    // Create UI container
    this.container = document.createElement('div');
    this.container.id = 'ui-container';
    this.container.className = 'fixed inset-0 pointer-events-none z-50 font-sans';
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
    globalEvents.on(EVENTS.MISSILE_SPAWN, () => this.resetMissileStats());

    globalEvents.on(`state:${GAME_STATES.PLAYING}`, (data) => this.onGamePlaying(data));
    globalEvents.on(`state:${GAME_STATES.PAUSED}`, () => this.showPauseMenu());
    globalEvents.on(`state:${GAME_STATES.MENU}`, () => this.showMainMenu());
  }

  // --- UI Creation Methods ---

  createMainMenu() {
    this.mainMenu = document.createElement('div');
    this.mainMenu.className = 'absolute inset-0 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm pointer-events-auto transition-opacity duration-300';
    this.mainMenu.innerHTML = `
      <div class="panel-glass p-12 max-w-2xl w-full text-center transform transition-all duration-500 hover:border-cyan-500/30">
        <h1 class="text-6xl font-black mb-2 tracking-tighter bg-linear-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent drop-shadow-lg">
          DODGEBALL MASTERS
        </h1>
        <p class="text-xl text-slate-400 mb-12 tracking-[0.2em] font-light">TRAINING SIMULATION</p>
        
        <div class="flex flex-col gap-4 max-w-xs mx-auto">
          <button class="btn-primary group cursor-pointer" id="btn-start">
            <span class="group-hover:translate-x-1 transition-transform inline-block">Start Training</span>
          </button>
          <button class="btn-secondary cursor-pointer" id="btn-controls">Controls</button>
        </div>

        <div id="controls-panel" class="hidden mt-8 text-left bg-slate-800/50 p-6 rounded-xl border border-white/5">
          <h3 class="text-cyan-400 font-bold mb-4 uppercase tracking-wider text-sm border-b border-white/10 pb-2">Control Systems</h3>
          <ul class="space-y-3 text-slate-300 text-sm font-mono">
            <li class="flex justify-between"><span>Aiming</span> <span class="bg-slate-700 px-2 py-0.5 rounded text-white">MOUSE</span></li>
            <li class="flex justify-between"><span>Movement</span> <span class="bg-slate-700 px-2 py-0.5 rounded text-white">W A S D</span></li>
            <li class="flex justify-between"><span>Jump / Dash</span> <span class="bg-slate-700 px-2 py-0.5 rounded text-white">SPACE</span></li>
            <li class="flex justify-between"><span>Deflect</span> <span class="bg-slate-700 px-2 py-0.5 rounded text-white">R-CLICK</span></li>
            <li class="flex justify-between"><span>Pause</span> <span class="bg-slate-700 px-2 py-0.5 rounded text-white">ESC</span></li>
          </ul>
        </div>
      </div>
    `;
    this.container.appendChild(this.mainMenu);
  }

  createHUD() {
    this.hud = document.createElement('div');
    this.hud.className = 'absolute inset-0 pointer-events-none hidden';
    this.hud.innerHTML = `
      <!-- Top Central Control Panel -->
      <div class="absolute top-0 left-1/2 -translate-x-1/2 flex items-stretch bg-slate-900/90 backdrop-blur-md border-x border-b border-white/10 rounded-b-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] animate-slide-in overflow-hidden">
        
        <!-- Player Score -->
        <div class="flex items-center gap-4 px-8 py-3 bg-linear-to-r from-cyan-500/10 to-transparent border-r border-white/5">
          <div class="flex flex-col items-start">
            <span class="text-[10px] font-black text-cyan-400 tracking-tighter uppercase leading-none mb-1">YOU</span>
            <div class="w-4 h-0.5 bg-cyan-500/50"></div>
          </div>
          <span class="text-4xl font-black text-white tabular-nums drop-shadow-sm" id="player-score">0</span>
        </div>

        <!-- Round Info -->
        <div class="px-6 flex flex-col items-center justify-center bg-white/5 min-w-25">
          <span class="text-[9px] font-bold text-slate-500 tracking-[0.3em] uppercase mb-0.5">MATCH</span>
          <span class="text-sm font-mono font-black text-slate-200" id="round-counter">ROUND 1</span>
        </div>

        <!-- Bot Score -->
        <div class="flex items-center gap-4 px-8 py-3 bg-linear-to-l from-rose-500/10 to-transparent border-l border-white/5 text-right">
          <span class="text-4xl font-black text-white tabular-nums drop-shadow-sm" id="bot-score">0</span>
          <div class="flex flex-col items-end">
            <span class="text-[10px] font-black text-rose-500 tracking-tighter uppercase leading-none mb-1">BOT</span>
            <div class="w-4 h-0.5 bg-rose-500/50"></div>
          </div>
        </div>
      </div>

      <!-- Bottom Bar: Stats & Health -->
      <div class="absolute bottom-0 left-0 w-full p-8 flex flex-col items-center gap-4">
        
        <!-- Stats Pills -->
        <div class="flex gap-4 opacity-75">
          <div class="bg-slate-900/60 backdrop-blur px-4 py-1 rounded-full border border-white/10 flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
            <span class="text-xs font-mono text-slate-300" id="missile-speed">SPEED: 1.0x</span>
          </div>
          <div class="bg-slate-900/60 backdrop-blur px-4 py-1 rounded-full border border-white/10">
            <span class="text-xs font-mono text-slate-300" id="deflection-count">DEFLECTIONS: 0</span>
          </div>
        </div>

        <!-- Health Bar -->
        <div class="w-full max-w-md relative group">
          <div class="absolute -inset-1 bg-linear-to-r from-cyan-500 to-green-500 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
          <div class="relative bg-slate-900/90 h-6 rounded-full overflow-hidden border border-white/10 shadow-xl">
            <div class="absolute top-0 left-0 h-full w-full bg-linear-to-r from-green-500 to-emerald-400 transition-all duration-300 ease-out" id="health-fill" style="width: 100%"></div>
            
            <!-- Health Text -->
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="text-xs font-black tracking-widest text-white drop-shadow-md z-10" id="health-text">100%</span>
            </div>
          </div>
        </div>
      </div>
    `;
    this.container.appendChild(this.hud);
  }

  createPauseMenu() {
    this.pauseMenu = document.createElement('div');
    this.pauseMenu.className = 'absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur pointer-events-auto hidden z-50';
    this.pauseMenu.innerHTML = `
      <div class="panel-glass p-10 text-center min-w-75">
        <h2 class="text-3xl font-black text-white mb-8 tracking-widest border-b border-white/10 pb-4">PAUSED</h2>
        <div class="flex flex-col gap-4">
          <button class="btn-primary cursor-pointer" id="btn-resume">RESUME</button>
          <button class="btn-secondary cursor-pointer" id="btn-quit">QUIT TO MENU</button>
        </div>
      </div>
    `;
    this.container.appendChild(this.pauseMenu);
  }

  createMatchEndScreen() {
    this.matchEndScreen = document.createElement('div');
    this.matchEndScreen.className = 'absolute inset-0 flex items-center justify-center bg-slate-950/90 backdrop-blur-md pointer-events-auto hidden z-50';
    this.matchEndScreen.innerHTML = `
      <div class="panel-glass p-12 text-center max-w-lg w-full transform transition-all">
        <h1 class="text-5xl font-black mb-2 tracking-tighter" id="result-title">VICTORY</h1>
        <div class="w-24 h-1 bg-linear-to-r from-transparent via-white to-transparent mx-auto mb-8 opacity-50"></div>
        
        <div class="flex justify-center items-center gap-8 mb-8">
          <div class="text-center">
            <p class="text-sm text-slate-400 uppercase tracking-wider mb-1">You</p>
            <span class="text-5xl font-black text-white" id="final-player-score">0</span>
          </div>
          <div class="text-2xl text-slate-600 font-light">vs</div>
          <div class="text-center">
            <p class="text-sm text-slate-400 uppercase tracking-wider mb-1">Bot</p>
            <span class="text-5xl font-black text-white" id="final-bot-score">0</span>
          </div>
        </div>

        <div class="bg-slate-800/50 rounded-xl p-4 mb-8 font-mono text-sm text-slate-300 space-y-2 border border-white/5" id="match-stats">
          <!-- Stats populated by JS -->
        </div>

        <div class="flex flex-col gap-3">
          <button class="btn-primary" id="btn-play-again">Play Again</button>
          <button class="btn-secondary" id="btn-main-menu">Main Menu</button>
        </div>
      </div>
    `;
    this.container.appendChild(this.matchEndScreen);
  }

  createCountdown() {
    this.countdown = document.createElement('div');
    this.countdown.className = 'absolute inset-0 flex items-center justify-center pointer-events-none hidden z-40';
    this.countdown.innerHTML = `
      <span class="text-9xl font-black text-white drop-shadow-[0_0_30px_rgba(6,182,212,0.8)] animate-pulse" id="countdown-number">3</span>
    `;
    this.container.appendChild(this.countdown);
  }

  createRoundAnnouncement() {
    this.roundAnnouncement = document.createElement('div');
    this.roundAnnouncement.className = 'absolute inset-0 flex items-center justify-center pointer-events-none hidden z-40 bg-black/20';
    this.roundAnnouncement.innerHTML = `
      <div class="transform transition-all duration-300 scale-150" id="announcement-wrapper">
        <span class="text-6xl font-black tracking-tighter uppercase drop-shadow-2xl" id="announcement-text">ROUND 1</span>
      </div>
    `;
    this.container.appendChild(this.roundAnnouncement);
  }

  // --- Event Handlers ---

  onRoundStart(data) {
    document.getElementById('round-counter').textContent = `ROUND ${data.round}`;
    this.updateScores(data.playerScore, data.botScore);
    this.resetHUD();

    // Explicitly reset countdown text
    const number = document.getElementById('countdown-number');
    number.textContent = '3';
    number.classList.add('animate-pulse');
    number.classList.remove('animate-ping');

    this.countdown.classList.remove('hidden');
    this.countdown.classList.add('flex');
  }

  onCountdown(data) {
    const number = document.getElementById('countdown-number');
    number.textContent = data.value;

    // Switch to ping animation for counting down
    number.classList.remove('animate-pulse');
    number.classList.remove('animate-ping');
    void number.offsetWidth; // Trigger reflow
    number.classList.add('animate-ping');
  }

  onGamePlaying(data) {
    this.hidePauseMenu();
    this.countdown.classList.add('hidden');
    this.countdown.classList.remove('flex');
    this.hud.classList.remove('hidden');

    if (data && data.previousState === GAME_STATES.COUNTDOWN) {
      const number = document.getElementById('countdown-number');
      number.textContent = 'GO!';
      number.classList.remove('animate-ping');
      number.classList.add('animate-pulse');

      this.countdown.classList.remove('hidden');
      this.countdown.classList.add('flex');

      setTimeout(() => {
        this.countdown.classList.add('hidden');
        this.countdown.classList.remove('flex');
      }, 500);
    }
  }

  onRoundEnd(data) {
    const isWin = data.winner === 'player';
    const text = isWin ? 'ROUND WON' : 'ROUND LOST';
    const colorClass = isWin ? 'text-green-400' : 'text-rose-500';

    this.showAnnouncement(text, colorClass);
    this.updateScores(data.playerScore, data.botScore);
  }

  onMatchEnd(data) {
    this.hud.classList.add('hidden');
    const isWin = data.winner === 'player';

    const title = document.getElementById('result-title');
    title.textContent = isWin ? 'VICTORY' : 'DEFEAT';
    title.className = `text-6xl font-black mb-2 tracking-tighter ${isWin ? 'text-green-400 drop-shadow-[0_0_20px_rgba(74,222,128,0.5)]' : 'text-rose-500 drop-shadow-[0_0_20px_rgba(244,63,94,0.5)]'}`;

    document.getElementById('final-player-score').textContent = data.playerScore;
    document.getElementById('final-bot-score').textContent = data.botScore;

    const stats = document.getElementById('match-stats');
    const duration = Math.floor(data.stats.matchDuration / 1000);
    stats.innerHTML = `
      <div class="flex justify-between border-b border-white/5 pb-2"><span>Match Duration</span> <span class="text-white">${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}</span></div>
      <div class="flex justify-between pt-2"><span>Total Deflections</span> <span class="text-white">${data.stats.totalDeflections}</span></div>
    `;

    this.matchEndScreen.classList.remove('hidden');
    this.matchEndScreen.classList.add('flex');
  }

  onPlayerDamage(data) {
    this.updateHealth(data.health, PLAYER.MAX_HEALTH);

    // Flash Red Overlay
    const flash = document.createElement('div');
    flash.className = 'fixed inset-0 bg-red-500/20 pointer-events-none z-0';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 150);
  }

  onDeflection(data) {
    const speedMultiplier = (data.speed / 5).toFixed(2);
    document.getElementById('missile-speed').textContent = `SPEED: ${speedMultiplier}x`;

    const defCount = data.deflector ? this.getDeflectionCount() + 1 : 0;
    document.getElementById('deflection-count').textContent = `DEFLECTIONS: ${defCount}`;
  }

  // --- Update Methods ---

  updateHealth(health, maxHealth = 100) {
    const fill = document.getElementById('health-fill');
    const text = document.getElementById('health-text');

    const clampedHealth = MathUtils.clamp(health, 0, maxHealth);
    const percentage = (clampedHealth / maxHealth) * 100;

    fill.style.width = `${percentage}%`;
    text.textContent = `${Math.round(clampedHealth)}%`;

    // Dynamic Color
    fill.className = `absolute top-0 left-0 h-full w-full transition-all duration-300 ease-out ${percentage > 50 ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
      percentage > 20 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
        'bg-gradient-to-r from-red-600 to-rose-500 animate-pulse'
      }`;
  }

  updateScores(playerScore, botScore) {
    document.getElementById('player-score').textContent = playerScore;
    document.getElementById('bot-score').textContent = botScore;
  }

  resetHUD() {
    this.updateHealth(PLAYER.MAX_HEALTH, PLAYER.MAX_HEALTH);
    this.resetMissileStats();
  }

  resetMissileStats() {
    document.getElementById('missile-speed').textContent = 'SPEED: 1.0x';
    document.getElementById('deflection-count').textContent = 'DEFLECTIONS: 0';
  }

  showAnnouncement(text, colorClass) {
    const announcement = document.getElementById('announcement-text');
    announcement.textContent = text;
    announcement.className = `text-6xl font-black tracking-tighter uppercase drop-shadow-2xl ${colorClass}`;

    this.roundAnnouncement.classList.remove('hidden');
    this.roundAnnouncement.classList.add('flex');

    // Simple fade out
    setTimeout(() => {
      this.roundAnnouncement.classList.remove('flex');
      this.roundAnnouncement.classList.add('hidden');
    }, 1500);
  }

  getDeflectionCount() {
    const text = document.getElementById('deflection-count').textContent;
    return parseInt(text.split(': ')[1]) || 0;
  }

  // --- Screen Management ---

  showMainMenu() {
    this.hideAll();
    this.mainMenu.classList.remove('hidden');
    this.mainMenu.classList.add('flex');
  }

  showHUD() {
    this.hideAll();
    this.hud.classList.remove('hidden');
  }

  showPauseMenu() {
    this.pauseMenu.classList.remove('hidden');
    this.pauseMenu.classList.add('flex');
  }

  hidePauseMenu() {
    this.pauseMenu.classList.remove('flex');
    this.pauseMenu.classList.add('hidden');
  }

  hideAll() {
    [this.mainMenu, this.hud, this.pauseMenu, this.matchEndScreen, this.countdown, this.roundAnnouncement].forEach(el => {
      if (el) {
        el.classList.add('hidden');
        el.classList.remove('flex');
      }
    });
  }

  // --- Bindings ---

  bindStartButton(callback) {
    document.getElementById('btn-start').addEventListener('click', callback);
  }

  bindControlsButton() {
    const btn = document.getElementById('btn-controls');
    const panel = document.getElementById('controls-panel');

    // Remove existing listeners to prevent duplicates if called multiple times (though init is once)
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', () => {
      panel.classList.toggle('hidden');
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
