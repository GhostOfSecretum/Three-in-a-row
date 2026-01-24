type ActiveTone = {
  osc: OscillatorNode;
  gain: GainNode;
};

export class AudioManager {
  private ctx: AudioContext | null = null;
  private unlocked = false;
  private muted = true;
  private music: ActiveTone | null = null;

  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    this.unlocked = true;
  }

  isUnlocked() {
    return this.unlocked;
  }

  isMuted() {
    return this.muted;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopMusic();
    } else {
      this.startMusic();
    }
  }

  startMusic() {
    if (!this.ctx || !this.unlocked || this.music || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 110;
    gain.gain.value = 0.02;
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    this.music = { osc, gain };
  }

  stopMusic() {
    if (!this.music) return;
    this.music.osc.stop();
    this.music.osc.disconnect();
    this.music.gain.disconnect();
    this.music = null;
  }

  playShot() {
    this.playBurst(240, 0.06, 0.15);
  }

  playUse() {
    this.playBurst(360, 0.1, 0.1);
  }

  playHit() {
    this.playBurst(90, 0.08, 0.2);
  }

  private playBurst(freq: number, duration: number, volume: number) {
    if (!this.ctx || !this.unlocked || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.stop(this.ctx.currentTime + duration);
  }
}
