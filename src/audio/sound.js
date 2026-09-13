/**
 * Web Audio Synthesizer for Werewolf Moderator
 * Generates procedural audio effects without external audio files.
 */
export class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.isAlarmRunning = false;
    this.alarmInterval = null;
  }

  init() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playGong() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 1.8);
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.8);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 1.8);
  }

  playChime() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.25, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.6);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.6);
    });
  }

  playBeep() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  playPop() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  playFanfare() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const notes = [
      { freq: 523.25, time: 0.00, dur: 0.15 }, // C5
      { freq: 659.25, time: 0.14, dur: 0.15 }, // E5
      { freq: 783.99, time: 0.28, dur: 0.18 }, // G5
      { freq: 1046.50, time: 0.46, dur: 0.75 }, // C6
      { freq: 783.99, time: 0.46, dur: 0.75 },  // G5 harmony
      { freq: 523.25, time: 0.46, dur: 0.75 }   // C5 harmony
    ];
    const now = this.ctx.currentTime;
    notes.forEach(n => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.freq, now + n.time);
      gain.gain.setValueAtTime(0.22, now + n.time);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.time + n.dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + n.time);
      osc.stop(now + n.time + n.dur);
    });
  }

  playAlarmPulse() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    // Dual-chirp digital alarm buzzer
    const now = this.ctx.currentTime;
    const tones = [
      { freq: 880, start: 0.00, dur: 0.12 },
      { freq: 1174.66, start: 0.14, dur: 0.14 },
      { freq: 880, start: 0.30, dur: 0.12 },
      { freq: 1174.66, start: 0.44, dur: 0.18 }
    ];
    tones.forEach(t => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(t.freq, now + t.start);
      gain.gain.setValueAtTime(0.26, now + t.start);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t.start + t.dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + t.start);
      osc.stop(now + t.start + t.dur);
    });
  }

  startAlarmLoop() {
    if (!this.enabled) return;
    this.stopAlarm();
    this.isAlarmRunning = true;
    this.playAlarmPulse();
    this.alarmInterval = setInterval(() => {
      if (!this.isAlarmRunning || !this.enabled) {
        this.stopAlarm();
        return;
      }
      this.playAlarmPulse();
    }, 750);
  }

  stopAlarm() {
    this.isAlarmRunning = false;
    if (this.alarmInterval) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
  }

  playAttentionBell() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Multi-harmonic bronze town hall bell strike
    const harmonics = [
      { freq: 440, gain: 0.35, decay: 2.2 },
      { freq: 880, gain: 0.28, decay: 1.8 },
      { freq: 1318.5, gain: 0.20, decay: 1.4 },
      { freq: 1760, gain: 0.15, decay: 1.0 },
      { freq: 2637, gain: 0.08, decay: 0.6 }
    ];
    harmonics.forEach(h => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(h.freq, now);
      gain.gain.setValueAtTime(h.gain, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + h.decay);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + h.decay);
    });
  }

  playSunriseBell() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Ascending morning dawn bells with bright ringing decay
    const bells = [
      { freq: 523.25, time: 0.00, dur: 1.4, gain: 0.25 },
      { freq: 659.25, time: 0.22, dur: 1.4, gain: 0.25 },
      { freq: 783.99, time: 0.44, dur: 1.6, gain: 0.28 },
      { freq: 1046.50, time: 0.68, dur: 2.2, gain: 0.32 },
      { freq: 2093.00, time: 0.68, dur: 1.0, gain: 0.08 }
    ];
    bells.forEach(b => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(b.freq, now + b.time);
      gain.gain.setValueAtTime(b.gain, now + b.time);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + b.time + b.dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + b.time);
      osc.stop(now + b.time + b.dur);
    });
  }

  playWolfHowl() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(380, now + 0.5);
    osc.frequency.exponentialRampToValueAtTime(140, now + 2.0);
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 2.0);
  }
}

export const soundManager = new SoundManager();
