/**
 * AudioManager
 * Handles game sound effects and music
 * Uses Web Audio API for low-latency audio
 */

export class AudioManager {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.sounds = new Map();
    this.enabled = true;
    this.volume = 0.15;

    this.init();
  }

  async init() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.value = this.volume;

      // Generate procedural sounds
      this.generateSounds();
    } catch (error) {
      console.warn('AudioManager: Web Audio API not supported', error);
      this.enabled = false;
    }
  }

  /**
   * Generate procedural sound effects
   * This avoids the need for external audio files
   */
  generateSounds() {
    // Deflect sound - successful missile return
    this.sounds.set('deflect', () => this.playDeflectSound());

    // Pulse sound - air compression when player activates deflect (right-click)
    this.sounds.set('pulse', () => this.playPulseSound());

    // Hit sound - impact explosion
    this.sounds.set('hit', () => this.playHitSound());

    // Countdown beep
    this.sounds.set('countdown', () => this.playCountdownSound());

    // Round start
    this.sounds.set('roundStart', () => this.playRoundStartSound());

    // Round end
    this.sounds.set('roundEnd', () => this.playRoundEndSound());

    // Target notification
    this.sounds.set('targeted', () => this.playTargetedSound());

    // Match win/lose
    this.sounds.set('victory', () => this.playVictorySound());
    this.sounds.set('defeat', () => this.playDefeatSound());
  }

  createOscillator(type, frequency, duration, gainValue = 0.3) {
    if (!this.audioContext || !this.enabled) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    gainNode.gain.setValueAtTime(gainValue, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);

    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration);

    return { oscillator, gainNode };
  }

  createNoise(duration, gainValue = 0.1) {
    if (!this.audioContext || !this.enabled) return;

    const bufferSize = this.audioContext.sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();

    source.buffer = buffer;
    gainNode.gain.setValueAtTime(gainValue, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

    source.connect(gainNode);
    gainNode.connect(this.masterGain);

    source.start();

    return { source, gainNode };
  }

  playDeflectSound() {
    if (!this.audioContext || !this.enabled) return;

    const currentTime = this.audioContext.currentTime;

    // Sharp "Ping/Impact" sound for the ball return
    const pingOsc = this.audioContext.createOscillator();
    const pingGain = this.audioContext.createGain();
    pingOsc.type = 'triangle';
    pingOsc.frequency.setValueAtTime(1200, currentTime);
    pingOsc.frequency.exponentialRampToValueAtTime(400, currentTime + 0.1);
    pingGain.gain.setValueAtTime(0.4, currentTime);
    pingGain.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.15);

    pingOsc.connect(pingGain);
    pingGain.connect(this.masterGain);
    pingOsc.start(currentTime);
    pingOsc.stop(currentTime + 0.15);

    // Subtle noise for the texture of the hit
    this.createNoise(0.05, 0.15);
  }

  playPulseSound() {
    if (!this.audioContext || !this.enabled) return;

    const currentTime = this.audioContext.currentTime;

    // Low frequency "thump" for the air pulse activation
    const bassOsc = this.audioContext.createOscillator();
    const bassGain = this.audioContext.createGain();
    bassOsc.type = 'sine';
    bassOsc.frequency.setValueAtTime(150, currentTime);
    bassOsc.frequency.exponentialRampToValueAtTime(40, currentTime + 0.2);
    bassGain.gain.setValueAtTime(0.6, currentTime);
    bassGain.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.25);
    bassOsc.connect(bassGain);
    bassGain.connect(this.masterGain);
    bassOsc.start(currentTime);
    bassOsc.stop(currentTime + 0.25);

    // Mid "whoosh" sweep for air compression
    const whooshOsc = this.audioContext.createOscillator();
    const whooshGain = this.audioContext.createGain();
    whooshOsc.type = 'sawtooth';
    whooshOsc.frequency.setValueAtTime(400, currentTime);
    whooshOsc.frequency.exponentialRampToValueAtTime(100, currentTime + 0.15);
    whooshGain.gain.setValueAtTime(0.2, currentTime);
    whooshGain.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.15);
    whooshOsc.connect(whooshGain);
    whooshGain.connect(this.masterGain);
    whooshOsc.start(currentTime);
    whooshOsc.stop(currentTime + 0.15);

    // Filtered noise for air texture
    const noiseBuffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 0.2, this.audioContext.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2500, currentTime);
    filter.frequency.exponentialRampToValueAtTime(300, currentTime + 0.2);

    const noiseGain = this.audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.3, currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.2);

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noiseSource.start(currentTime);
  }

  playHitSound() {
    this.createOscillator('sawtooth', 100, 0.3, 0.4);
    this.createOscillator('sine', 80, 0.4, 0.3);
    this.createNoise(0.2, 0.3);
  }

  playCountdownSound() {
    this.createOscillator('sine', 440, 0.15, 0.3);
  }

  playRoundStartSound() {
    this.createOscillator('sine', 523, 0.1, 0.3);
    setTimeout(() => this.createOscillator('sine', 659, 0.1, 0.3), 100);
    setTimeout(() => this.createOscillator('sine', 784, 0.2, 0.4), 200);
  }

  playRoundEndSound() {
    this.createOscillator('sine', 392, 0.2, 0.3);
    setTimeout(() => this.createOscillator('sine', 330, 0.3, 0.3), 150);
  }

  playTargetedSound() {
    // Warning alarm sound
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.createOscillator('square', 880, 0.1, 0.2);
      }, i * 150);
    }
  }

  playVictorySound() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => this.createOscillator('sine', freq, 0.3, 0.3), i * 150);
    });
  }

  playDefeatSound() {
    const notes = [392, 330, 262, 196];
    notes.forEach((freq, i) => {
      setTimeout(() => this.createOscillator('sine', freq, 0.3, 0.3), i * 200);
    });
  }

  /**
   * Play a sound by name
   */
  play(soundName) {
    if (!this.enabled || !this.sounds.has(soundName)) return;

    // Resume audio context if suspended (browser autoplay policy)
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }

    const playFn = this.sounds.get(soundName);
    if (playFn) playFn();
  }

  /**
   * Set master volume (0-1)
   */
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume;
    }
  }

  /**
   * Toggle audio on/off
   */
  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  /**
   * Enable audio
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disable audio
   */
  disable() {
    this.enabled = false;
  }

  resetDefaults() {
    this.setVolume(0.15);
  }

  dispose() {
    if (this.audioContext) {
      this.audioContext.close();
    }
    this.sounds.clear();
  }
}
