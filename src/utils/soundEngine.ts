import * as THREE from 'three';

// Procedural Web Audio API Laboratory Sound Synthesizer
// Zero external asset dependencies; safe for hermetic sandboxes and instant low-latency feedback.

class LabSoundEngine {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private lastDropTime: number = 0;
  private userInteracted: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const markInteracted = () => {
        this.userInteracted = true;
      };
      window.addEventListener('pointerdown', markInteracted, { once: true, passive: true });
      window.addEventListener('keydown', markInteracted, { once: true, passive: true });
    }
  }

  private getContext(): AudioContext | null {
    if (!this.enabled || !this.userInteracted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public playClick(pitch = 620) {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, now);
      osc.frequency.exponentialRampToValueAtTime(pitch * 1.25, now + 0.045);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch {
      // Ignore audio context restrictions
    }
  }

  public playStep(direction: 'up' | 'down' = 'up') {
    this.playClick(direction === 'up' ? 680 : 520);
  }

  public playSpringTwang(displacementAbs = 0.8) {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const baseFreq = 140 + Math.min(220, Math.abs(displacementAbs) * 110);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.4, now + 0.12);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, now + 0.25);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.27);
    } catch {
      // Ignore
    }
  }

  public playCollisionThud(restitution = 1.0) {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = restitution > 0.6 ? 'sine' : 'triangle';
      const startFreq = 160 + restitution * 120;
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + 0.14);

      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } catch {
      // Ignore
    }
  }

  public playTitrationDrop(ph = 7.0) {
    const ctx = this.getContext();
    if (!ctx) return;
    const nowMs = performance.now();
    if (nowMs - this.lastDropTime < 65) return;
    this.lastDropTime = nowMs;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const freq = 480 + Math.min(14, Math.max(0, ph)) * 38;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.35, now + 0.055);

      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.065);
    } catch {
      // Ignore
    }
  }

  public playRecordSuccess() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99]; // C5 - E5 - G5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.055);
        gain.gain.setValueAtTime(0.06, now + idx * 0.055);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.055);
        osc.stop(now + idx * 0.055 + 0.15);
      });
    } catch {
      // Ignore
    }
  }

  public playSuccessChime() {
    this.playRecordSuccess();
  }

  public playSnapshotPin() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const notes = [587.33, 880]; // D5 -> A5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.06, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.13);
      });
    } catch {
      // Ignore
    }
  }

  /**
   * Helper Spasial Audio 3D (Tahap 4):
   * Mengikat THREE.AudioListener ke kamera 3D aktif dan membuat instance THREE.PositionalAudio
   * dengan sintetis audio buffer prosedural (tetesan larutan, dentuman tumbukan, gesekan).
   */
  public createPositionalSoundEmitter(
    camera: THREE.Camera,
    audioType: 'titration-drop' | 'collision-thud' | 'friction-slide' | 'electric-pulse'
  ): {
    sound: THREE.PositionalAudio;
    play: () => void;
    dispose: () => void;
  } {
    let listener = camera.children.find((c) => (c as THREE.AudioListener).type === 'AudioListener') as THREE.AudioListener | undefined;
    if (!listener) {
      listener = new THREE.AudioListener();
      camera.add(listener);
    }

    const sound = new THREE.PositionalAudio(listener);
    sound.setRefDistance(1.8);
    sound.setMaxDistance(18.0);
    sound.setRolloffFactor(1.5);
    sound.setDistanceModel('exponential');

    const audioCtx = listener.context;
    const sampleRate = audioCtx.sampleRate || 44100;
    const duration = audioType === 'titration-drop' ? 0.08 : audioType === 'collision-thud' ? 0.18 : 0.14;
    const frameCount = Math.floor(sampleRate * duration);
    const buffer = audioCtx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < frameCount; i++) {
      const t = i / sampleRate;
      const progress = i / frameCount;
      const decay = Math.exp(-progress * 8.5);

      if (audioType === 'titration-drop') {
        const freq = 680 + 350 * progress;
        data[i] = Math.sin(2 * Math.PI * freq * t) * decay * 0.45;
      } else if (audioType === 'collision-thud') {
        const freq = 180 * (1 - progress * 0.7);
        const noise = (Math.random() * 2 - 1) * 0.15;
        data[i] = (Math.sin(2 * Math.PI * freq * t) + noise) * decay * 0.65;
      } else if (audioType === 'friction-slide') {
        const noise = (Math.random() * 2 - 1) * 0.4;
        data[i] = noise * decay * 0.35;
      } else {
        const freq = 1200 - 600 * progress;
        data[i] = Math.sin(2 * Math.PI * freq * t) * decay * 0.4;
      }
    }

    sound.setBuffer(buffer);

    const play = () => {
      if (!this.enabled) return;
      try {
        if (audioCtx.state === 'suspended') {
          audioCtx.resume().catch(() => {});
        }
        if (sound.isPlaying) {
          sound.stop();
        }
        sound.play();
      } catch {
        // audio policy fallback
      }
    };

    const dispose = () => {
      try {
        if (sound.isPlaying) sound.stop();
        sound.disconnect();
      } catch {
        // ignore
      }
    };

    return { sound, play, dispose };
  }
}

export const labSound = new LabSoundEngine();
