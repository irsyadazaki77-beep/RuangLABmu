/**
 * Dynamic Scientific Sonification Engine (v3.0 — RuangLABmu)
 * Mengonversi fenomena fisika, kimia, biologi, astronomi, dan kebumian menjadi umpan balik
 * audio akustik real-time menggunakan Web Audio API murni tanpa aset eksternal,
 * dengan batas volume aman ruang kelas (<= -12 dBFS).
 */

export const SAFE_CLASSROOM_MAX_GAIN = 0.22; // ~ -13 dBFS

/**
 * Menghitung frekuensi teramati Efek Doppler: f' = f0 * (v + vo) / (v - vs).
 */
export function computeDopplerObservedHz(
  sourceFreqHz: number,
  sourceVelocityMs: number,
  observerVelocityMs = 0,
  speedOfSoundMs = 343
): number {
  const f0 = Math.max(40, Math.min(2000, Number.isFinite(sourceFreqHz) ? sourceFreqHz : 440));
  const v = Math.max(100, Number.isFinite(speedOfSoundMs) ? speedOfSoundMs : 343);
  const vs = Math.max(
    -v * 0.85,
    Math.min(v * 0.85, Number.isFinite(sourceVelocityMs) ? sourceVelocityMs : 0)
  );
  const vo = Math.max(
    -v * 0.85,
    Math.min(v * 0.85, Number.isFinite(observerVelocityMs) ? observerVelocityMs : 0)
  );

  const observed = f0 * ((v + vo) / (v - vs));
  return Number(Math.max(60, Math.min(4000, observed)).toFixed(2));
}

/**
 * Memetakan frekuensi osilasi fisis (0.1..10 Hz) ke nada harmonis audiosonik (220..880 Hz).
 */
export function computeHarmonicPitchHz(naturalFreqHz: number): number {
  const f = Math.max(0.05, Math.min(20, Number.isFinite(naturalFreqHz) ? naturalFreqHz : 1));
  const normalized = Math.log10(f / 0.1) / Math.log10(10 / 0.1);
  const clamped = Math.max(0, Math.min(1, normalized));
  const pitchHz = 220 * Math.pow(2, clamped * 2);
  return Number(pitchHz.toFixed(2));
}

/**
 * Memetakan nilai pH titrasi (0..14) ke frekuensi nada (220..660 Hz)
 * dengan pergeseran curam mendekati titik ekivalen pH 7.0.
 */
export function computeTitrationPhPitchHz(ph: number): number {
  const safePh = Math.max(0, Math.min(14, Number.isFinite(ph) ? ph : 7));
  const sigmoid = 1 / (1 + Math.exp(-(safePh - 7) * 0.75));
  const pitchHz = 220 + sigmoid * 440;
  return Number(pitchHz.toFixed(2));
}

/**
 * Memetakan magnitudo gempa (3.0..9.0) ke frekuensi pulsa seismik rendah (55..140 Hz).
 */
export function computeSeismicToneHz(magnitude: number): number {
  const mag = Math.max(2, Math.min(9.5, Number.isFinite(magnitude) ? magnitude : 5));
  const ratio = (mag - 2) / 7.5;
  const hz = 140 - ratio * 85;
  return Number(Math.max(55, Math.min(140, hz)).toFixed(2));
}

/**
 * Mengevaluasi probabilitas emisi klik pencacah Geiger-Müller menggunakan proses Poisson.
 */
export function shouldEmitGeigerClick(
  activityBq: number,
  dtSec: number,
  randomSample = Math.random()
): boolean {
  if (!Number.isFinite(activityBq) || activityBq <= 0 || !Number.isFinite(dtSec) || dtSec <= 0) {
    return false;
  }
  const audibleRate = Math.min(35, Math.max(0.2, activityBq * 0.025));
  const prob = 1 - Math.exp(-audibleRate * dtSec);
  return randomSample < prob;
}

/**
 * Menghitung interval siklus detak jantung (ms) dan jeda S1 ("Lub") -> S2 ("Dub").
 */
export function computeHeartbeatIntervalsMs(bpm: number): {
  cycleMs: number;
  lubToDubMs: number;
} {
  const safeBpm = Math.max(35, Math.min(200, Number.isFinite(bpm) ? bpm : 72));
  const cycleMs = Math.round(60000 / safeBpm);
  const lubToDubMs = Math.max(140, Math.min(340, Math.round(cycleMs * 0.32)));
  return { cycleMs, lubToDubMs };
}

class ScientificSonificationEngine {
  private ctx: AudioContext | null = null;
  private enabled = false;
  private masterVolume = 0.7;

  private ensureContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setMasterVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
  }

  private effectiveGain(scale = 1): number {
    return SAFE_CLASSROOM_MAX_GAIN * this.masterVolume * Math.max(0, Math.min(1, scale));
  }

  public playDopplerTone(
    sourceFreqHz: number,
    sourceVelocityMs: number,
    panNormalized = 0,
    durationSec = 0.18
  ): number {
    const observedHz = computeDopplerObservedHz(sourceFreqHz, sourceVelocityMs);
    const ctx = this.ensureContext();
    if (!ctx) return observedHz;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(observedHz, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.002, this.effectiveGain(0.8)), now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + durationSec);

    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, panNormalized)), now);
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(ctx.destination);
    } else {
      osc.connect(gain);
      gain.connect(ctx.destination);
    }

    osc.start(now);
    osc.stop(now + durationSec + 0.02);
    return observedHz;
  }

  public playHarmonicTone(naturalFreqHz: number, durationSec = 0.16): number {
    const pitchHz = computeHarmonicPitchHz(naturalFreqHz);
    const ctx = this.ensureContext();
    if (!ctx) return pitchHz;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitchHz, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.002, this.effectiveGain(0.7)), now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
    return pitchHz;
  }

  public playTitrationTone(ph: number, durationSec = 0.14): number {
    const pitchHz = computeTitrationPhPitchHz(ph);
    const ctx = this.ensureContext();
    if (!ctx) return pitchHz;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = Math.abs(ph - 7) < 0.8 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(pitchHz, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.002, this.effectiveGain(0.65)), now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
    return pitchHz;
  }

  public playSeismicPulse(magnitude: number, durationSec = 0.24): number {
    const hz = computeSeismicToneHz(magnitude);
    const ctx = this.ensureContext();
    if (!ctx) return hz;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(hz, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, hz * 0.72), now + durationSec);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.002, this.effectiveGain(0.85)), now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
    return hz;
  }

  public playGeigerClick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1450, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.012);

    gain.gain.setValueAtTime(Math.max(0.002, this.effectiveGain(0.65)), now);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.015);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.018);
  }

  public playHeartbeatLubDub(bpm: number): { cycleMs: number; lubToDubMs: number } {
    const timing = computeHeartbeatIntervalsMs(bpm);
    const ctx = this.ensureContext();
    if (!ctx) return timing;

    const now = ctx.currentTime;
    const schedulePulse = (startOffsetSec: number, freqHz: number, durSec: number, amp: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freqHz, now + startOffsetSec);
      osc.frequency.exponentialRampToValueAtTime(freqHz * 0.55, now + startOffsetSec + durSec);

      gain.gain.setValueAtTime(0.001, now + startOffsetSec);
      gain.gain.exponentialRampToValueAtTime(
        Math.max(0.002, this.effectiveGain(amp)),
        now + startOffsetSec + 0.018
      );
      gain.gain.exponentialRampToValueAtTime(0.0005, now + startOffsetSec + durSec);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffsetSec);
      osc.stop(now + startOffsetSec + durSec + 0.02);
    };

    schedulePulse(0, 82, 0.11, 0.95);
    schedulePulse(timing.lubToDubMs / 1000, 108, 0.085, 0.72);
    return timing;
  }
}

export const scientificSonification = new ScientificSonificationEngine();
